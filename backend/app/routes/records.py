from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import (
    Session, MigrationRecord, ColumnMapping, Escalation,
    AuditLog, PushResult,
)
from app.schemas import RecordResponse, MappingResponse, MappingUpdate, DeltaReport

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["records"])


@router.get("/records", response_model=list[RecordResponse])
def list_records(
    session_id: str,
    status: str = None,
    include_duplicates: bool = False,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: DBSession = Depends(get_db),
):
    query = db.query(MigrationRecord).filter(MigrationRecord.session_id == session_id)
    if status:
        query = query.filter(MigrationRecord.status == status)
    if not include_duplicates:
        query = query.filter(MigrationRecord.is_duplicate == 0)
    return query.offset(offset).limit(limit).all()


@router.get("/records/count")
def count_records(session_id: str, db: DBSession = Depends(get_db)):
    total = db.query(MigrationRecord).filter(MigrationRecord.session_id == session_id).count()
    active = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.is_duplicate == 0,
    ).count()
    duplicates = total - active
    return {"total": total, "active": active, "duplicates": duplicates}


@router.get("/mappings", response_model=list[MappingResponse])
def list_mappings(session_id: str, db: DBSession = Depends(get_db)):
    return db.query(ColumnMapping).filter(ColumnMapping.session_id == session_id).all()


@router.put("/mappings/{mapping_id}", response_model=MappingResponse)
def update_mapping(session_id: str, mapping_id: str, body: MappingUpdate, db: DBSession = Depends(get_db)):
    mapping = db.query(ColumnMapping).filter(
        ColumnMapping.id == mapping_id,
        ColumnMapping.session_id == session_id,
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if body.target_field is not None:
        mapping.human_override = body.target_field
    mapping.status = body.status
    db.commit()
    db.refresh(mapping)
    return mapping


@router.get("/delta", response_model=DeltaReport)
def get_delta_report(session_id: str, db: DBSession = Depends(get_db)):
    """Human vs AI contribution report."""
    total = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.is_duplicate == 0,
    ).count()

    # Count escalations by status
    all_esc = db.query(Escalation).filter(Escalation.session_id == session_id).all()

    total_escalations = len(all_esc)
    human_resolved = sum(1 for e in all_esc if e.status in ("approved", "rejected", "overridden"))
    ai_auto = sum(1 for e in all_esc if e.status == "auto_resolved")

    # Count audit log entries by actor
    ai_actions = db.query(AuditLog).filter(
        AuditLog.session_id == session_id,
        AuditLog.actor == "agent",
    ).count()
    human_actions = db.query(AuditLog).filter(
        AuditLog.session_id == session_id,
        AuditLog.actor == "human",
    ).count()

    # Mapping stats
    auto_mappings = db.query(ColumnMapping).filter(
        ColumnMapping.session_id == session_id,
        ColumnMapping.status == "auto_accepted",
    ).count()
    human_mappings = db.query(ColumnMapping).filter(
        ColumnMapping.session_id == session_id,
        ColumnMapping.status.in_(["human_approved", "human_overridden"]),
    ).count()

    # Phase breakdown
    phase_stats = {}
    for phase in ["map", "clean", "dedup", "validate"]:
        phase_esc = [e for e in all_esc if e.phase == phase]
        phase_stats[phase] = {
            "total_escalations": len(phase_esc),
            "human_resolved": sum(1 for e in phase_esc if e.status in ("approved", "rejected", "overridden")),
            "auto_resolved": sum(1 for e in phase_esc if e.status == "auto_resolved"),
        }

    # Count actual mapping + escalation decisions for accurate delta
    total_mapping_decisions = auto_mappings + human_mappings
    total_escalation_decisions = total_escalations
    # AI auto = auto-accepted mappings + auto-resolved escalations
    ai_decided = auto_mappings + ai_auto
    # Human decided = human mappings + human-resolved escalations
    human_decided = human_mappings + human_resolved
    total_decisions = max(ai_decided + human_decided, 1)
    ai_pct = round((ai_decided / total_decisions) * 100, 1)
    human_pct = round((human_decided / total_decisions) * 100, 1)

    return DeltaReport(
        total_records=total,
        ai_auto_resolved=ai_decided,
        human_resolved=human_decided,
        escalation_breakdown={
            "total": total_escalations,
            "by_rule": _count_by_rule(all_esc),
        },
        phase_stats=phase_stats,
        ai_contribution_pct=ai_pct,
        human_contribution_pct=human_pct,
    )


def _count_by_rule(escalations):
    counts = {}
    for e in escalations:
        counts[e.rule] = counts.get(e.rule, 0) + 1
    return counts


@router.get("/audit")
def get_audit_log(session_id: str, db: DBSession = Depends(get_db)):
    logs = db.query(AuditLog).filter(
        AuditLog.session_id == session_id,
    ).order_by(AuditLog.timestamp).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "actor": l.actor,
            "phase": l.phase,
            "details": l.details,
            "timestamp": l.timestamp.isoformat(),
        }
        for l in logs
    ]
