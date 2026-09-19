"""Main agent orchestrator — runs all phases, emits SSE events."""
import asyncio
import json
import logging
from datetime import datetime

logger = logging.getLogger("migration.orchestrator")
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.orm.attributes import flag_modified
from app.database import SessionLocal
from app.models import (
    Session, UploadedFile, ColumnMapping, MigrationRecord,
    Escalation, AuditLog, gen_id,
)
from app.config import CONFIDENCE_AUTO_ACCEPT, CONFIDENCE_ESCALATE, AUTONOMY_PRESETS
from app.agent.schema_mapper import map_columns
from app.agent.data_cleaner import clean_record
from app.agent.validator import validate_record, attempt_auto_fix
from app.agent.escalation_engine import (
    evaluate_mapping_escalation,
    evaluate_date_escalation,
    evaluate_dedup_escalation,
    evaluate_validation_escalation,
)
from app.services.dedup_service import find_duplicates

# Global event queues per session
_event_queues: dict[str, asyncio.Queue] = {}


def get_event_queue(session_id: str) -> asyncio.Queue:
    if session_id not in _event_queues:
        _event_queues[session_id] = asyncio.Queue()
    return _event_queues[session_id]


def cleanup_event_queue(session_id: str):
    """Remove event queue for a completed/errored/cancelled session."""
    _event_queues.pop(session_id, None)


async def emit(session_id: str, event_type: str, data: dict):
    q = get_event_queue(session_id)
    try:
        await q.put({"event": event_type, "data": data})
    except Exception:
        logger.warning("Failed to emit event %s for session %s", event_type, session_id)


def _is_cancelled(session_id: str, db: DBSession) -> bool:
    """Check if the session has been cancelled."""
    db.expire_all()
    session = db.query(Session).filter(Session.id == session_id).first()
    return session is not None and session.status == "cancelled"


def _log(db: DBSession, session_id: str, action: str, actor: str = "agent", phase: str = None, details: dict = None):
    db.add(AuditLog(id=gen_id(), session_id=session_id, action=action, actor=actor, phase=phase, details=details or {}))
    db.commit()


async def run_agent(session_id: str):
    """Main agent loop — runs all migration phases."""
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        session.status = "processing"
        db.commit()
        logger.info("Agent started for session %s", session_id)

        # Clear stale data from any previous run
        db.query(Escalation).filter(Escalation.session_id == session_id).delete()
        db.query(ColumnMapping).filter(ColumnMapping.session_id == session_id).delete()
        db.query(AuditLog).filter(AuditLog.session_id == session_id).delete()
        # Reset records to raw state
        db.query(MigrationRecord).filter(MigrationRecord.session_id == session_id).update({
            "status": "raw", "mapped_data": None, "cleaned_data": None,
            "final_data": None, "is_duplicate": 0, "duplicate_of": None,
            "validation_errors": [], "push_status": None,
        })
        db.commit()

        await emit(session_id, "status", {"message": "Agent started", "phase": "ingest"})

        # Phase 1: Ingest (already done during upload)
        session.current_phase = "ingest"
        db.commit()
        await emit(session_id, "phase", {"phase": "ingest", "status": "running"})

        files = db.query(UploadedFile).filter(UploadedFile.session_id == session_id).all()
        total_records = db.query(MigrationRecord).filter(MigrationRecord.session_id == session_id).count()

        await emit(session_id, "log", {"message": f"Found {len(files)} file(s) with {total_records} total records"})
        _log(db, session_id, "ingest_complete", phase="ingest", details={"files": len(files), "records": total_records})
        await emit(session_id, "phase", {"phase": "ingest", "status": "complete"})

        if _is_cancelled(session_id, db):
            await emit(session_id, "cancelled", {"message": "Agent cancelled"})
            return

        # Read autonomy level thresholds and store in stats for frontend
        preset = AUTONOMY_PRESETS.get(session.autonomy_level or "balanced", AUTONOMY_PRESETS["balanced"])
        auto_threshold = preset["auto_threshold"]
        esc_threshold = preset["esc_threshold"]
        session.stats = {
            **(session.stats or {}),
            "auto_threshold": auto_threshold,
            "esc_threshold": esc_threshold,
        }
        db.commit()

        # Phase 2: Map
        session.current_phase = "map"
        db.commit()
        await emit(session_id, "phase", {"phase": "map", "status": "running"})
        await _phase_map(db, session_id, files, auto_threshold, esc_threshold)
        await emit(session_id, "phase", {"phase": "map", "status": "complete"})

        if _is_cancelled(session_id, db):
            await emit(session_id, "cancelled", {"message": "Agent cancelled"})
            return

        # Check for mapping escalations
        pending_esc = db.query(Escalation).filter(
            Escalation.session_id == session_id,
            Escalation.phase == "map",
            Escalation.status == "pending",
        ).count()

        if pending_esc > 0:
            session.status = "awaiting_review"
            session.current_phase = "map"
            db.commit()
            await emit(session_id, "awaiting_review", {
                "phase": "map",
                "count": pending_esc,
                "message": f"{pending_esc} mapping(s) need your review",
            })
            return  # Pause for human review

        # Phase 3: Clean
        await _run_clean_phase(db, session_id, session)

    except Exception as e:
        logger.error("Agent failed for session %s: %s", session_id, e, exc_info=True)
        session.status = "error"
        db.commit()
        await emit(session_id, "error", {"message": str(e)})
        _log(db, session_id, "error", details={"error": str(e)})
        # Delay cleanup so client receives the error event
        await asyncio.sleep(2)
        cleanup_event_queue(session_id)
    finally:
        db.close()


