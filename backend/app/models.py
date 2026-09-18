import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON, ForeignKey, Enum as SAEnum
from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    status = Column(String, default="created")  # created, uploading, processing, awaiting_review, pushing, completed, error
    current_phase = Column(String, default="idle")  # idle, ingest, map, clean, dedup, validate, push
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    autonomy_level = Column(String, default="balanced")
    stats = Column(JSON, default=dict)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    file_type = Column(String)  # csv, xlsx
    row_count = Column(Integer, default=0)
    columns = Column(JSON, default=list)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class ColumnMapping(Base):
    __tablename__ = "column_mappings"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    file_id = Column(String, ForeignKey("uploaded_files.id"), nullable=False)
    source_column = Column(String, nullable=False)
    target_field = Column(String, nullable=True)  # null = unmapped
    confidence = Column(Float, default=0.0)
    ai_reasoning = Column(Text, default="")
    status = Column(String, default="pending")  # pending, auto_accepted, escalated, human_approved, human_overridden
    human_override = Column(String, nullable=True)


class MigrationRecord(Base):
    __tablename__ = "migration_records"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    source_file_id = Column(String, ForeignKey("uploaded_files.id"), nullable=False)
    source_row_index = Column(Integer)
    raw_data = Column(JSON)
    mapped_data = Column(JSON)
    cleaned_data = Column(JSON)
    final_data = Column(JSON)
    status = Column(String, default="raw")  # raw, mapped, cleaned, deduplicated, validated, pushed, error
    is_duplicate = Column(Integer, default=0)
    duplicate_of = Column(String, nullable=True)
    validation_errors = Column(JSON, default=list)
    push_status = Column(String, nullable=True)  # success, failed, retrying


class Escalation(Base):
    __tablename__ = "escalations"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    phase = Column(String, nullable=False)  # map, clean, dedup, validate
    rule = Column(String, nullable=False)  # ambiguous_mapping, ambiguous_date, duplicate_conflict, validation_fail, unknown_enum, missing_required
    severity = Column(String, default="medium")  # low, medium, high
    description = Column(Text)
    context = Column(JSON)  # extra data for UI display
    ai_suggestion = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected, overridden
    human_resolution = Column(Text, nullable=True)
    record_id = Column(String, nullable=True)
    mapping_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    action = Column(String, nullable=False)
    actor = Column(String, default="agent")  # agent, human
    phase = Column(String, nullable=True)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow)


class PushResult(Base):
    __tablename__ = "push_results"
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    record_id = Column(String, ForeignKey("migration_records.id"), nullable=False)
    attempt = Column(Integer, default=1)
    status = Column(String)  # success, failed
    response = Column(JSON, default=dict)
    pushed_at = Column(DateTime, default=datetime.utcnow)
