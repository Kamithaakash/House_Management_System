from datetime import datetime, timezone
from urllib.parse import quote
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AuditLog, HouseSettings, PenaltyLedger, PenaltyObligation, User
from app.schemas.penalties import (
    HouseSettingsUpdate,
    MyPenaltiesResponse,
    ObligationFulfillRequest,
    ObligationResponse,
    PenaltyAddRequest,
    ReminderItemResponse,
)
from app.services.settlement_service import _compute_live_debts


def _get_or_create_settings(db: Session) -> HouseSettings:
    settings = db.query(HouseSettings).filter(HouseSettings.id == 1).first()
    if not settings:
        settings = HouseSettings(id=1, penalty_threshold=3, default_fine_cents=50000)
        db.add(settings)
        db.flush()
    return settings


def _get_active_points(db: Session, user_id: int) -> int:
    total = db.query(func.coalesce(func.sum(PenaltyLedger.points), 0)).filter(
        PenaltyLedger.user_id == user_id
    ).scalar()
    return int(total or 0)


def _to_obligation_response(ob: PenaltyObligation, user_name: str) -> ObligationResponse:
    return ObligationResponse(
        id=ob.id,
        user_id=ob.user_id,
        user_name=user_name,
        redemption_type=ob.redemption_type,
        amount_cents=ob.amount_cents,
        material_name=ob.material_name,
        status=ob.status,
        created_at=ob.created_at,
        fulfilled_at=ob.fulfilled_at,
    )


def _format_rs(cents: int) -> str:
    """Format integer cents to Rs. without float division."""
    return f"Rs. {cents // 100}.{cents % 100:02d}"


def get_house_settings(db: Session) -> dict:
    settings = _get_or_create_settings(db)
    db.commit()
    return {
        "penalty_threshold": settings.penalty_threshold,
        "default_fine_cents": settings.default_fine_cents,
    }


def update_house_settings(db: Session, data: HouseSettingsUpdate, admin: User) -> dict:
    settings = _get_or_create_settings(db)
    settings.penalty_threshold = data.penalty_threshold
    settings.default_fine_cents = data.default_fine_cents

    db.add(AuditLog(
        user_id=admin.id,
        action="update_house_settings",
        entity="house_settings",
        entity_id=1,
        details={"penalty_threshold": data.penalty_threshold, "default_fine_cents": data.default_fine_cents},
    ))
    db.commit()
    return {
        "penalty_threshold": settings.penalty_threshold,
        "default_fine_cents": settings.default_fine_cents,
    }


