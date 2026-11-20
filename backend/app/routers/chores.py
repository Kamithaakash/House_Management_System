from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.chores import (
    ChoresOverviewResponse,
    CleaningGroupCreate,
    CleaningGroupResponse,
    CleaningTurnResponse,
)
from app.security import get_current_user, require_admin
from app.services import chore_service

router = APIRouter(prefix="/api", tags=["Cleaning Queue"])


@router.post("/admin/cleaning/groups", response_model=CleaningGroupResponse, status_code=status.HTTP_201_CREATED)
def create_cleaning_group(
    data: CleaningGroupCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return chore_service.create_group(db, data, admin)


@router.post("/admin/cleaning/start", response_model=CleaningTurnResponse, status_code=status.HTTP_201_CREATED)
def start_queue(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return chore_service.start_cleaning_queue(db, admin)


@router.get("/chores", response_model=ChoresOverviewResponse)
def get_chores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chore_service.get_chores_overview(db)


@router.post("/chores/{turn_id}/mark-done", response_model=CleaningTurnResponse)
def mark_done(
    turn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chore_service.mark_turn_done(db, turn_id, current_user)


@router.post("/chores/{turn_id}/approve", response_model=CleaningTurnResponse)
def approve(
    turn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return chore_service.approve_turn(db, turn_id, current_user)
