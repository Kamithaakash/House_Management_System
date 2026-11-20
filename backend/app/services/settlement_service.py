from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.constants import SettlementStatus
from app.models import AuditLog, DebtTransfer, Expense, ExpenseSplit, Settlement, User
from app.money import compute_pairwise_debts, validate_debt_transfer
from app.schemas.settlements import (
    BalancesOverviewResponse,
    BillBreakdownResponse,
    DebtItemResponse,
    DebtRedirectCreate,
    PersonBillCardResponse,
    PersonBreakdownItem,
    RedirectNoticeResponse,
    SettlementCreate,
    SettlementResponse,
)


def _format_rs(cents: int) -> str:
    """Format integer cents to Rs. without float division."""
    return f"Rs. {cents // 100}.{cents % 100:02d}"


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
        .order_by(DebtTransfer.created_at.desc())
        .limit(20)
        .all()
    )

    notices = []
    for t in transfers:
        a_name = user_map.get(t.from_debtor, "Unknown")
        b_name = user_map.get(t.via_middleman, "Unknown")
        c_name = user_map.get(t.to_creditor, "Unknown")
        rs = _format_rs(t.amount_cents)
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


def get_bill_breakdown(db: Session, current_user: User) -> BillBreakdownResponse:
    """
    Person-wise bill breakdown for current_user (strictly private to current_user).
    Every person card's items sum to the exact live net amount between current_user and that person.
    """
    me = current_user.id
    user_map = _get_user_map(db)
    raw_debts = _compute_live_debts(db)

    # 1. Build live remaining debts per other user
    my_pair_net: dict[int, int] = {}
    other_debts = []
    for u, v, amt in raw_debts:
        if u == me:
            my_pair_net[v] = -amt
        elif v == me:
            my_pair_net[u] = amt
        else:
            other_debts.append(
                DebtItemResponse(
                    from_user=u,
                    from_name=user_map.get(u, "Unknown"),
                    to_user=v,
                    to_name=user_map.get(v, "Unknown"),
                    amount_cents=amt,
                )
            )

    # 2. Collect itemized breakdown only for people with an active balance
    items_by_other: dict[int, list[PersonBreakdownItem]] = {uid: [] for uid in my_pair_net}

    if items_by_other:
        # Expenses involving me and one of those active people
        split_rows = (
            db.query(
                Expense.expense_date,
                Expense.item_name,
                Expense.section,
                Expense.paid_by,
                ExpenseSplit.user_id,
                ExpenseSplit.share_cents,
            )
            .join(ExpenseSplit, Expense.id == ExpenseSplit.expense_id)
            .filter(
                Expense.deleted_at.is_(None),
                (Expense.paid_by == me) | (ExpenseSplit.user_id == me),
            )
            .order_by(Expense.expense_date.desc(), Expense.id.desc())
            .all()
        )
        for exp_date, item_name, section, paid_by, participant, share in split_rows:
            if paid_by == participant or share == 0:
                continue
            if paid_by == me and participant in items_by_other:
                items_by_other[participant].append(
                    PersonBreakdownItem(
                        kind="expense",
                        item_date=str(exp_date),
                        title=item_name,
                        subtitle=f"You paid ({section.replace('_', ' ')})",
                        signed_cents=share,
                    )
                )
            elif participant == me and paid_by in items_by_other:
                other_name = user_map.get(paid_by, "Unknown")
                items_by_other[paid_by].append(
                    PersonBreakdownItem(
                        kind="expense",
                        item_date=str(exp_date),
                        title=item_name,
                        subtitle=f"Paid by {other_name} ({section.replace('_', ' ')})",
                        signed_cents=-share,
                    )
                )

    # 3. Settlements involving me (for both breakdown & History tab)
    my_settlements = (
        db.query(Settlement)
        .filter((Settlement.from_user == me) | (Settlement.to_user == me))
        .order_by(Settlement.created_at.desc())
        .all()
    )

    pending_sent_by_other: dict[int, int] = {}
    pending_settlements = []
    for s in my_settlements:
        if s.status == SettlementStatus.PENDING.value:
            pending_settlements.append(s)
            if s.from_user == me:
                pending_sent_by_other[s.to_user] = pending_sent_by_other.get(s.to_user, 0) + s.amount_cents
        elif s.status == SettlementStatus.CONFIRMED.value:
            if s.from_user == me and s.to_user in items_by_other:
                items_by_other[s.to_user].append(
                    PersonBreakdownItem(
                        kind="settlement",
                        item_date=str((s.confirmed_at or s.created_at).date()),
                        title="Cash payment confirmed",
                        subtitle=f"You paid {user_map.get(s.to_user, 'Unknown')}",
                        signed_cents=s.amount_cents,
                    )
                )
            elif s.to_user == me and s.from_user in items_by_other:
                items_by_other[s.from_user].append(
                    PersonBreakdownItem(
                        kind="settlement",
                        item_date=str((s.confirmed_at or s.created_at).date()),
                        title="Cash payment confirmed",
                        subtitle=f"{user_map.get(s.from_user, 'Unknown')} paid you",
                        signed_cents=-s.amount_cents,
                    )
                )

    # 4. Debt redirects involving me (for both breakdown & History tab)
    all_transfers = db.query(DebtTransfer).order_by(DebtTransfer.created_at.desc()).all()
    notices = []
    for t in all_transfers:
        a_name = user_map.get(t.from_debtor, "Unknown")
        b_name = user_map.get(t.via_middleman, "Unknown")
        c_name = user_map.get(t.to_creditor, "Unknown")
        rs = _format_rs(t.amount_cents)
        t_date = str(t.created_at.date())

        if t.from_debtor == me or t.via_middleman == me or t.to_creditor == me:
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

        # Pairwise effects on active cards
        if t.from_debtor == me and t.via_middleman in items_by_other:
            items_by_other[t.via_middleman].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected to {c_name}",
                    subtitle=f"{b_name} moved your debt to {c_name}",
                    signed_cents=t.amount_cents,
                )
            )
        if t.via_middleman == me and t.from_debtor in items_by_other:
            items_by_other[t.from_debtor].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected to {c_name}",
                    subtitle=f"You moved {a_name}'s debt to {c_name}",
                    signed_cents=-t.amount_cents,
                )
            )
        if t.via_middleman == me and t.to_creditor in items_by_other:
            items_by_other[t.to_creditor].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected from {a_name}",
                    subtitle=f"You redirected {a_name} to pay {c_name}",
                    signed_cents=t.amount_cents,
                )
            )
        if t.to_creditor == me and t.via_middleman in items_by_other:
            items_by_other[t.via_middleman].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected from {a_name}",
                    subtitle=f"{b_name} redirected {a_name} to pay you",
                    signed_cents=-t.amount_cents,
                )
            )
        if t.from_debtor == me and t.to_creditor in items_by_other:
            items_by_other[t.to_creditor].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected by {b_name}",
                    subtitle=f"{b_name} owed {c_name}, so your debt to {b_name} moved here",
                    signed_cents=-t.amount_cents,
                )
            )
        if t.to_creditor == me and t.from_debtor in items_by_other:
            items_by_other[t.from_debtor].append(
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected by {b_name}",
                    subtitle=f"{a_name} owed {b_name}, so {b_name} redirected {a_name} to pay you",
                    signed_cents=t.amount_cents,
                )
            )

    person_cards = []
    for other_id, net in sorted(my_pair_net.items(), key=lambda pair: (pair[1] > 0, -abs(pair[1]))):
        card_items = sorted(items_by_other[other_id], key=lambda x: x.item_date, reverse=True)
        person_cards.append(
            PersonBillCardResponse(
                other_user_id=other_id,
                other_user_name=user_map.get(other_id, "Unknown"),
                direction="you_owe" if net < 0 else "owes_you",
                net_cents=abs(net),
                pending_sent_cents=pending_sent_by_other.get(other_id, 0),
                items=card_items,
            )
        )

    total_you_owe = sum(-net for net in my_pair_net.values() if net < 0)
    total_owed_to_you = sum(net for net in my_pair_net.values() if net > 0)

    return BillBreakdownResponse(
        total_you_owe_cents=total_you_owe,
        total_owed_to_you_cents=total_owed_to_you,
        person_cards=person_cards,
        pending_settlements=[_to_settlement_response(s, user_map) for s in pending_settlements],
        history_settlements=[_to_settlement_response(s, user_map) for s in my_settlements],
        redirect_notices=notices[:30],
        other_debts=other_debts,
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
            detail=f"Amount exceeds remaining unpaid balance ({_format_rs(remaining_cents)})",
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
    rs = _format_rs(transfer.amount_cents)
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