async def resume_agent(session_id: str):
    """Resume agent after human resolves escalations."""
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        if _is_cancelled(session_id, db):
            await emit(session_id, "cancelled", {"message": "Agent cancelled"})
            return

        session.status = "processing"
        db.commit()

        phase = session.current_phase
        logger.info("Agent resumed for session %s from phase %s", session_id, phase)
        await emit(session_id, "status", {"message": f"Agent resumed from {phase}", "phase": phase})

        if phase == "map":
            # Apply human mapping overrides
            await _apply_mapping_resolutions(db, session_id)
            await _run_clean_phase(db, session_id, session)
        elif phase == "clean":
            await _apply_clean_resolutions(db, session_id)
            await _run_dedup_phase(db, session_id, session)
        elif phase == "dedup":
            await _apply_dedup_resolutions(db, session_id)
            await _run_validate_phase(db, session_id, session)
        elif phase == "validate":
            await _apply_validation_resolutions(db, session_id)
            await _finalize(db, session_id, session)

    except Exception as e:
        logger.error("Agent resume failed for session %s: %s", session_id, e, exc_info=True)
        session.status = "error"
        db.commit()
        await emit(session_id, "error", {"message": str(e)})
        await asyncio.sleep(2)
        cleanup_event_queue(session_id)
    finally:
        db.close()


async def _phase_map(db: DBSession, session_id: str, files: list,
                     auto_threshold: float = CONFIDENCE_AUTO_ACCEPT,
                     esc_threshold: float = CONFIDENCE_ESCALATE):
    """Run mapping phase for all files."""
    for file in files:
        await emit(session_id, "log", {"message": f"Mapping columns for '{file.filename}'..."})

        # Get sample rows
        records = db.query(MigrationRecord).filter(
            MigrationRecord.source_file_id == file.id,
        ).limit(5).all()
        sample_rows = [r.raw_data for r in records if r.raw_data]

        # Run Gemini mapping
        mappings = await map_columns(file.columns, sample_rows)

        for m in mappings:
            confidence = m.get("confidence", 0)
            if confidence >= auto_threshold:
                status = "auto_accepted"
            elif confidence < esc_threshold or m.get("target_field") is None:
                status = "escalated"
            else:
                status = "needs_review"  # medium confidence, mark for review

            mapping_id = gen_id()
            cm = ColumnMapping(
                id=mapping_id,
                session_id=session_id,
                file_id=file.id,
                source_column=m["source_column"],
                target_field=m.get("target_field"),
                confidence=confidence,
                ai_reasoning=m.get("reasoning", ""),
                status=status,
            )
            db.add(cm)

            if status == "escalated":
                esc_data = evaluate_mapping_escalation(m, auto_threshold, esc_threshold)
                if esc_data:
                    esc = Escalation(
                        id=gen_id(),
                        session_id=session_id,
                        phase="map",
                        mapping_id=mapping_id,
                        **esc_data,
                    )
                    db.add(esc)

            await emit(session_id, "mapping", {
                "file": file.filename,
                "source": m["source_column"],
                "target": m.get("target_field"),
                "confidence": confidence,
                "status": status,
            })

        db.commit()
        _log(db, session_id, f"mapped_{file.filename}", phase="map",
             details={"columns": len(mappings)})

    total_auto = db.query(ColumnMapping).filter(
        ColumnMapping.session_id == session_id,
        ColumnMapping.status == "auto_accepted",
    ).count()
    total_review = db.query(ColumnMapping).filter(
        ColumnMapping.session_id == session_id,
        ColumnMapping.status == "needs_review",
    ).count()
    total_esc = db.query(ColumnMapping).filter(
        ColumnMapping.session_id == session_id,
        ColumnMapping.status == "escalated",
    ).count()

    await emit(session_id, "log", {
        "message": f"Mapping complete: {total_auto} auto-accepted, {total_review} needs review, {total_esc} escalated",
    })


