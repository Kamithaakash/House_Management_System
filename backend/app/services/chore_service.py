from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import AuditLog, CleaningGroup, CleaningGroupMember, CleaningTurn, User
from app.schemas.chores import (
    ChoresOverviewResponse,
    CleaningGroupCreate,
    CleaningGroupResponse,
    CleaningTurnResponse,
)

OPEN_STATUSES = ("active", "overdue", "pending_approval")


def _get_next_group(db: Session, current_group_id: int) -> CleaningGroup:
    groups = db.query(CleaningGroup).order_by(CleaningGroup.rotation_order.asc()).all()
    if not groups:
        raise HTTPException(status_code=400, detail="No cleaning groups configured")

    for index, g in enumerate(groups):
        if g.id == current_group_id:
            return groups[(index + 1) % len(groups)]
    return groups[0]


def _create_turn_factory(group_id: int, today: date | None = None) -> CleaningTurn:
    """Factory pattern: builds a valid 7-day active cleaning turn."""
    start = today or date.today()
    return CleaningTurn(
        group_id=group_id,
        status="active",
        due_date=start + timedelta(days=7),
    )


def _sync_overdue_status(db: Session, today: date | None = None) -> CleaningTurn | None:
    """Auto-flips an active turn to 'overdue' if due_date has passed (blocks next group)."""
    open_turn = (
        db.query(CleaningTurn)
        .filter(CleaningTurn.status.in_(OPEN_STATUSES))
        .first()
    )
    if open_turn and open_turn.status == "active":
        check_date = today or date.today()
        if check_date > open_turn.due_date:
            open_turn.status = "overdue"
            db.commit()
            db.refresh(open_turn)
    return open_turn


def create_group(db: Session, data: CleaningGroupCreate, admin: User) -> CleaningGroupResponse:
    if len(set(data.member_ids)) != len(data.member_ids):
        raise HTTPException(status_code=422, detail="Duplicate member_ids are not allowed")

    existing_order = db.query(CleaningGroup).filter(CleaningGroup.rotation_order == data.rotation_order).first()
    if existing_order:
        raise HTTPException(status_code=409, detail="rotation_order already exists")

    users = db.query(User).filter(User.id.in_(data.member_ids), User.is_active.is_(True)).all()
    if len(users) != len(data.member_ids):
        raise HTTPException(status_code=400, detail="All members must be active users")

    group = CleaningGroup(name=data.name.strip(), rotation_order=data.rotation_order)
    db.add(group)
    db.flush()

    for uid in data.member_ids:
        db.add(CleaningGroupMember(group_id=group.id, user_id=uid))

    db.add(AuditLog(
        user_id=admin.id,
        action="create_cleaning_group",
        entity="cleaning_group",
        entity_id=group.id,
        details={"name": group.name, "rotation_order": group.rotation_order},
    ))
    db.commit()
    db.refresh(group)

    user_map = {u.id: u.name for u in users}
    return CleaningGroupResponse(
        id=group.id,
        name=group.name,
        rotation_order=group.rotation_order,
        member_ids=data.member_ids,
        member_names=[user_map[uid] for uid in data.member_ids],
    )


def start_cleaning_queue(db: Session, admin: User) -> CleaningTurnResponse:
    existing_open = db.query(CleaningTurn).filter(CleaningTurn.status.in_(OPEN_STATUSES)).first()
    if existing_open:
        raise HTTPException(status_code=409, detail="A cleaning turn is already open")

    first_group = db.query(CleaningGroup).order_by(CleaningGroup.rotation_order.asc()).first()
    if not first_group:
        raise HTTPException(status_code=400, detail="Create at least one cleaning group first")

    turn = _create_turn_factory(first_group.id)
    db.add(turn)
    db.commit()
    db.refresh(turn)

    return CleaningTurnResponse(
        id=turn.id,
        group_id=turn.group_id,
        group_name=first_group.name,
        status=turn.status,
        due_date=turn.due_date,
        completed_at=turn.completed_at,
        approved_by=turn.approved_by,
    )


