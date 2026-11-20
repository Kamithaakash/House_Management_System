from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants import FoodType, Section
from app.models import AuditLog, Expense, ExpenseSplit, User
from app.money import split_equally, split_per_person
from app.schemas.expenses import ExpenseCreate, ExpenseResponse, MyBillResponse, MyBillRow, SplitItemResponse


def _get_active_user_map(db: Session) -> dict[int, str]:
    """Flyweight helper: load user id -> name once per request."""
    users = db.query(User.id, User.name).filter(User.is_active.is_(True)).all()
    return {uid: name for uid, name in users}


def _validate_and_compute_splits(data: ExpenseCreate, active_users: dict[int, str]) -> tuple[int, dict[int, int]]:
    if data.paid_by not in active_users:
        raise HTTPException(status_code=400, detail="Payer must be an active user")

    if data.section == Section.FOOD:
        if not data.food_type:
            raise HTTPException(status_code=422, detail="food_type is required for food")
        if data.food_type == FoodType.RICE_CURRY and not data.curry_type:
            raise HTTPException(status_code=422, detail="curry_type is required for Rice & Curry")

    try:
        if data.split_mode == "equal":
            if data.total_cents is None or not data.participant_ids:
                raise HTTPException(status_code=422, detail="total_cents and participant_ids are required for equal split")
            for uid in data.participant_ids:
                if uid not in active_users:
                    raise HTTPException(status_code=400, detail=f"User {uid} is not active")
            shares = split_equally(data.total_cents, data.participant_ids)
            return data.total_cents, shares

        else:  # per_person
            if not data.per_person_cents:
                raise HTTPException(status_code=422, detail="per_person_cents is required for per-person split")
            for uid in data.per_person_cents:
                if uid not in active_users:
                    raise HTTPException(status_code=400, detail=f"User {uid} is not active")
            return split_per_person(data.per_person_cents)
    except (ValueError, TypeError) as err:
        raise HTTPException(status_code=422, detail=str(err))


def _build_expense_response(expense: Expense, splits: list[ExpenseSplit], user_map: dict[int, str]) -> ExpenseResponse:
    return ExpenseResponse(
        id=expense.id,
        paid_by=expense.paid_by,
        paid_by_name=user_map.get(expense.paid_by, "Unknown"),
        section=expense.section,
        item_name=expense.item_name,
        food_type=expense.food_type,
        curry_type=expense.curry_type,
        total_cents=expense.total_cents,
        expense_date=expense.expense_date,
        created_by=expense.created_by,
        splits=[
            SplitItemResponse(
                user_id=s.user_id,
                user_name=user_map.get(s.user_id, "Unknown"),
                share_cents=s.share_cents,
            )
            for s in splits
        ],
    )


def create_expense(db: Session, data: ExpenseCreate, current_user: User) -> ExpenseResponse:
    user_map = _get_active_user_map(db)
    total_cents, shares = _validate_and_compute_splits(data, user_map)

    if sum(shares.values()) != total_cents:
        raise HTTPException(status_code=500, detail="Split sum mismatch")

    expense = Expense(
        paid_by=data.paid_by,
        section=data.section.value,
        item_name=data.item_name.strip(),
        food_type=data.food_type.value if data.food_type else None,
        curry_type=data.curry_type.value if data.curry_type else None,
        total_cents=total_cents,
        expense_date=data.expense_date,
        created_by=current_user.id,  # Always from session, never from client
    )
    db.add(expense)
    db.flush()

    split_rows = []
    for uid, share in shares.items():
        row = ExpenseSplit(expense_id=expense.id, user_id=uid, share_cents=share)
        db.add(row)
        split_rows.append(row)

    db.add(AuditLog(
        user_id=current_user.id,
        action="create_expense",
        entity="expense",
        entity_id=expense.id,
        details={"total_cents": total_cents, "section": expense.section},
    ))
    db.commit()
    db.refresh(expense)
    return _build_expense_response(expense, split_rows, user_map)


def update_expense(db: Session, expense_id: int, data: ExpenseCreate, current_user: User) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None)).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to edit this expense")

    user_map = _get_active_user_map(db)
    total_cents, shares = _validate_and_compute_splits(data, user_map)
    if sum(shares.values()) != total_cents:
        raise HTTPException(status_code=500, detail="Split sum mismatch")

    expense.paid_by = data.paid_by
    expense.section = data.section.value
    expense.item_name = data.item_name.strip()
    expense.food_type = data.food_type.value if data.food_type else None
    expense.curry_type = data.curry_type.value if data.curry_type else None
    expense.total_cents = total_cents
    expense.expense_date = data.expense_date

    # Replace old splits inside the same transaction
    db.query(ExpenseSplit).filter(ExpenseSplit.expense_id == expense.id).delete()
    split_rows = []
    for uid, share in shares.items():
        row = ExpenseSplit(expense_id=expense.id, user_id=uid, share_cents=share)
        db.add(row)
        split_rows.append(row)

    db.add(AuditLog(
        user_id=current_user.id,
        action="edit_expense",
        entity="expense",
        entity_id=expense.id,
        details={"total_cents": total_cents},
    ))
    db.commit()
    return _build_expense_response(expense, split_rows, user_map)


def soft_delete_expense(db: Session, expense_id: int, current_user: User) -> dict:
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.deleted_at.is_(None)).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete this expense")

    expense.deleted_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="delete_expense",
        entity="expense",
        entity_id=expense.id,
        details={"item_name": expense.item_name, "total_cents": expense.total_cents},
    ))
    db.commit()
    return {"detail": "Expense deleted"}


def get_my_bill(db: Session, current_user: User) -> MyBillResponse:
    """Privacy rule: show ONLY expenses where current_user paid OR is in splits."""
    user_map = {u.id: u.name for u in db.query(User.id, User.name).all()}

    expenses = (
        db.query(Expense)
        .filter(Expense.deleted_at.is_(None))
        .order_by(Expense.expense_date.desc(), Expense.id.desc())
        .all()
    )

    all_splits = db.query(ExpenseSplit).all()
    splits_by_expense: dict[int, list[ExpenseSplit]] = {}
    for s in all_splits:
        splits_by_expense.setdefault(s.expense_id, []).append(s)

    rows = []
    total_you_owe = 0
    total_owed_to_you = 0

    for exp in expenses:
        exp_splits = splits_by_expense.get(exp.id, [])
        my_split = next((s for s in exp_splits if s.user_id == current_user.id), None)

        # Hide expenses that do not involve current_user
        if exp.paid_by != current_user.id and my_split is None:
            continue

        your_share = my_split.share_cents if my_split else 0
        you_paid = exp.paid_by == current_user.id

        if you_paid:
            # Others owe you (total minus your own share)
            total_owed_to_you += exp.total_cents - your_share
        else:
            total_you_owe += your_share

        rows.append(
            MyBillRow(
                expense_id=exp.id,
                expense_date=exp.expense_date,
                section=exp.section,
                item_name=exp.item_name,
                paid_by_name=user_map.get(exp.paid_by, "Unknown"),
                total_cents=exp.total_cents,
                your_share_cents=your_share,
                you_paid=you_paid,
            )
        )

    return MyBillResponse(
        rows=rows,
        total_you_owe_cents=total_you_owe,
        total_owed_to_you_cents=total_owed_to_you,
        net_cents=total_owed_to_you - total_you_owe,
    )