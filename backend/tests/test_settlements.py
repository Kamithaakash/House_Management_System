import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import _failed_logins, hash_password

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    _failed_logins.clear()

    db = TestSessionLocal()
    for name, email in [
        ("Alice", "alice@test.com"),
        ("Bob", "bob@test.com"),
        ("Charlie", "charlie@test.com"),
    ]:
        db.add(User(name=name, email=email, password_hash=hash_password("StrongPass123!"), role="member"))
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def login(email: str):
    client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"})


def test_two_party_settlement_and_security_guards():
    # Bob (2) pays Rs. 100 for Alice (1) and Bob (2) -> Alice owes Bob Rs. 50
    login("bob@test.com")
    client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "food",
        "item_name": "Kottu",
        "food_type": "kottu",
        "expense_date": "2026-11-20",
        "split_mode": "equal",
        "total_cents": 10000,
        "participant_ids": [1, 2],
    })

    # Alice submits Rs. 50 settlement (pending)
    login("alice@test.com")
    s_id = client.post("/api/settlements", json={"to_user": 2, "amount_cents": 5000}).json()["id"]

    # Duplicate pending settlement exceeding remaining balance is blocked -> 422
    assert client.post("/api/settlements", json={"to_user": 2, "amount_cents": 1000}).status_code == 422

    # Security: Alice (payer) CANNOT confirm her own payment -> 403
    assert client.post(f"/api/settlements/{s_id}/confirm").status_code == 403

    # Balance still shows Alice owes Bob Rs. 50 while pending
    debts = client.get("/api/balances").json()["debts"]
    assert len(debts) == 1
    assert debts[0]["amount_cents"] == 5000

    # Bob (receiver) confirms -> balance clears to 0 everywhere (Balances AND My Bill)
    login("bob@test.com")
    assert client.post(f"/api/settlements/{s_id}/confirm").status_code == 200
    assert client.get("/api/balances").json()["debts"] == []

    login("alice@test.com")
    alice_bill = client.get("/api/expenses/my-bill").json()
    assert alice_bill["total_you_owe_cents"] == 0
    assert alice_bill["net_cents"] == 0

    # Confirming twice is blocked -> 409
    login("bob@test.com")
    assert client.post(f"/api/settlements/{s_id}/confirm").status_code == 409


def test_manual_debt_redirect_and_transparency_notice():
    # Alice (1) owes Bob (2) Rs. 50
    login("bob@test.com")
    client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "material",
        "item_name": "Soap",
        "expense_date": "2026-11-20",
        "split_mode": "per_person",
        "per_person_cents": {"1": 5000},
    })
    # Bob (2) owes Charlie (3) Rs. 50
    login("charlie@test.com")
    client.post("/api/expenses", json={
        "paid_by": 3,
        "section": "material",
        "item_name": "Broom",
        "expense_date": "2026-11-20",
        "split_mode": "per_person",
        "per_person_cents": {"2": 5000},
    })

    # By default: stays separate (no auto chain collapse)
    debts = client.get("/api/balances").json()["debts"]
    assert len(debts) == 2

    # Bob manually redirects Alice's Rs. 50 to Charlie
    login("bob@test.com")
    res = client.post("/api/settlements/redirect", json={
        "from_debtor": 1,
        "to_creditor": 3,
        "amount_cents": 5000,
    })
    assert res.status_code == 201

    # Alice checks her portal: she owes Charlie Rs. 50 AND sees the explanation notice!
    login("alice@test.com")
    overview = client.get("/api/balances").json()
    assert len(overview["debts"]) == 1
    assert overview["debts"][0]["from_user"] == 1
    assert overview["debts"][0]["to_user"] == 3
    assert overview["debts"][0]["amount_cents"] == 5000
    assert "Bob transferred Rs. 50.00 from Alice to Charlie" in overview["redirect_notices"][0]["message"]

    # Person-wise breakdown for Alice shows Charlie card with exact redirect item summing to -5000
    breakdown = client.get("/api/bill/breakdown").json()
    assert breakdown["total_you_owe_cents"] == 5000
    assert len(breakdown["person_cards"]) == 1
    card = breakdown["person_cards"][0]
    assert card["other_user_name"] == "Charlie"
    assert card["direction"] == "you_owe"
    assert card["net_cents"] == 5000
    assert sum(item["signed_cents"] for item in card["items"]) == -5000
    assert card["items"][0]["kind"] == "redirect"


def test_breakdown_hides_settled_transactions_and_shows_only_open_mutual_offset():
    # Old cycle: Bob (2) pays Rs. 50 for Alice (1), Alice pays Bob Rs. 50 and Bob confirms -> settled!
    login("bob@test.com")
    client.post("/api/expenses", json={
        "paid_by": 2, "section": "food", "item_name": "Old Lunch", "food_type": "kottu",
        "expense_date": "2026-11-20", "split_mode": "per_person", "per_person_cents": {"1": 5000},
    })
    login("alice@test.com")
    s_id = client.post("/api/settlements", json={"to_user": 2, "amount_cents": 5000}).json()["id"]
    login("bob@test.com")
    client.post(f"/api/settlements/{s_id}/confirm")

    # New unsettled cycle: Bob pays Rs. 50 for Alice, Alice pays Rs. 20 for Bob -> Net Rs. 30
    client.post("/api/expenses", json={
        "paid_by": 2, "section": "food", "item_name": "New Rice & Curry", "food_type": "rice_curry",
        "curry_type": "fish", "expense_date": "2026-11-20",
        "split_mode": "per_person", "per_person_cents": {"1": 5000},
    })
    login("alice@test.com")
    client.post("/api/expenses", json={
        "paid_by": 1, "section": "material", "item_name": "Dish Soap",
        "expense_date": "2026-11-20", "split_mode": "per_person", "per_person_cents": {"2": 2000},
    })

    # Alice's dropdown for Bob must show ONLY the 2 unsettled items (NOT Old Lunch, NOT Cash payment)
    alice_card = client.get("/api/bill/breakdown").json()["person_cards"][0]
    assert alice_card["net_cents"] == 3000
    assert alice_card["direction"] == "you_owe"
    titles = {item["title"] for item in alice_card["items"]}
    assert titles == {"New Rice & Curry", "Dish Soap"}
    assert sum(item["signed_cents"] for item in alice_card["items"]) == -3000

    # Bob's dropdown for Alice also shows ONLY those same 2 unsettled items (sum = +3000)
    login("bob@test.com")
    bob_card = client.get("/api/bill/breakdown").json()["person_cards"][0]
    assert bob_card["net_cents"] == 3000
    assert bob_card["direction"] == "owes_you"
    assert {item["title"] for item in bob_card["items"]} == {"New Rice & Curry", "Dish Soap"}
    assert sum(item["signed_cents"] for item in bob_card["items"]) == 3000