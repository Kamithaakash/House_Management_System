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


def _filter_open_items(
    raw_items: list[tuple[PersonBreakdownItem, bool, int]],
    target_net: int,
) -> list[PersonBreakdownItem]:
    """
    Keep ONLY unsettled items explaining `target_net` between two users.
    raw_items: list of (item, is_clearance, sort_id)
      - is_clearance=False: expenses and incoming redirects (reasons money is owed)
      - is_clearance=True:  confirmed cash settlements and outgoing redirects (payments that settle debts)
    """
    # Order oldest -> newest so confirmed payments cancel the oldest bills first (FIFO)
    ordered = sorted(raw_items, key=lambda x: (x[0].item_date, x[2]))

    open_neg: list[tuple[PersonBreakdownItem, int]] = []
    open_pos: list[tuple[PersonBreakdownItem, int]] = []
    clear_net = 0
    had_clearances = False
    last_clear_date = ""
    last_clear_sort_id = 0

    for item, is_clearance, sort_id in ordered:
        if is_clearance:
            had_clearances = True
            clear_net += item.signed_cents
            last_clear_date = item.item_date
            last_clear_sort_id = sort_id
        else:
            if item.signed_cents < 0:
                open_neg.append((item, sort_id))
            elif item.signed_cents > 0:
                open_pos.append((item, sort_id))

    def _find_zero_prefix(
        neg_list: list[tuple[PersonBreakdownItem, int]],
        pos_list: list[tuple[PersonBreakdownItem, int]],
        offset: int,
    ) -> tuple[int, int] | None:
        """Find largest oldest prefix (i, j) where sum(neg[:i]) + sum(pos[:j]) + offset == 0."""
        pos_by_sum: dict[int, int] = {0: 0}
        running_pos = 0
        for j, (item, _) in enumerate(pos_list, start=1):
            running_pos += item.signed_cents
            pos_by_sum[running_pos] = j

        best: tuple[int, int] | None = None
        running_neg = 0
        for i in range(len(neg_list) + 1):
            if i > 0:
                running_neg += neg_list[i - 1][0].signed_cents
            needed_pos = -running_neg - offset
            if needed_pos in pos_by_sum:
                j = pos_by_sum[needed_pos]
                if i + j > 0 and (best is None or (i + j) > (best[0] + best[1])):
                    best = (i, j)
        return best

    # 1. Drop the largest oldest settled prefix that balances to 0 with confirmed clearances
    if had_clearances:
        match = _find_zero_prefix(open_neg, open_pos, clear_net)
        if match is not None:
            cut_neg, cut_pos = match
            open_neg = open_neg[cut_neg:]
            open_pos = open_pos[cut_pos:]
            clear_net = 0
        else:
            # Drop any older zero-sum bill prefix before applying partial clearance
            bill_match = _find_zero_prefix(open_neg, open_pos, 0)
            if bill_match is not None:
                cut_neg, cut_pos = bill_match
                open_neg = open_neg[cut_neg:]
                open_pos = open_pos[cut_pos:]
    else:
        # Even without cash settlements, hide older bills from an earlier date that already mutually canceled to 0
        bill_match = _find_zero_prefix(open_neg, open_pos, 0)
        if bill_match is not None:
            cut_neg, cut_pos = bill_match
            rem_dates = [x.item_date for x, _ in open_neg[cut_neg:]] + [x.item_date for x, _ in open_pos[cut_pos:]]
            old_dates = [x.item_date for x, _ in open_neg[:cut_neg]] + [x.item_date for x, _ in open_pos[:cut_pos]]
            if rem_dates and old_dates and max(old_dates) < min(rem_dates):
                open_neg = open_neg[cut_neg:]
                open_pos = open_pos[cut_pos:]

    # 2. If a partial clearance remains, cancel oldest matching bills one by one (FIFO)
    while open_neg and clear_net >= -open_neg[0][0].signed_cents:
        clear_net += open_neg[0][0].signed_cents
        open_neg.pop(0)
    while open_pos and -clear_net >= open_pos[0][0].signed_cents:
        clear_net += open_pos[0][0].signed_cents
        open_pos.pop(0)

    result_with_order: list[tuple[PersonBreakdownItem, int]] = []
    result_with_order.extend(open_neg)
    result_with_order.extend(open_pos)

    # 3. If a partial payment still remains on an open bill, show it cleanly so math adds up to the exact cent
    if clear_net != 0:
        result_with_order.append(
            (
                PersonBreakdownItem(
                    kind="settlement",
                    item_date=last_clear_date,
                    title="Partly settled",
                    subtitle="Confirmed payment / redirect already applied",
                    signed_cents=clear_net,
                ),
                last_clear_sort_id,
            )
        )

    # Safety check: items shown MUST equal the exact net amount on the card
    if sum(x.signed_cents for x, _ in result_with_order) != target_net:
        return [item for item, _, _ in reversed(ordered)]

    # Always newest at the top, oldest at the bottom (date desc, then id desc)
    result_with_order.sort(key=lambda pair: (pair[0].item_date, pair[1]), reverse=True)
    return [item for item, _ in result_with_order]


