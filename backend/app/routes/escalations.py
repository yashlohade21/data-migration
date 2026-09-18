from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, Escalation, AuditLog, gen_id
from app.schemas import EscalationResponse, EscalationResolve

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["escalations"])


@router.get("/escalations", response_model=list[EscalationResponse])
def list_escalations(session_id: str, phase: str = None, status: str = None, db: DBSession = Depends(get_db)):
    query = db.query(Escalation).filter(Escalation.session_id == session_id)
    if phase:
        query = query.filter(Escalation.phase == phase)
    if status:
        query = query.filter(Escalation.status == status)
    return query.order_by(Escalation.created_at).all()


# IMPORTANT: batch route must be declared BEFORE the parameterized route
@router.put("/escalations/batch")
def batch_resolve(session_id: str, resolutions: list[dict] = Body(...), db: DBSession = Depends(get_db)):
    """Batch resolve multiple escalations at once."""
    resolved = []
    for res in resolutions:
        esc = db.query(Escalation).filter(
            Escalation.id == res.get("id"),
            Escalation.session_id == session_id,
        ).first()
        if esc:
            esc.status = res.get("status", "approved")
            esc.human_resolution = res.get("human_resolution")
            esc.resolved_at = datetime.utcnow()
            resolved.append(esc.id)

            db.add(AuditLog(
                id=gen_id(), session_id=session_id,
                action=f"escalation_{esc.status}", actor="human",
                phase=esc.phase,
                details={"escalation_id": esc.id, "rule": esc.rule},
            ))

    db.commit()
    return {"resolved": len(resolved)}


@router.put("/escalations/{escalation_id}", response_model=EscalationResponse)
def resolve_escalation(session_id: str, escalation_id: str, body: EscalationResolve, db: DBSession = Depends(get_db)):
    esc = db.query(Escalation).filter(
        Escalation.id == escalation_id,
        Escalation.session_id == session_id,
    ).first()
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")

    esc.status = body.status
    esc.human_resolution = body.human_resolution
    esc.resolved_at = datetime.utcnow()

    db.add(AuditLog(
        id=gen_id(),
        session_id=session_id,
        action=f"escalation_{body.status}",
        actor="human",
        phase=esc.phase,
        details={
            "escalation_id": escalation_id,
            "rule": esc.rule,
            "resolution": body.human_resolution,
        },
    ))

    db.commit()
    db.refresh(esc)
    return esc