def get_chores_overview(db: Session, today: date | None = None) -> ChoresOverviewResponse:
    open_turn = _sync_overdue_status(db, today=today)
    user_map = {u.id: u.name for u in db.query(User.id, User.name).all()}
    groups = db.query(CleaningGroup).order_by(CleaningGroup.rotation_order.asc()).all()
    group_map = {g.id: g.name for g in groups}

    members = db.query(CleaningGroupMember).all()
    members_by_group: dict[int, list[int]] = {}
    for m in members:
        members_by_group.setdefault(m.group_id, []).append(m.user_id)

    group_responses = [
        CleaningGroupResponse(
            id=g.id,
            name=g.name,
            rotation_order=g.rotation_order,
            member_ids=members_by_group.get(g.id, []),
            member_names=[user_map.get(uid, "Unknown") for uid in members_by_group.get(g.id, [])],
        )
        for g in groups
    ]

    turn_resp = None
    if open_turn:
        turn_resp = CleaningTurnResponse(
            id=open_turn.id,
            group_id=open_turn.group_id,
            group_name=group_map.get(open_turn.group_id, "Unknown"),
            status=open_turn.status,
            due_date=open_turn.due_date,
            completed_at=open_turn.completed_at,
            approved_by=open_turn.approved_by,
        )

    return ChoresOverviewResponse(current_turn=turn_resp, groups=group_responses)


def mark_turn_done(db: Session, turn_id: int, current_user: User) -> CleaningTurnResponse:
    turn = db.query(CleaningTurn).filter(CleaningTurn.id == turn_id).with_for_update().first()
    if not turn:
        raise HTTPException(status_code=404, detail="Cleaning turn not found")

    if turn.status not in ("active", "overdue"):
        raise HTTPException(status_code=409, detail="Turn cannot be marked done in its current state")

    is_group_member = (
        db.query(CleaningGroupMember)
        .filter(
            CleaningGroupMember.group_id == turn.group_id,
            CleaningGroupMember.user_id == current_user.id,
        )
        .first()
        is not None
    )
    if not is_group_member and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the active group or Admin can mark done")

    turn.status = "pending_approval"
    db.commit()
    db.refresh(turn)

    group = db.query(CleaningGroup).filter(CleaningGroup.id == turn.group_id).first()
    return CleaningTurnResponse(
        id=turn.id,
        group_id=turn.group_id,
        group_name=group.name if group else "Unknown",
        status=turn.status,
        due_date=turn.due_date,
        completed_at=turn.completed_at,
        approved_by=turn.approved_by,
    )


def approve_turn(db: Session, turn_id: int, current_user: User) -> CleaningTurnResponse:
    turn = db.query(CleaningTurn).filter(CleaningTurn.id == turn_id).with_for_update().first()
    if not turn:
        raise HTTPException(status_code=404, detail="Cleaning turn not found")

    if turn.status != "pending_approval":
        raise HTTPException(status_code=409, detail="Turn must be pending approval before approving")

    next_group = _get_next_group(db, turn.group_id)
    is_next_group_member = (
        next_group.id != turn.group_id
        and db.query(CleaningGroupMember)
        .filter(
            CleaningGroupMember.group_id == next_group.id,
            CleaningGroupMember.user_id == current_user.id,
        )
        .first()
        is not None
    )

    if current_user.role != "admin" and not is_next_group_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or a member of the next group can approve",
        )

    turn.status = "completed"
    turn.completed_at = datetime.now(timezone.utc)
    turn.approved_by = current_user.id

    # Create the next group's 7-day active turn
    next_turn = _create_turn_factory(next_group.id)
    db.add(next_turn)

    db.add(AuditLog(
        user_id=current_user.id,
        action="approve_cleaning_turn",
        entity="cleaning_turn",
        entity_id=turn.id,
        details={"completed_group_id": turn.group_id, "next_group_id": next_group.id},
    ))
    db.commit()
    db.refresh(next_turn)

    return CleaningTurnResponse(
        id=next_turn.id,
        group_id=next_turn.group_id,
        group_name=next_group.name,
        status=next_turn.status,
        due_date=next_turn.due_date,
        completed_at=next_turn.completed_at,
        approved_by=next_turn.approved_by,
    )
