from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class CleaningGroupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=50)
    rotation_order: int = Field(gt=0)
    member_ids: list[int] = Field(min_length=1)


class CleaningGroupResponse(BaseModel):
    id: int
    name: str
    rotation_order: int
    member_ids: list[int]
    member_names: list[str]


class CleaningTurnResponse(BaseModel):
    id: int
    group_id: int
    group_name: str
    status: str
    due_date: date
    completed_at: datetime | None
    approved_by: int | None


class ChoresOverviewResponse(BaseModel):
    current_turn: CleaningTurnResponse | None
    groups: list[CleaningGroupResponse]
