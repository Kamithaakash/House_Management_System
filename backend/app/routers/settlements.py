from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.settlements import (
    BalancesOverviewResponse,
    DebtRedirectCreate,
    RedirectNoticeResponse,
    SettlementCreate,
    SettlementResponse,
)
from app.security import get_current_user
from app.services import settlement_service

router = APIRouter(prefix="/api", tags=["Balances & Settlements"])


@router.get("/balances", response_model=BalancesOverviewResponse)
def get_balances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settlement_service.get_balances_overview(db, current_user)


@router.post("/settlements", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
def submit_settlement(
    data: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settlement_service.create_settlement(db, data, current_user)


@router.post("/settlements/{settlement_id}/confirm", response_model=SettlementResponse)
def confirm_settlement(
    settlement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settlement_service.confirm_settlement(db, settlement_id, current_user)


@router.post("/settlements/{settlement_id}/reject", response_model=SettlementResponse)
def reject_settlement(
    settlement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settlement_service.reject_settlement(db, settlement_id, current_user)


@router.post("/settlements/redirect", response_model=RedirectNoticeResponse, status_code=status.HTTP_201_CREATED)
def redirect_debt(
    data: DebtRedirectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return settlement_service.redirect_debt(db, data, current_user)