def get_bill_breakdown(db: Session, current_user: User) -> BillBreakdownResponse:
    """
    Person-wise bill breakdown for current_user (strictly private to current_user).
    Shows ONLY remaining unsettled transactions explaining each person's live net amount.
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

    # 2. Collect itemized breakdown (item, is_clearance, sort_id) for people with an active balance
    items_by_other: dict[int, list[tuple[PersonBreakdownItem, bool, int]]] = {uid: [] for uid in my_pair_net}

    if items_by_other:
        split_rows = (
            db.query(
                Expense.id,
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
            .order_by(Expense.expense_date.asc(), Expense.id.asc())
            .all()
        )
        for exp_id, exp_date, item_name, section, paid_by, participant, share in split_rows:
            if paid_by == participant or share == 0:
                continue
            if paid_by == me and participant in items_by_other:
                items_by_other[participant].append((
                    PersonBreakdownItem(
                        kind="expense",
                        item_date=str(exp_date),
                        title=item_name,
                        subtitle=f"You paid ({section.replace('_', ' ')})",
                        signed_cents=share,
                    ),
                    False,
                    exp_id,
                ))
            elif participant == me and paid_by in items_by_other:
                other_name = user_map.get(paid_by, "Unknown")
                items_by_other[paid_by].append((
                    PersonBreakdownItem(
                        kind="expense",
                        item_date=str(exp_date),
                        title=item_name,
                        subtitle=f"Paid by {other_name} ({section.replace('_', ' ')})",
                        signed_cents=-share,
                    ),
                    False,
                    exp_id,
                ))

    # 3. Settlements involving me (for both FIFO cancellation & History tab, newest first)
    my_settlements = (
        db.query(Settlement)
        .filter((Settlement.from_user == me) | (Settlement.to_user == me))
        .order_by(Settlement.created_at.desc(), Settlement.id.desc())
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
                items_by_other[s.to_user].append((
                    PersonBreakdownItem(
                        kind="settlement",
                        item_date=str((s.confirmed_at or s.created_at).date()),
                        title="Cash payment confirmed",
                        subtitle=f"You paid {user_map.get(s.to_user, 'Unknown')}",
                        signed_cents=s.amount_cents,
                    ),
                    True,
                    s.id,
                ))
            elif s.to_user == me and s.from_user in items_by_other:
                items_by_other[s.from_user].append((
                    PersonBreakdownItem(
                        kind="settlement",
                        item_date=str((s.confirmed_at or s.created_at).date()),
                        title="Cash payment confirmed",
                        subtitle=f"{user_map.get(s.from_user, 'Unknown')} paid you",
                        signed_cents=-s.amount_cents,
                    ),
                    True,
                    s.id,
                ))

    # 4. Debt redirects involving me (outgoing redirects clear debt; incoming redirects create debt)
    all_transfers = db.query(DebtTransfer).order_by(DebtTransfer.created_at.desc(), DebtTransfer.id.desc()).all()
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

        # Outgoing/clearing sides of a redirect (is_clearance=True)
        if t.from_debtor == me and t.via_middleman in items_by_other:
            items_by_other[t.via_middleman].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected to {c_name}",
                    subtitle=f"{b_name} moved your debt to {c_name}",
                    signed_cents=t.amount_cents,
                ),
                True,
                t.id,
            ))
        if t.via_middleman == me and t.from_debtor in items_by_other:
            items_by_other[t.from_debtor].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected to {c_name}",
                    subtitle=f"You moved {a_name}'s debt to {c_name}",
                    signed_cents=-t.amount_cents,
                ),
                True,
                t.id,
            ))
        if t.via_middleman == me and t.to_creditor in items_by_other:
            items_by_other[t.to_creditor].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected from {a_name}",
                    subtitle=f"You redirected {a_name} to pay {c_name}",
                    signed_cents=t.amount_cents,
                ),
                True,
                t.id,
            ))
        if t.to_creditor == me and t.via_middleman in items_by_other:
            items_by_other[t.via_middleman].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected from {a_name}",
                    subtitle=f"{b_name} redirected {a_name} to pay you",
                    signed_cents=-t.amount_cents,
                ),
                True,
                t.id,
            ))
        # Incoming side that creates a debt between A and C (is_clearance=False -> must be shown!)
        if t.from_debtor == me and t.to_creditor in items_by_other:
            items_by_other[t.to_creditor].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected by {b_name}",
                    subtitle=f"{b_name} owed {c_name}, so your debt to {b_name} moved here",
                    signed_cents=-t.amount_cents,
                ),
                False,
                t.id,
            ))
        if t.to_creditor == me and t.from_debtor in items_by_other:
            items_by_other[t.from_debtor].append((
                PersonBreakdownItem(
                    kind="redirect",
                    item_date=t_date,
                    title=f"Redirected by {b_name}",
                    subtitle=f"{a_name} owed {b_name}, so {b_name} redirected {a_name} to pay you",
                    signed_cents=t.amount_cents,
                ),
                False,
                t.id,
            ))

    person_cards_with_recency = []
    for other_id, net in my_pair_net.items():
        card_items = _filter_open_items(items_by_other[other_id], target_net=net)
        latest_key = max(
            ((item.item_date, sort_id) for item, _, sort_id in items_by_other[other_id]),
            default=("", 0),
        )
        person_cards_with_recency.append(
            (
                latest_key,
                PersonBillCardResponse(
                    other_user_id=other_id,
                    other_user_name=user_map.get(other_id, "Unknown"),
                    direction="you_owe" if net < 0 else "owes_you",
                    net_cents=abs(net),
                    pending_sent_cents=pending_sent_by_other.get(other_id, 0),
                    items=card_items,
                ),
            )
        )

    # Newest bill/payment activity at the top, older people below
    person_cards_with_recency.sort(
        key=lambda entry: (entry[0][0], entry[0][1], entry[1].net_cents),
        reverse=True,
    )
    person_cards = [card for _, card in person_cards_with_recency]

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