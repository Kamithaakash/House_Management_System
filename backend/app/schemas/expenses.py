from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

from app.constants import CurryType, FoodType, MAX_AMOUNT_CENTS, Section


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    paid_by: int = Field(gt=0)
    section: Section
    item_name: str = Field(min_length=1, max_length=150)
    food_type: FoodType | None = None
    curry_type: CurryType | None = None
    expense_date: date
    split_mode: Literal["equal", "per_person"]

    # Used when split_mode == "equal"
    total_cents: int | None = Field(default=None, gt=0, le=MAX_AMOUNT_CENTS)
    participant_ids: list[int] | None = Field(default=None, min_length=1)

    # Used when split_mode == "per_person" (e.g. {"1": 45000, "2": 35000})
    per_person_cents: dict[int, int] | None = None


class ExpenseUpdate(ExpenseCreate):
    pass


class SplitItemResponse(BaseModel):
    user_id: int
    user_name: str
    share_cents: int


class ExpenseResponse(BaseModel):
    id: int
    paid_by: int
    paid_by_name: str
    section: str
    item_name: str
    food_type: str | None
    curry_type: str | None
    total_cents: int
    expense_date: date
    created_by: int
    splits: list[SplitItemResponse]


class MyBillRow(BaseModel):
    expense_id: int
    expense_date: date
    created_at: datetime | None = None
    section: str
    item_name: str
    paid_by_name: str
    total_cents: int
    your_share_cents: int
    you_paid: bool
    can_delete: bool


class MyBillResponse(BaseModel):
    rows: list[MyBillRow]
    total_you_owe_cents: int
    total_owed_to_you_cents: int
    net_cents: int