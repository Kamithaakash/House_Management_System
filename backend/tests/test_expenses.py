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
    for name, email, role in [
        ("Alice", "alice@test.com", "admin"),
        ("Bob", "bob@test.com", "member"),
        ("Charlie", "charlie@test.com", "member"),
    ]:
        db.add(User(
            name=name,
            email=email,
            password_hash=hash_password("StrongPass123!"),
            role=role,
        ))
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def login(email: str):
    client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"})


def test_equal_split_and_my_bill_privacy():
    # Bob (id=2) buys Electricity Bill Rs. 100.00 for Alice (1) and Bob (2) ONLY (Charlie excluded)
    login("bob@test.com")
    res = client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "electric_bill",
        "item_name": "March Electricity",
        "expense_date": "2026-11-20",
        "split_mode": "equal",
        "total_cents": 10000,
        "participant_ids": [1, 2],
    })
    assert res.status_code == 201
    assert res.json()["total_cents"] == 10000

    # Charlie (id=3) should NOT see this bill in his My Bill
    login("charlie@test.com")
    charlie_bill = client.get("/api/expenses/my-bill").json()
    assert charlie_bill["rows"] == []

    # Alice (id=1) sees Rs. 50.00 owed
    login("alice@test.com")
    alice_bill = client.get("/api/expenses/my-bill").json()
    assert len(alice_bill["rows"]) == 1
    assert alice_bill["total_you_owe_cents"] == 5000


def test_per_person_food_validation():
    login("bob@test.com")
    # Missing curry_type for rice_curry -> 422
    bad = client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "food",
        "item_name": "Lunch",
        "food_type": "rice_curry",
        "expense_date": "2026-11-20",
        "split_mode": "per_person",
        "per_person_cents": {"1": 45000, "2": 35000},
    })
    assert bad.status_code == 422

    # Valid rice_curry with curry_type -> 201
    good = client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "food",
        "item_name": "Lunch",
        "food_type": "rice_curry",
        "curry_type": "fish",
        "expense_date": "2026-11-20",
        "split_mode": "per_person",
        "per_person_cents": {"1": 45000, "2": 35000},
    })
    assert good.status_code == 201
    assert good.json()["total_cents"] == 80000


def test_only_creator_or_admin_can_delete():
    login("bob@test.com")
    exp_id = client.post("/api/expenses", json={
        "paid_by": 2,
        "section": "water_bill",
        "item_name": "Water",
        "expense_date": "2026-11-20",
        "split_mode": "equal",
        "total_cents": 2000,
        "participant_ids": [2, 3],
    }).json()["id"]

    # Charlie (not creator, not admin) tries to delete -> 403
    login("charlie@test.com")
    assert client.delete(f"/api/expenses/{exp_id}").status_code == 403

    # Bob (creator) deletes -> 200 and hidden from My Bill
    login("bob@test.com")
    assert client.delete(f"/api/expenses/{exp_id}").status_code == 200
    assert client.get("/api/expenses/my-bill").json()["rows"] == []