import pytest
from app.money import (
    split_equally, split_per_person,
    compute_pairwise_debts, validate_debt_transfer,
)


# ----- splitting -----
def test_rounding_remainder():
    shares = split_equally(10000, [1, 2, 3])
    assert list(shares.values()) == [3334, 3333, 3333]
    assert sum(shares.values()) == 10000


def test_split_needs_participants():
    with pytest.raises(ValueError):
        split_equally(1000, [])


def test_split_rejects_duplicates():
    with pytest.raises(ValueError):
        split_equally(1000, [1, 1, 2])


def test_split_rejects_float_and_negative():
    with pytest.raises(TypeError):
        split_equally(100.5, [1, 2])
    with pytest.raises(ValueError):
        split_equally(-100, [1, 2])


def test_split_rejects_huge_amount():
    with pytest.raises(ValueError):
        split_equally(10**12, [1, 2])


def test_per_person_split():
    total, shares = split_per_person({1: 45000, 2: 35000})
    assert total == 80000
    assert shares == {1: 45000, 2: 35000}


# ----- debts -----
def test_mutual_offset():
    splits = [(2, 1, 5000), (1, 2, 3000)]
    assert compute_pairwise_debts(splits, []) == [(1, 2, 2000)]


def test_no_auto_chain_collapse():
    splits = [(2, 1, 5000), (3, 2, 5000)]
    assert compute_pairwise_debts(splits, []) == [(1, 2, 5000), (2, 3, 5000)]


def test_manual_debt_redirect_by_b():
    splits = [(2, 1, 5000), (3, 2, 5000)]
    debts = compute_pairwise_debts(splits, [])
    validate_debt_transfer(debts, 1, 2, 3, 5000)
    updated = compute_pairwise_debts(splits, [], debt_transfers=[(1, 2, 3, 5000)])
    assert updated == [(1, 3, 5000)]


def test_redirect_blocks_over_transfer():
    splits = [(2, 1, 5000), (3, 2, 3000)]
    debts = compute_pairwise_debts(splits, [])
    with pytest.raises(ValueError):
        validate_debt_transfer(debts, 1, 2, 3, 5000)


def test_redirect_needs_three_different_users():
    with pytest.raises(ValueError):
        validate_debt_transfer([(1, 2, 5000)], 1, 2, 1, 1000)


def test_pending_vs_confirmed_settlement():
    splits = [(2, 1, 5000)]
    assert compute_pairwise_debts(splits, []) == [(1, 2, 5000)]
    assert compute_pairwise_debts(splits, [(1, 2, 5000)]) == []