"""
Pure money logic (functional core). No database, no web, no float.
All amounts are INTEGER CENTS.
"""
from collections import defaultdict

from app.constants import MAX_AMOUNT_CENTS


def _check_cents(value, name: str = "amount") -> None:
    """Reject floats, bools, negatives, and absurdly large values."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer number of cents")
    if value < 0 or value > MAX_AMOUNT_CENTS:
        raise ValueError(f"{name} is out of the allowed range")


def _check_participants(user_ids: list[int]) -> list[int]:
    if not user_ids:
        raise ValueError("At least one participant is required")
    if len(set(user_ids)) != len(user_ids):
        raise ValueError("Duplicate participants are not allowed")
    return sorted(user_ids)  # fixed order -> same result every time


# ---------- Strategy 1: equal split ----------
def split_equally(total_cents: int, user_ids: list[int]) -> dict[int, int]:
    _check_cents(total_cents, "total")
    if total_cents == 0:
        raise ValueError("Total must be positive")
    user_ids = _check_participants(user_ids)

    base, remainder = divmod(total_cents, len(user_ids))
    shares = {
        uid: base + (1 if index < remainder else 0)
        for index, uid in enumerate(user_ids)
    }

    if sum(shares.values()) != total_cents:  # never trust, always verify
        raise RuntimeError("Split does not add up")
    return shares


# ---------- Strategy 2: per-person split ----------
def split_per_person(amounts: dict[int, int]) -> tuple[int, dict[int, int]]:
    """amounts: user_id -> cents. Returns (total_cents, shares)."""
    if not amounts:
        raise ValueError("At least one participant is required")
    for uid, cents in amounts.items():
        _check_cents(cents, f"amount for user {uid}")
    total = sum(amounts.values())
    if total == 0:
        raise ValueError("Total must be positive")
    _check_cents(total, "total")
    return total, dict(amounts)


# ---------- Who owes whom ----------
def compute_pairwise_debts(
    split_items: list[tuple[int, int, int]],
    confirmed_settlements: list[tuple[int, int, int]],
    debt_transfers: list[tuple[int, int, int, int]] | None = None,
) -> list[tuple[int, int, int]]:
    """
    split_items:           (paid_by, participant_id, share_cents)
    confirmed_settlements: (from_user, to_user, amount_cents)   <- CONFIRMED only
    debt_transfers:        (from_debtor, via_middleman, to_creditor, amount_cents)
    Returns list of (from_user, to_user, amount_cents).

    Rules: 2-person mutual offset is automatic.
           3-person chain collapse is NOT automatic (only via debt_transfers).
    """
    raw = defaultdict(int)

    for paid_by, participant, share in split_items:
        if participant != paid_by:
            raw[(participant, paid_by)] += share

    for from_u, to_u, amount in confirmed_settlements:
        raw[(from_u, to_u)] -= amount

    for debtor, middleman, creditor, amount in (debt_transfers or []):
        raw[(debtor, middleman)] -= amount
        raw[(middleman, creditor)] -= amount
        raw[(debtor, creditor)] += amount

    pairs = {tuple(sorted(key)) for key in raw}
    payments = []
    for u, v in sorted(pairs):
        diff = raw[(u, v)] - raw[(v, u)]
        if diff > 0:
            payments.append((u, v, diff))
        elif diff < 0:
            payments.append((v, u, -diff))

    # Zero-sum integrity check
    net = defaultdict(int)
    for from_u, to_u, amount in payments:
        net[from_u] -= amount
        net[to_u] += amount
    if sum(net.values()) != 0:
        raise RuntimeError("Critical: balances do not sum to zero")

    return payments


def validate_debt_transfer(
    current_debts: list[tuple[int, int, int]],
    debtor: int,
    middleman: int,
    creditor: int,
    amount_cents: int,
) -> None:
    """B (middleman) may redirect at most min(A owes B, B owes C)."""
    _check_cents(amount_cents, "transfer amount")
    if amount_cents == 0:
        raise ValueError("Transfer amount must be positive")
    if len({debtor, middleman, creditor}) != 3:
        raise ValueError("Debtor, middleman and creditor must be 3 different users")

    debts = {(u, v): amt for u, v, amt in current_debts}
    if amount_cents > debts.get((debtor, middleman), 0):
        raise ValueError("Cannot transfer more than the debtor owes you")
    if amount_cents > debts.get((middleman, creditor), 0):
        raise ValueError("Cannot transfer more than you owe the creditor")