async def _run_clean_phase(db: DBSession, session_id: str, session):
    """Run cleaning phase."""
    if _is_cancelled(session_id, db):
        await emit(session_id, "cancelled", {"message": "Agent cancelled"})
        return
    session.current_phase = "clean"
    db.commit()
    await emit(session_id, "phase", {"phase": "clean", "status": "running"})

    # Build mapping lookup per file
    files = db.query(UploadedFile).filter(UploadedFile.session_id == session_id).all()
    escalation_count = 0
    # Track which (rule, field) combos already escalated to avoid duplicates
    seen_clean_escalations: set[tuple[str, str]] = set()

    for file in files:
        mappings = db.query(ColumnMapping).filter(
            ColumnMapping.file_id == file.id,
            ColumnMapping.status.in_(["auto_accepted", "needs_review", "human_approved", "human_overridden"]),
        ).all()

        # Build source->target mapping dict
        col_map = {}
        needs_name_split = False
        for m in mappings:
            target = m.human_override or m.target_field
            if target:
                col_map[m.source_column] = target
                # Check if full_name needs splitting
                if m.source_column.lower() in ("full_name", "name") and target == "first_name":
                    needs_name_split = True

        meta = {"_needs_name_split": needs_name_split}

        records = db.query(MigrationRecord).filter(
            MigrationRecord.source_file_id == file.id,
            MigrationRecord.status == "raw",
        ).all()

        # Collect all date values for disambiguation
        date_columns = [src for src, tgt in col_map.items()
                       if tgt in ("date_of_joining", "date_of_birth")]
        all_dates = []
        for r in records:
            if r.raw_data:
                for dc in date_columns:
                    if r.raw_data.get(dc):
                        all_dates.append(str(r.raw_data[dc]))

        for rec in records:
            if not rec.raw_data:
                continue

            # Apply column mapping
            mapped = {}
            for src_col, tgt_field in col_map.items():
                if src_col in rec.raw_data:
                    mapped[tgt_field] = rec.raw_data[src_col]

            rec.mapped_data = mapped

            # Clean
            cleaned, issues = await clean_record(mapped, meta, file.columns)
            rec.cleaned_data = cleaned
            rec.status = "cleaned"

            # Check for escalations from cleaning (deduplicate by rule+field)
            for issue in issues:
                esc_key = (issue["rule"], issue["field"])
                if esc_key in seen_clean_escalations:
                    continue  # Already escalated this issue type

                if issue["rule"] == "ambiguous_date":
                    esc_data = evaluate_date_escalation(
                        issue["field"], issue["value"],
                        issue.get("parsed_as", ""), all_dates,
                    )
                    if esc_data:
                        seen_clean_escalations.add(esc_key)
                        db.add(Escalation(
                            id=gen_id(), session_id=session_id, phase="clean",
                            record_id=rec.id, **esc_data,
                        ))
                        escalation_count += 1
                elif issue["rule"] == "unknown_enum":
                    seen_clean_escalations.add(esc_key)
                    db.add(Escalation(
                        id=gen_id(), session_id=session_id, phase="clean",
                        record_id=rec.id,
                        rule="unknown_enum",
                        severity="medium",
                        description=issue["description"],
                        context={"field": issue["field"], "value": issue["value"]},
                        ai_suggestion=None,
                    ))
                    escalation_count += 1

        db.commit()
        await emit(session_id, "log", {"message": f"Cleaned {len(records)} records from '{file.filename}'"})

    _log(db, session_id, "clean_complete", phase="clean")
    await emit(session_id, "phase", {"phase": "clean", "status": "complete"})

    if escalation_count > 0:
        session.status = "awaiting_review"
        db.commit()
        await emit(session_id, "awaiting_review", {
            "phase": "clean",
            "count": escalation_count,
            "message": f"{escalation_count} data issue(s) need your review",
        })
        return

    await _run_dedup_phase(db, session_id, session)


