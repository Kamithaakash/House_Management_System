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
    db.add(User(
        name="Admin",
        email="admin@test.com",
        phone="94770000001",
        password_hash=hash_password("StrongPass123!"),
        role="admin",
    ))
    db.add(User(
        name="Kasun",
        email="kasun@test.com",
        phone="94771234567",
        password_hash=hash_password("StrongPass123!"),
        role="member",
    ))
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def login(email: str):
    client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"})


def test_penalty_trigger_fulfill_and_reminders():
    # Admin gives Kasun (id=2) 3 penalty points -> pending obligation auto-created
    login("admin@test.com")
    for i in range(3):
        res = client.post("/api/admin/penalties", json={
            "user_id": 2,
            "points": 1,
            "reason": f"Missed turn #{i + 1}",
        })
        assert res.status_code == 201

    kasun_penalties = res.json()
    assert kasun_penalties["active_points"] == 3
    assert len(kasun_penalties["obligations"]) == 1
    ob_id = kasun_penalties["obligations"][0]["id"]
    assert kasun_penalties["obligations"][0]["status"] == "pending"

    # Admin can list all pending obligations; a member cannot
    pending = client.get("/api/admin/penalties/obligations").json()
    assert len(pending) == 1 and pending[0]["user_name"] == "Kasun"

    # Admin adds an expense where Admin (1) paid Rs. 100 for Kasun (2)
    client.post("/api/expenses", json={
        "paid_by": 1,
        "section": "material",
        "item_name": "Soap",
        "expense_date": "2026-11-20",
        "split_mode": "per_person",
        "per_person_cents": {"2": 10000},
    })

    # Admin generates WhatsApp reminders -> ONE combined message for Kasun
    reminders = client.get("/api/admin/reminders").json()
    assert len(reminders) == 1
    assert reminders[0]["name"] == "Kasun"
    assert "You owe Admin: Rs. 100.00" in reminders[0]["message"]
    assert "Pending Cleaning Penalty" in reminders[0]["message"]
    assert reminders[0]["wa_me_url"].startswith("https://wa.me/94771234567?text=")

    # Admin fulfills obligation with material ("Harpic") -> points reset to 0
    fulfill = client.post(f"/api/admin/penalties/obligations/{ob_id}/fulfill", json={
        "redemption_type": "material",
        "material_name": "Harpic",
    })
    assert fulfill.status_code == 200
    assert fulfill.json()["status"] == "fulfilled"

    # Double-fulfill blocked -> 409
    assert client.post(f"/api/admin/penalties/obligations/{ob_id}/fulfill", json={
        "redemption_type": "cash",
    }).status_code == 409

    # Kasun checks his penalties -> active points reset to 0
    login("kasun@test.com")
    me = client.get("/api/penalties/me").json()
    assert me["active_points"] == 0

    # Security: member cannot call admin reminders -> 403
    assert client.get("/api/admin/reminders").status_code == 403
