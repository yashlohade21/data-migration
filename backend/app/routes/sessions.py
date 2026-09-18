from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, gen_id
from app.schemas import SessionCreate, SessionResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
def create_session(body: SessionCreate, db: DBSession = Depends(get_db)):
    session = Session(id=gen_id(), name=body.name, stats={})
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionResponse])
def list_sessions(db: DBSession = Depends(get_db)):
    return db.query(Session).order_by(Session.created_at.desc()).all()


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
