from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AuditLog, User
from app.schemas.auth import (
    AdminMemberResponse,
    CreateMemberRequest,
    LoginRequest,
    MemberOptionResponse,
    UserResponse,
)
from app.security import (
    COOKIE_NAME,
    check_rate_limit,
    clear_failed_logins,
    create_access_token,
    get_current_user,
    hash_password,
    record_failed_login,
    require_admin,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["Auth & Members"])
settings = get_settings()


@router.post("/auth/login", response_model=UserResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_ip = forwarded or (request.client.host if request.client else "unknown")
    clean_email = data.email.strip().lower()
    rate_key = f"{client_ip}:{clean_email}"
    check_rate_limit(rate_key)

    user = db.query(User).filter(User.email == clean_email).first()

    # Generic error message prevents attackers from guessing which emails exist
    if not user or not verify_password(data.password, user.password_hash) or not user.is_active:
        record_failed_login(rate_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    clear_failed_logins(rate_key)
    token = create_access_token(user.id)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=1800,  # 30 minutes
    )
    return user


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
    )
    return {"detail": "Logged out"}


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/members", response_model=list[MemberOptionResponse])
def list_active_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(User).filter(User.is_active.is_(True)).order_by(User.id).all()


@router.post("/admin/members", response_model=AdminMemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(
    data: CreateMemberRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    clean_email = data.email.strip().lower()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    new_user = User(
        name=data.name.strip(),
        email=clean_email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(new_user)
    db.flush()  # gets new_user.id before commit

    db.add(
        AuditLog(
            user_id=admin.id,
            action="create_member",
            entity="user",
            entity_id=new_user.id,
            details={"email": new_user.email, "role": new_user.role},
        )
    )
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/admin/members", response_model=list[AdminMemberResponse])
def admin_list_members(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.id).all()