async def _run_dedup_phase(db: DBSession, session_id: str, session):
    """Run deduplication phase."""
    if _is_cancelled(session_id, db):
        await emit(session_id, "cancelled", {"message": "Agent cancelled"})
        return
    session.current_phase = "dedup"
    db.commit()
    await emit(session_id, "phase", {"phase": "dedup", "status": "running"})

    records = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.status == "cleaned",
        MigrationRecord.is_duplicate == 0,
    ).all()

    cleaned_data = [r.cleaned_data or {} for r in records]
    duplicates = find_duplicates(cleaned_data)

    auto_merged = 0
    escalation_count = 0

    for group in duplicates:
        esc_data = evaluate_dedup_escalation(group, cleaned_data)

        if esc_data is None:
            # Auto-merge: mark duplicate
            dup_idx = group["duplicate_idx"]
            primary_idx = group["primary_idx"]
            if dup_idx < len(records) and primary_idx < len(records):
                records[dup_idx].is_duplicate = 1
                records[dup_idx].duplicate_of = records[primary_idx].id
                records[dup_idx].status = "deduplicated"
                auto_merged += 1
        else:
            # Escalate
            primary_idx = group["primary_idx"]
            dup_idx = group["duplicate_idx"]
            db.add(Escalation(
                id=gen_id(), session_id=session_id, phase="dedup",
                record_id=records[dup_idx].id if dup_idx < len(records) else None,
                **esc_data,
            ))
            escalation_count += 1

    db.commit()
    await emit(session_id, "log", {
        "message": f"Dedup: {auto_merged} auto-merged, {escalation_count} need review",
    })
    _log(db, session_id, "dedup_complete", phase="dedup",
         details={"auto_merged": auto_merged, "escalated": escalation_count})
    await emit(session_id, "phase", {"phase": "dedup", "status": "complete"})

    if escalation_count > 0:
        session.status = "awaiting_review"
        db.commit()
        await emit(session_id, "awaiting_review", {
            "phase": "dedup",
            "count": escalation_count,
            "message": f"{escalation_count} duplicate conflict(s) need your review",
        })
        return

    await _run_validate_phase(db, session_id, session)


async def _run_validate_phase(db: DBSession, session_id: str, session):
    """Run validation phase."""
    if _is_cancelled(session_id, db):
        await emit(session_id, "cancelled", {"message": "Agent cancelled"})
        return
    session.current_phase = "validate"
    db.commit()
    await emit(session_id, "phase", {"phase": "validate", "status": "running"})

    records = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.is_duplicate == 0,
        MigrationRecord.status.in_(["cleaned", "deduplicated"]),
    ).all()

    total_errors = 0
    auto_fixed = 0
    escalation_count = 0
    # Track which (rule, field) combos already have an escalation to avoid duplicates
    seen_escalations: set[tuple[str, str]] = set()

    for rec in records:
        data = rec.cleaned_data or {}
        errors = validate_record(data)

        if errors:
            total_errors += len(errors)
            # Try auto-fix
            fixed_data, remaining = await attempt_auto_fix(data, errors)
            auto_fixed += len(errors) - len(remaining)

            rec.cleaned_data = fixed_data
            rec.validation_errors = remaining

            for err in remaining:
                esc_key = (err["rule"], err["field"])
                if esc_key in seen_escalations:
                    continue  # Already escalated this issue type
                seen_escalations.add(esc_key)
                esc_data = evaluate_validation_escalation(err, fixed_data)
                if esc_data:
                    db.add(Escalation(
                        id=gen_id(), session_id=session_id, phase="validate",
                        record_id=rec.id, **esc_data,
                    ))
                    escalation_count += 1

        rec.final_data = rec.cleaned_data
        rec.status = "validated"

    db.commit()
    await emit(session_id, "log", {
        "message": f"Validation: {total_errors} errors found, {auto_fixed} auto-fixed, {escalation_count} escalated",
    })
    _log(db, session_id, "validate_complete", phase="validate",
         details={"errors": total_errors, "auto_fixed": auto_fixed, "escalated": escalation_count})
    await emit(session_id, "phase", {"phase": "validate", "status": "complete"})

    if escalation_count > 0:
        session.status = "awaiting_review"
        db.commit()
        await emit(session_id, "awaiting_review", {
            "phase": "validate",
            "count": escalation_count,
            "message": f"{escalation_count} validation issue(s) need your review",
        })
        return

    await _finalize(db, session_id, session)


