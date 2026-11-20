from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=1, max_length=128)


class CreateMemberRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=150)
    phone: str | None = Field(default=None, pattern=r"^94\d{9}$")
    password: str = Field(min_length=10, max_length=128)
    role: Literal["admin", "member"] = "member"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    is_active: bool


class MemberOptionResponse(BaseModel):
    """Safe list for expense checkboxes (no email or phone leaked)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class AdminMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    role: str
    is_active: bool