def add_penalty_points(db: Session, data: PenaltyAddRequest, admin: User) -> MyPenaltiesResponse:
    target = db.query(User).filter(User.id == data.user_id, User.is_active.is_(True)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    settings = _get_or_create_settings(db)

    entry = PenaltyLedger(
        user_id=data.user_id,
        turn_id=data.turn_id,
        points=data.points,
        reason=data.reason.strip(),
        created_by=admin.id,
    )
    db.add(entry)
    db.flush()

    total_points = _get_active_points(db, data.user_id)
    has_pending = (
        db.query(PenaltyObligation)
        .filter(PenaltyObligation.user_id == data.user_id, PenaltyObligation.status == "pending")
        .first()
        is not None
    )

    # Auto-create pending penalty obligation when threshold is reached
    if total_points >= settings.penalty_threshold and not has_pending:
        obligation = PenaltyObligation(
            user_id=data.user_id,
            amount_cents=settings.default_fine_cents,
            status="pending",
        )
        db.add(obligation)

    db.add(AuditLog(
        user_id=admin.id,
        action="add_penalty_points",
        entity="penalty_ledger",
        entity_id=entry.id,
        details={"target_user_id": data.user_id, "points": data.points, "total_points": total_points},
    ))
    db.commit()

    return get_my_penalties(db, target)


def fulfill_obligation(
    db: Session, obligation_id: int, data: ObligationFulfillRequest, admin: User
) -> ObligationResponse:
    ob = db.query(PenaltyObligation).filter(PenaltyObligation.id == obligation_id).with_for_update().first()
    if not ob:
        raise HTTPException(status_code=404, detail="Penalty obligation not found")

    if ob.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Obligation is already fulfilled")

    if data.redemption_type == "material" and not data.material_name:
        raise HTTPException(status_code=422, detail="material_name is required for material redemption")

    settings = _get_or_create_settings(db)

    ob.redemption_type = data.redemption_type
    ob.material_name = data.material_name.strip() if data.material_name else None
    ob.status = "fulfilled"
    ob.fulfilled_at = datetime.now(timezone.utc)
    ob.verified_by = admin.id

    # Append reversing entry to penalty_ledger
    db.add(PenaltyLedger(
        user_id=ob.user_id,
        points=-settings.penalty_threshold,
        reason=f"Penalty obligation #{ob.id} fulfilled ({data.redemption_type})",
        created_by=admin.id,
    ))
    db.add(AuditLog(
        user_id=admin.id,
        action="fulfill_penalty_obligation",
        entity="penalty_obligation",
        entity_id=ob.id,
        details={"redemption_type": data.redemption_type, "material_name": ob.material_name},
    ))
    db.commit()
    db.refresh(ob)

    user = db.query(User).filter(User.id == ob.user_id).first()
    return _to_obligation_response(ob, user.name if user else "Unknown")


def list_pending_obligations(db: Session) -> list[ObligationResponse]:
    """Admin view: all penalty obligations that still need to be fulfilled."""
    user_map = {u.id: u.name for u in db.query(User.id, User.name).all()}
    rows = (
        db.query(PenaltyObligation)
        .filter(PenaltyObligation.status == "pending")
        .order_by(PenaltyObligation.created_at.asc())
        .all()
    )
    return [_to_obligation_response(ob, user_map.get(ob.user_id, "Unknown")) for ob in rows]


def get_my_penalties(db: Session, user: User) -> MyPenaltiesResponse:
    settings = _get_or_create_settings(db)
    active_points = _get_active_points(db, user.id)
    obligations = (
        db.query(PenaltyObligation)
        .filter(PenaltyObligation.user_id == user.id)
        .order_by(PenaltyObligation.created_at.desc())
        .all()
    )
    return MyPenaltiesResponse(
        active_points=active_points,
        threshold=settings.penalty_threshold,
        obligations=[_to_obligation_response(ob, user.name) for ob in obligations],
    )


def generate_whatsapp_reminders(db: Session) -> list[ReminderItemResponse]:
    """Builder pattern: combines all debts + pending penalties into 1 message per debtor."""
    all_users = db.query(User).all()
    name_by_id = {u.id: u.name for u in all_users}
    active_by_id = {u.id: u for u in all_users if u.is_active}

    live_debts = _compute_live_debts(db)
    debts_by_user: dict[int, list[tuple[str, int]]] = {}
    for from_u, to_u, amount in live_debts:
        creditor_name = name_by_id.get(to_u, "Unknown")
        debts_by_user.setdefault(from_u, []).append((creditor_name, amount))

    pending_obs = db.query(PenaltyObligation).filter(PenaltyObligation.status == "pending").all()
    obs_by_user: dict[int, list[PenaltyObligation]] = {}
    for ob in pending_obs:
        obs_by_user.setdefault(ob.user_id, []).append(ob)

    affected_user_ids = sorted(set(debts_by_user.keys()) | set(obs_by_user.keys()))
    reminders = []

    for uid in affected_user_ids:
        user = active_by_id.get(uid)
        if not user:
            continue

        lines = [f"Hi {user.name}, Boarding House Reminder:"]

        for creditor_name, amount in debts_by_user.get(uid, []):
            lines.append(f"- You owe {creditor_name}: {_format_rs(amount)}")

        for ob in obs_by_user.get(uid, []):
            fine = _format_rs(ob.amount_cents) if ob.amount_cents else "fine"
            lines.append(f"- Pending Cleaning Penalty: pay {fine} or bring cleaning materials.")

        message = "\n".join(lines)
        wa_url = f"https://wa.me/{user.phone}?text={quote(message)}" if user.phone else None

        reminders.append(
            ReminderItemResponse(
                user_id=user.id,
                name=user.name,
                phone=user.phone,
                message=message,
                wa_me_url=wa_url,
            )
        )

    return reminders
