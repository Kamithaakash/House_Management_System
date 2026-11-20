from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.penalties import (
    HouseSettingsUpdate,
    MyPenaltiesResponse,
    ObligationFulfillRequest,
    ObligationResponse,
    PenaltyAddRequest,
    ReminderItemResponse,
)
from app.security import get_current_user, require_admin
from app.services import penalty_service

router = APIRouter(prefix="/api", tags=["Penalties & Reminders"])


@router.get("/penalties/me", response_model=MyPenaltiesResponse)
def my_penalties(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return penalty_service.get_my_penalties(db, current_user)


@router.put("/admin/settings")
def update_settings(
    data: HouseSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return penalty_service.update_house_settings(db, data, admin)


@router.post("/admin/penalties", response_model=MyPenaltiesResponse, status_code=status.HTTP_201_CREATED)
def add_penalty(
    data: PenaltyAddRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return penalty_service.add_penalty_points(db, data, admin)


@router.post("/admin/penalties/obligations/{obligation_id}/fulfill", response_model=ObligationResponse)
def fulfill_penalty(
    obligation_id: int,
    data: ObligationFulfillRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return penalty_service.fulfill_obligation(db, obligation_id, data, admin)


@router.get("/admin/reminders", response_model=list[ReminderItemResponse])
def get_reminders(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return penalty_service.generate_whatsapp_reminders(db)
