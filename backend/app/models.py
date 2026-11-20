from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime,
    ForeignKey, Index, Integer, JSON, String, Text, text,
)
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


# 1. Users & Auth
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)          # Format: 94771234567
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), default="member", nullable=False)  # admin | member
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


# 2. Expenses
class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("total_cents > 0", name="ck_expense_total_positive"),
        Index("ix_expenses_paid_by_date", "paid_by", "expense_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    section = Column(String(20), nullable=False)       # food | boarding_fee | electric_bill | water_bill | material
    item_name = Column(String(150), nullable=False)
    food_type = Column(String(30), nullable=True)
    curry_type = Column(String(20), nullable=True)
    total_cents = Column(Integer, nullable=False)
    expense_date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete


# 3. Expense Splits
class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    __table_args__ = (
        CheckConstraint("share_cents >= 0", name="ck_split_share_non_negative"),
        Index("ix_splits_expense_user", "expense_id", "user_id"),
    )

    id = Column(Integer, primary_key=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    share_cents = Column(Integer, nullable=False)


# 4. Two-Party Settlements
class Settlement(Base):
    __tablename__ = "settlements"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_settlement_positive"),
        Index("ix_settlements_users_status", "from_user", "to_user", "status"),
    )

    id = Column(Integer, primary_key=True)
    from_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending | confirmed | rejected
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)


# 5. Manual Debt Redirects (initiated by middleman B)
class DebtTransfer(Base):
    __tablename__ = "debt_transfers"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_transfer_positive"),
    )

    id = Column(Integer, primary_key=True)
    from_debtor = Column(Integer, ForeignKey("users.id"), nullable=False)
    via_middleman = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_creditor = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


# 6. Cleaning Groups
class CleaningGroup(Base):
    __tablename__ = "cleaning_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    rotation_order = Column(Integer, unique=True, nullable=False)


# 7. Cleaning Group Members
class CleaningGroupMember(Base):
    __tablename__ = "cleaning_group_members"

    group_id = Column(Integer, ForeignKey("cleaning_groups.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)


# 8. Cleaning Turns (only ONE active/overdue/pending_approval turn allowed)
class CleaningTurn(Base):
    __tablename__ = "cleaning_turns"
    __table_args__ = (
        Index(
            "ix_one_open_cleaning_turn",
            text("(1)"),
            unique=True,
            postgresql_where=text("status IN ('active', 'overdue', 'pending_approval')"),
            sqlite_where=text("status IN ('active', 'overdue', 'pending_approval')"),
        ),
    )

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("cleaning_groups.id"), nullable=False)
    status = Column(String(20), nullable=False)  # active | overdue | pending_approval | completed
    due_date = Column(Date, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# 9. House Settings (single row, id=1)
class HouseSettings(Base):
    __tablename__ = "house_settings"

    id = Column(Integer, primary_key=True, default=1)
    penalty_threshold = Column(Integer, default=3, nullable=False)
    default_fine_cents = Column(Integer, default=50000, nullable=False)


# 10. Penalty Ledger (append-only)
class PenaltyLedger(Base):
    __tablename__ = "penalty_ledger"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    turn_id = Column(Integer, ForeignKey("cleaning_turns.id"), nullable=True)
    points = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


# 11. Penalty Obligations
class PenaltyObligation(Base):
    __tablename__ = "penalty_obligations"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    redemption_type = Column(String(20), nullable=True)   # cash | material
    amount_cents = Column(Integer, nullable=True)
    material_name = Column(String(100), nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending | fulfilled
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    fulfilled_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# 12. Audit Log (append-only)
class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)