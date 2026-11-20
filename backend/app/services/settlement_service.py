from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants import SettlementStatus
from app.models import AuditLog, DebtTransfer, Expense, ExpenseSplit, Settlement, User
from app.money import compute_pairwise_debts, validate_debt_transfer
from app.schemas.settlements import (
    BalancesOverviewResponse,
    DebtItemResponse,
    DebtRedirectCreate,
    RedirectNoticeResponse,
    SettlementCreate,
    SettlementResponse,
)


def _get_user_map(db: Session) -> dict[int, str]:
    """Flyweight: load user id -> name once per request."""
    return {uid: name for uid, name in db.query(User.id, User.name).all()}


def _compute_live_debts(db: Session) -> list[tuple[int, int, int]]:
    """Compute live pairwise debts from non-deleted expenses, confirmed settlements, and redirects."""
    split_rows = (
        db.query(Expense.paid_by, ExpenseSplit.user_id, ExpenseSplit.share_cents)
        .join(ExpenseSplit, Expense.id == ExpenseSplit.expense_id)
        .filter(Expense.deleted_at.is_(None))
        .all()
    )
    confirmed_rows = (
        db.query(Settlement.from_user, Settlement.to_user, Settlement.amount_cents)
        .filter(Settlement.status == SettlementStatus.CONFIRMED.value)
        .all()
    )
    transfer_rows = (
        db.query(
            DebtTransfer.from_debtor,
            DebtTransfer.via_middleman,
            DebtTransfer.to_creditor,
            DebtTransfer.amount_cents,
        )
        .all()
    )
    return compute_pairwise_debts(split_rows, confirmed_rows, transfer_rows)


def _to_settlement_response(s: Settlement, user_map: dict[int, str]) -> SettlementResponse:
    return SettlementResponse(
        id=s.id,
        from_user=s.from_user,
        from_name=user_map.get(s.from_user, "Unknown"),
        to_user=s.to_user,
        to_name=user_map.get(s.to_user, "Unknown"),
        amount_cents=s.amount_cents,
        status=s.status,
        created_at=s.created_at,
        confirmed_at=s.confirmed_at,
    )


def get_balances_overview(db: Session, current_user: User) -> BalancesOverviewResponse:
    user_map = _get_user_map(db)
    raw_debts = _compute_live_debts(db)

    debts = [
        DebtItemResponse(
            from_user=u,
            from_name=user_map.get(u, "Unknown"),
            to_user=v,
            to_name=user_map.get(v, "Unknown"),
            amount_cents=amt,
        )
        for u, v, amt in raw_debts
    ]

    pending = (
        db.query(Settlement)
        .filter(
            Settlement.status == SettlementStatus.PENDING.value,
            (Settlement.from_user == current_user.id) | (Settlement.to_user == current_user.id),
        )
        .order_by(Settlement.created_at.desc())
        .all()
    )

    transfers = (
        db.query(DebtTransfer)
        .filter(
            (DebtTransfer.from_debtor == current_user.id)
            | (DebtTransfer.via_middleman == current_user.id)
            | (DebtTransfer.to_creditor == current_user.id)
        )
        .order_by(DebtTransfer.created_at.desc())
        .all()
    )

    notices = []
    for t in transfers:
        a_name = user_map.get(t.from_debtor, "Unknown")
        b_name = user_map.get(t.via_middleman, "Unknown")
        c_name = user_map.get(t.to_creditor, "Unknown")
        rs = f"Rs. {t.amount_cents / 100:.2f}"
        notices.append(
            RedirectNoticeResponse(
                id=t.id,
                from_debtor=t.from_debtor,
                from_debtor_name=a_name,
                via_middleman=t.via_middleman,
                via_middleman_name=b_name,
                to_creditor=t.to_creditor,
                to_creditor_name=c_name,
                amount_cents=t.amount_cents,
                message=f"{b_name} transferred {rs} from {a_name} to {c_name} (because {b_name} owed {c_name}).",
                created_at=t.created_at,
            )
        )

    return BalancesOverviewResponse(
        debts=debts,
        pending_settlements=[_to_settlement_response(s, user_map) for s in pending],
        redirect_notices=notices,
    )


