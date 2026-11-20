from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import CleaningTurn, User
from app.security import _failed_logins, hash_password
from app.services.chore_service import get_chores_overview

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
        ("Admin", "admin@test.com", "admin"),
        ("Member1", "m1@test.com", "member"),
        ("Member2", "m2@test.com", "member"),
    ]:
        db.add(User(name=name, email=email, password_hash=hash_password("StrongPass123!"), role=role))
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def login(email: str):
    client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"})


def test_blocking_cleaning_and_next_group_approval():
    # Admin creates Group 1 (Member1, id=2) and Group 2 (Member2, id=3) and starts queue
    login("admin@test.com")
    client.post("/api/admin/cleaning/groups", json={"name": "Group 1", "rotation_order": 1, "member_ids": [2]})
    client.post("/api/admin/cleaning/groups", json={"name": "Group 2", "rotation_order": 2, "member_ids": [3]})
    turn1 = client.post("/api/admin/cleaning/start").json()
    assert turn1["status"] == "active"

    # Simulate 8 days passing without approval -> Group 1 flips to overdue, Group 2 NOT created
    db = TestSessionLocal()
    overview = get_chores_overview(db, today=date.today() + timedelta(days=8))
    assert overview.current_turn.status == "overdue"
    assert db.query(CleaningTurn).count() == 1
    db.close()

    # Member1 marks Group 1 as done
    login("m1@test.com")
    res = client.post(f"/api/chores/{turn1['id']}/mark-done")
    assert res.status_code == 200
    assert res.json()["status"] == "pending_approval"

    # Security: Member1 CANNOT approve their own group -> 403
    assert client.post(f"/api/chores/{turn1['id']}/approve").status_code == 403

    # Member2 (next group) approves -> Group 2 gets active turn!
    login("m2@test.com")
    next_turn = client.post(f"/api/chores/{turn1['id']}/approve").json()
    assert next_turn["group_name"] == "Group 2"
    assert next_turn["status"] == "active"

    # Second cycle also completes cleanly (multiple completed turns allowed by DB index)
    assert client.post(f"/api/chores/{next_turn['id']}/mark-done").status_code == 200
    login("m1@test.com")
    turn3 = client.post(f"/api/chores/{next_turn['id']}/approve").json()
    assert turn3["group_name"] == "Group 1"
    assert turn3["status"] == "active"
