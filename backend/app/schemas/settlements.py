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


class PersonBreakdownItem(BaseModel):
    kind: str  # 'expense' | 'settlement' | 'redirect'
    item_date: str
    title: str
    subtitle: str
    signed_cents: int  # positive = in your favor, negative = you owe


class PersonBillCardResponse(BaseModel):
    other_user_id: int
    other_user_name: str
    direction: str  # 'you_owe' | 'owes_you'
    net_cents: int
    pending_sent_cents: int
    items: list[PersonBreakdownItem]


class BillBreakdownResponse(BaseModel):
    total_you_owe_cents: int
    total_owed_to_you_cents: int
    person_cards: list[PersonBillCardResponse]
    pending_settlements: list[SettlementResponse]
    history_settlements: list[SettlementResponse]
    redirect_notices: list[RedirectNoticeResponse]
    other_debts: list[DebtItemResponse]