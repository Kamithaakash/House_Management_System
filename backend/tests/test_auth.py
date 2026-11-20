import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import _failed_logins, hash_password

# Fast in-memory SQLite database just for testing
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
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    _failed_logins.clear()

    db = TestSessionLocal()
    db.add(User(
        name="Admin User",
        email="admin@test.com",
        phone="94771111111",
        password_hash=hash_password("AdminPass123!"),
        role="admin",
    ))
    db.add(User(
        name="Normal Member",
        email="member@test.com",
        phone="94772222222",
        password_hash=hash_password("MemberPass123!"),
        role="member",
    ))
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


def test_unauthenticated_blocked():
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_login_and_me():
    res = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "AdminPass123!"})
    assert res.status_code == 200
    assert res.json()["role"] == "admin"
    assert "password_hash" not in res.json()

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "admin@test.com"


def test_member_cannot_call_admin_route():
    client.post("/api/auth/login", json={"email": "member@test.com", "password": "MemberPass123!"})
    res = client.get("/api/admin/members")
    assert res.status_code == 403


def test_admin_can_create_member():
    client.post("/api/auth/login", json={"email": "admin@test.com", "password": "AdminPass123!"})
    res = client.post("/api/admin/members", json={
        "name": "Kasun",
        "email": "kasun@test.com",
        "phone": "94773333333",
        "password": "KasunPass123!",
        "role": "member",
    })
    assert res.status_code == 201
    assert res.json()["name"] == "Kasun"


def test_short_password_rejected():
    client.post("/api/auth/login", json={"email": "admin@test.com", "password": "AdminPass123!"})
    res = client.post("/api/admin/members", json={
        "name": "Weak",
        "email": "weak@test.com",
        "password": "123",
    })
    assert res.status_code == 422


def test_login_rate_limit():
    for _ in range(5):
        res = client.post("/api/auth/login", json={"email": "member@test.com", "password": "WrongPassword!"})
        assert res.status_code == 401

    blocked = client.post("/api/auth/login", json={"email": "member@test.com", "password": "MemberPass123!"})
    assert blocked.status_code == 429


def test_refresh_cookie_keeps_user_logged_in_and_logout_clears_both():
    login_res = client.post("/api/auth/login", json={"email": "member@test.com", "password": "MemberPass123!"})
    assert login_res.status_code == 200

    # Simulate short-lived access_token expiring while 30-day refresh_token remains
    client.cookies.delete("access_token")
    assert client.get("/api/auth/me").status_code == 401

    # Refresh rotates a new access_token cookie cleanly
    ref = client.post("/api/auth/refresh")
    assert ref.status_code == 200
    assert ref.json()["email"] == "member@test.com"
    assert client.get("/api/auth/me").status_code == 200

    # Logout clears both cookies
    assert client.post("/api/auth/logout").status_code == 200
    assert client.post("/api/auth/refresh").status_code == 401