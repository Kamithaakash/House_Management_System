from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

from app.constants import MAX_AMOUNT_CENTS


class HouseSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    penalty_threshold: int = Field(ge=1, le=20)
    default_fine_cents: int = Field(gt=0, le=MAX_AMOUNT_CENTS)


class PenaltyAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int = Field(gt=0)
    turn_id: int | None = Field(default=None, gt=0)
    points: int = Field(ge=1, le=10)
    reason: str = Field(min_length=2, max_length=300)


class ObligationFulfillRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    redemption_type: Literal["cash", "material"]
    material_name: str | None = Field(default=None, min_length=1, max_length=100)


class ObligationResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    redemption_type: str | None
    amount_cents: int | None
    material_name: str | None
    status: str
    created_at: datetime
    fulfilled_at: datetime | None


class MyPenaltiesResponse(BaseModel):
    active_points: int
    threshold: int
    obligations: list[ObligationResponse]


class ReminderItemResponse(BaseModel):
    user_id: int
    name: str
    phone: str | None
    message: str
    wa_me_url: str | None