async def _finalize(db: DBSession, session_id: str, session):
    """Mark session ready for push."""
    valid_count = db.query(MigrationRecord).filter(
        MigrationRecord.session_id == session_id,
        MigrationRecord.status == "validated",
        MigrationRecord.is_duplicate == 0,
    ).count()

    session.status = "ready_to_push"
    session.current_phase = "push"
    session.stats = {
        **(session.stats or {}),
        "ready_count": valid_count,
    }
    db.commit()

    _log(db, session_id, "finalize_complete", phase="push", details={"ready_count": valid_count})
    await emit(session_id, "log", {"message": f"{valid_count} records ready to push"})
    await emit(session_id, "phase", {"phase": "push", "status": "ready"})
    await emit(session_id, "complete", {"ready_count": valid_count})
    # Delay cleanup so client receives the complete event
    await asyncio.sleep(2)
    cleanup_event_queue(session_id)


async def _apply_mapping_resolutions(db: DBSession, session_id: str):
    """Apply human resolutions for mapping escalations."""
    escalations = db.query(Escalation).filter(
        Escalation.session_id == session_id,
        Escalation.phase == "map",
        Escalation.status.in_(["approved", "overridden"]),
    ).all()

    for esc in escalations:
        if esc.mapping_id:
            mapping = db.query(ColumnMapping).filter(ColumnMapping.id == esc.mapping_id).first()
            if mapping:
                if esc.status == "approved":
                    mapping.status = "human_approved"
                    _log(db, session_id, "mapping_approved", actor="human", phase="map",
                         details={"source": mapping.source_column, "target": mapping.target_field})
                elif esc.status == "overridden" and esc.human_resolution:
                    mapping.status = "human_overridden"
                    mapping.human_override = esc.human_resolution
                    _log(db, session_id, "mapping_overridden", actor="human", phase="map",
                         details={"source": mapping.source_column, "original": mapping.target_field, "override": esc.human_resolution})
    db.commit()


async def _apply_clean_resolutions(db: DBSession, session_id: str):
    """Apply human resolutions for cleaning escalations."""
    escalations = db.query(Escalation).filter(
        Escalation.session_id == session_id,
        Escalation.phase == "clean",
        Escalation.status.in_(["approved", "overridden"]),
    ).all()

    for esc in escalations:
        if esc.record_id and esc.human_resolution:
            record = db.query(MigrationRecord).filter(MigrationRecord.id == esc.record_id).first()
            if record and record.cleaned_data:
                ctx = esc.context or {}
                field = ctx.get("field")
                if field:
                    old_value = record.cleaned_data.get(field)
                    record.cleaned_data = {**record.cleaned_data, field: esc.human_resolution}
                    flag_modified(record, "cleaned_data")
                    _log(db, session_id, f"clean_{esc.rule}_resolved", actor="human", phase="clean",
                         details={"field": field, "old": str(old_value), "new": esc.human_resolution})
    db.commit()


async def _apply_dedup_resolutions(db: DBSession, session_id: str):
    """Apply human resolutions for dedup escalations."""
    escalations = db.query(Escalation).filter(
        Escalation.session_id == session_id,
        Escalation.phase == "dedup",
        Escalation.status.in_(["approved", "rejected", "overridden"]),
    ).all()

    for esc in escalations:
        if esc.record_id:
            record = db.query(MigrationRecord).filter(MigrationRecord.id == esc.record_id).first()
            if record:
                if esc.status == "approved":
                    record.is_duplicate = 1
                    record.status = "deduplicated"
                    _log(db, session_id, "duplicate_confirmed", actor="human", phase="dedup",
                         details={"record_id": record.id})
                elif esc.status == "rejected":
                    record.is_duplicate = 0
                    record.status = "cleaned"
                    _log(db, session_id, "duplicate_rejected", actor="human", phase="dedup",
                         details={"record_id": record.id, "reason": "Human chose to keep both"})
    db.commit()


async def _apply_validation_resolutions(db: DBSession, session_id: str):
    """Apply human resolutions for validation escalations."""
    escalations = db.query(Escalation).filter(
        Escalation.session_id == session_id,
        Escalation.phase == "validate",
        Escalation.status.in_(["approved", "overridden"]),
    ).all()

    for esc in escalations:
        if esc.record_id and esc.human_resolution:
            record = db.query(MigrationRecord).filter(MigrationRecord.id == esc.record_id).first()
            if record and record.cleaned_data:
                ctx = esc.context or {}
                field = ctx.get("field")
                if field:
                    old_value = record.cleaned_data.get(field)
                    record.cleaned_data = {**record.cleaned_data, field: esc.human_resolution}
                    record.final_data = record.cleaned_data
                    flag_modified(record, "cleaned_data")
                    flag_modified(record, "final_data")
                    _log(db, session_id, f"validation_{esc.rule}_resolved", actor="human", phase="validate",
                         details={"field": field, "old": str(old_value), "new": esc.human_resolution})
    db.commit()