def create_settlement(db: Session, data: SettlementCreate, current_user: User) -> SettlementResponse:
    if data.to_user == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot pay yourself")

    receiver = db.query(User).filter(User.id == data.to_user, User.is_active.is_(True)).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # Prevent paying more than you currently owe (accounting for pending settlements)
    live_debts = _compute_live_debts(db)
    owed_cents = sum(amt for u, v, amt in live_debts if u == current_user.id and v == data.to_user)
    pending_cents = sum(
        s.amount_cents
        for s in db.query(Settlement)
        .filter(
            Settlement.from_user == current_user.id,
            Settlement.to_user == data.to_user,
            Settlement.status == SettlementStatus.PENDING.value,
        )
        .all()
    )
    remaining_cents = owed_cents - pending_cents
    if remaining_cents <= 0:
        raise HTTPException(status_code=422, detail="You have no remaining unpaid balance to this user")
    if data.amount_cents > remaining_cents:
        raise HTTPException(
            status_code=422,
            detail=f"Amount exceeds remaining unpaid balance (Rs. {remaining_cents / 100:.2f})",
        )

    settlement = Settlement(
        from_user=current_user.id,  # Always from session
        to_user=data.to_user,
        amount_cents=data.amount_cents,
        status=SettlementStatus.PENDING.value,
    )
    db.add(settlement)
    db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="create_settlement",
        entity="settlement",
        entity_id=settlement.id,
        details={"to_user": data.to_user, "amount_cents": data.amount_cents},
    ))
    db.commit()
    db.refresh(settlement)
    return _to_settlement_response(settlement, _get_user_map(db))


def confirm_settlement(db: Session, settlement_id: int, current_user: User) -> SettlementResponse:
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).with_for_update().first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    # Only the receiver (to_user) can confirm receipt!
    if settlement.to_user != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the receiver can confirm payment")

    if settlement.status != SettlementStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Settlement is already processed")

    settlement.status = SettlementStatus.CONFIRMED.value
    settlement.confirmed_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=current_user.id,
        action="confirm_settlement",
        entity="settlement",
        entity_id=settlement.id,
        details={"from_user": settlement.from_user, "amount_cents": settlement.amount_cents},
    ))
    db.commit()
    db.refresh(settlement)
    return _to_settlement_response(settlement, _get_user_map(db))


def reject_settlement(db: Session, settlement_id: int, current_user: User) -> SettlementResponse:
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).with_for_update().first()
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    if settlement.to_user != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the receiver can reject payment")

    if settlement.status != SettlementStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Settlement is already processed")

    settlement.status = SettlementStatus.REJECTED.value
    db.add(AuditLog(
        user_id=current_user.id,
        action="reject_settlement",
        entity="settlement",
        entity_id=settlement.id,
        details={"from_user": settlement.from_user, "amount_cents": settlement.amount_cents},
    ))
    db.commit()
    db.refresh(settlement)
    return _to_settlement_response(settlement, _get_user_map(db))


def redirect_debt(db: Session, data: DebtRedirectCreate, current_user: User) -> RedirectNoticeResponse:
    """Middleman B manually redirects A's debt to C."""
    user_map = _get_user_map(db)
    if data.from_debtor not in user_map or data.to_creditor not in user_map:
        raise HTTPException(status_code=404, detail="User not found")

    live_debts = _compute_live_debts(db)
    try:
        validate_debt_transfer(
            live_debts,
            debtor=data.from_debtor,
            middleman=current_user.id,  # Always from session
            creditor=data.to_creditor,
            amount_cents=data.amount_cents,
        )
    except ValueError as err:
        raise HTTPException(status_code=422, detail=str(err))

    transfer = DebtTransfer(
        from_debtor=data.from_debtor,
        via_middleman=current_user.id,
        to_creditor=data.to_creditor,
        amount_cents=data.amount_cents,
    )
    db.add(transfer)
    db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="redirect_debt",
        entity="debt_transfer",
        entity_id=transfer.id,
        details={
            "from_debtor": data.from_debtor,
            "to_creditor": data.to_creditor,
            "amount_cents": data.amount_cents,
        },
    ))
    db.commit()
    db.refresh(transfer)

    a_name = user_map[transfer.from_debtor]
    b_name = user_map[transfer.via_middleman]
    c_name = user_map[transfer.to_creditor]
    rs = f"Rs. {transfer.amount_cents / 100:.2f}"
    return RedirectNoticeResponse(
        id=transfer.id,
        from_debtor=transfer.from_debtor,
        from_debtor_name=a_name,
        via_middleman=transfer.via_middleman,
        via_middleman_name=b_name,
        to_creditor=transfer.to_creditor,
        to_creditor_name=c_name,
        amount_cents=transfer.amount_cents,
        message=f"{b_name} transferred {rs} from {a_name} to {c_name} (because {b_name} owed {c_name}).",
        created_at=transfer.created_at,
    )