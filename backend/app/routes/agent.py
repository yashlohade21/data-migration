import asyncio
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from sse_starlette.sse import EventSourceResponse
from app.database import get_db
from app.models import Session
from app.agent.orchestrator import run_agent, resume_agent, get_event_queue, emit, cleanup_event_queue

logger = logging.getLogger("migration.agent")


def _json_default(obj):
    """Handle datetime and other non-serializable types in SSE data."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["agent"])


class RunRequest(BaseModel):
    autonomy_level: str = "balanced"


@router.post("/run")
async def start_agent(session_id: str, body: RunRequest = RunRequest(), background_tasks: BackgroundTasks = None, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "processing":
        raise HTTPException(status_code=400, detail="Agent already running")

    if body.autonomy_level not in ("conservative", "balanced", "aggressive"):
        raise HTTPException(status_code=400, detail="Invalid autonomy level")

    session.autonomy_level = body.autonomy_level
    db.commit()

    logger.info("Starting agent for session %s (autonomy=%s)", session_id, body.autonomy_level)
    loop = asyncio.get_event_loop()
    loop.create_task(run_agent(session_id))

    return {"status": "started", "session_id": session_id}


@router.post("/cancel")
async def cancel_agent(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "cancelled"
    db.commit()

    async def _emit_and_cleanup():
        await emit(session_id, "cancelled", {"message": "Agent cancelled by user"})
        await asyncio.sleep(2)
        cleanup_event_queue(session_id)

    loop = asyncio.get_event_loop()
    loop.create_task(_emit_and_cleanup())

    return {"status": "cancelled", "session_id": session_id}


@router.post("/resume")
async def resume(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logger.info("Resuming agent for session %s", session_id)
    loop = asyncio.get_event_loop()
    loop.create_task(resume_agent(session_id))

    return {"status": "resumed", "session_id": session_id}


@router.get("/stream")
async def stream_events(session_id: str):
    queue = get_event_queue(session_id)

    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield {
                    "event": event.get("event", "message"),
                    "data": json.dumps(event.get("data", {}), default=_json_default),
                }
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}

    return EventSourceResponse(event_generator())
