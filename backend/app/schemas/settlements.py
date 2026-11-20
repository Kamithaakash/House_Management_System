from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.constants import MAX_AMOUNT_CENTS


class SettlementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to_user: int = Field(gt=0)
    amount_cents: int = Field(gt=0, le=MAX_AMOUNT_CENTS)


class DebtRedirectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_debtor: int = Field(gt=0)   # Person A (who owes you)
    to_creditor: int = Field(gt=0)   # Person C (whom you owe)
    amount_cents: int = Field(gt=0, le=MAX_AMOUNT_CENTS)


class DebtItemResponse(BaseModel):
    from_user: int
    from_name: str
    to_user: int
    to_name: str
    amount_cents: int


class SettlementResponse(BaseModel):
    id: int
    from_user: int
    from_name: str
    to_user: int
    to_name: str
    amount_cents: int
    status: str
    created_at: datetime
    confirmed_at: datetime | None


class RedirectNoticeResponse(BaseModel):
    id: int
    from_debtor: int
    from_debtor_name: str
    via_middleman: int
    via_middleman_name: str
    to_creditor: int
    to_creditor_name: str
    amount_cents: int
    message: str
    created_at: datetime


class BalancesOverviewResponse(BaseModel):
    debts: list[DebtItemResponse]
    pending_settlements: list[SettlementResponse]
    redirect_notices: list[RedirectNoticeResponse]