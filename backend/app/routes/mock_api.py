"""Push routes — send validated records to mock target API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, MigrationRecord, PushResult, AuditLog, gen_id
from app.services.mock_target import push_record
from app.schemas import PushResultResponse

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["push"])

MAX_RETRIES = 2


@router.post("/push")
def push_records(session_id: str, db: DBSession = Depends(get_db)):
    """Push all validated records to mock target API."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.status == "validated",
        MigrationRecord.is_duplicate == 0,
    ).all()

    if not records:
        raise HTTPException(status_code=400, detail="No records ready to push")

    session.status = "pushing"
    session.current_phase = "push"
    db.commit()

    success_count = 0
    fail_count = 0

    for rec in records:
        data = rec.final_data or rec.cleaned_data or {}
        result = push_record(data)

        attempt = 1
        while not result["success"] and attempt < MAX_RETRIES:
            attempt += 1
            result = push_record(data)

        pr = PushResult(
            id=gen_id(),
            session_id=session_id,
            record_id=rec.id,
            attempt=attempt,
            status="success" if result["success"] else "failed",
            response=result,
        )
        db.add(pr)

        rec.push_status = "success" if result["success"] else "failed"
        rec.status = "pushed" if result["success"] else "error"

        if result["success"]:
            success_count += 1
        else:
            fail_count += 1

    session.status = "completed"
    session.stats = {
        **(session.stats or {}),
        "pushed": success_count,
        "failed": fail_count,
        "total": len(records),
    }
    db.add(AuditLog(
        id=gen_id(), session_id=session_id,
        action="push_complete", actor="agent", phase="push",
        details={"success": success_count, "failed": fail_count},
    ))
    db.commit()

    return {
        "total": len(records),
        "success": success_count,
        "failed": fail_count,
    }


@router.post("/push/retry")
def retry_failed(session_id: str, db: DBSession = Depends(get_db)):
    """Retry pushing failed records."""
    records = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.push_status == "failed",
    ).all()

    success_count = 0
    fail_count = 0

    for rec in records:
        data = rec.final_data or rec.cleaned_data or {}
        result = push_record(data)

        pr = PushResult(
            id=gen_id(),
            session_id=session_id,
            record_id=rec.id,
            attempt=3,  # retry attempt
            status="success" if result["success"] else "failed",
            response=result,
        )
        db.add(pr)

        rec.push_status = "success" if result["success"] else "failed"
        rec.status = "pushed" if result["success"] else "error"

        if result["success"]:
            success_count += 1
        else:
            fail_count += 1

    db.commit()
    return {"retried": len(records), "success": success_count, "failed": fail_count}


@router.get("/push/results", response_model=list[PushResultResponse])
def list_push_results(session_id: str, db: DBSession = Depends(get_db)):
    return db.query(PushResult).filter(PushResult.session_id == session_id).all()
