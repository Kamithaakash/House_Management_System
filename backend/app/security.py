import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
password_hasher = PasswordHash.recommended()  # Uses Argon2id

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"

# Simple in-memory login rate limiter: key -> list of failed attempt timestamps
_failed_logins: dict[str, list[float]] = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
WINDOW_SECONDS = 60


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str = "access") -> int | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            return None
        user_id = payload.get("sub")
        return int(user_id) if user_id is not None else None
    except (jwt.PyJWTError, ValueError):
        return None


def decode_access_token(token: str) -> int | None:
    return decode_token(token, expected_type="access")


def decode_refresh_token(token: str) -> int | None:
    return decode_token(token, expected_type="refresh")


def check_rate_limit(key: str) -> None:
    """Block if more than 5 failed login attempts happen within 60 seconds."""
    now = time.time()
    recent = [t for t in _failed_logins[key] if now - t < WINDOW_SECONDS]
    _failed_logins[key] = recent
    if len(recent) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 1 minute.",
        )


def record_failed_login(key: str) -> None:
    _failed_logins[key].append(time.time())


def clear_failed_logins(key: str) -> None:
    _failed_logins.pop(key, None)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Guard: reads JWT from HttpOnly cookie and verifies the user is active."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Guard: allows Admin role only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user