import os
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models import Session, UploadedFile, MigrationRecord, gen_id
from app.schemas import FileResponse
from app.services.file_parser import parse_file
from app.config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB

logger = logging.getLogger("migration.upload")

MAX_FILES_PER_UPLOAD = 10

router = APIRouter(prefix="/api/sessions/{session_id}", tags=["upload"])


@router.post("/upload", response_model=list[FileResponse])
async def upload_files(session_id: str, files: list[UploadFile] = File(...), db: DBSession = Depends(get_db)):
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_PER_UPLOAD} files per upload")

    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    results = []
    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            raise HTTPException(status_code=400, detail=f"Unsupported file: {file.filename}")

        file_id = gen_id()
        filepath = os.path.join(session_dir, f"{file_id}{ext}")

        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File too large: {file.filename} (max {MAX_UPLOAD_SIZE_MB} MB)")
        with open(filepath, "wb") as f:
            f.write(content)

        try:
            df, columns = parse_file(filepath)
        except Exception as e:
            logger.error("Failed to parse %s: %s", file.filename, e)
            os.remove(filepath)
            raise HTTPException(status_code=400, detail=f"Failed to parse {file.filename}. Please check the file format.")

        uploaded = UploadedFile(
            id=file_id,
            session_id=session_id,
            filename=file.filename,
            filepath=filepath,
            file_type=ext.lstrip("."),
            row_count=len(df),
            columns=columns,
        )
        db.add(uploaded)

        # Create raw migration records
        for idx, row in df.iterrows():
            record = MigrationRecord(
                id=gen_id(),
                session_id=session_id,
                source_file_id=file_id,
                source_row_index=idx,
                raw_data=row.to_dict(),
                status="raw",
            )
            db.add(record)

        results.append(uploaded)

    session.status = "uploading"
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/files", response_model=list[FileResponse])
def list_files(session_id: str, db: DBSession = Depends(get_db)):
    return db.query(UploadedFile).filter(UploadedFile.session_id == session_id).all()
