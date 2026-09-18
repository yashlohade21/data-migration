"""Escalation engine — decides what to auto-resolve vs escalate to human."""
from app.config import CONFIDENCE_AUTO_ACCEPT, CONFIDENCE_ESCALATE


def evaluate_mapping_escalation(mapping: dict,
                                auto_threshold: float = CONFIDENCE_AUTO_ACCEPT,
                                esc_threshold: float = CONFIDENCE_ESCALATE) -> dict | None:
    """Evaluate if a column mapping needs escalation.

    Returns escalation dict or None if auto-accepted.
    """
    confidence = mapping.get("confidence", 0)
    source = mapping.get("source_column", "")
    target = mapping.get("target_field")

    if confidence >= auto_threshold:
        return None  # auto-accept

    if confidence < esc_threshold or target is None:
        return {
            "rule": "ambiguous_mapping",
            "severity": "high" if confidence < 0.3 else "medium",
            "description": f"Low confidence mapping: '{source}' -> '{target}' (confidence: {confidence:.0%})",
            "context": {
                "source_column": source,
                "suggested_target": target,
                "confidence": confidence,
                "reasoning": mapping.get("reasoning", ""),
            },
            "ai_suggestion": f"Map '{source}' to '{target}'" if target else f"No suitable target found for '{source}'",
        }

    # Medium confidence — auto-accept but log
    return None


def evaluate_date_escalation(field: str, value: str, parsed: str, all_dates: list[str]) -> dict | None:
    """Check if an ambiguous date can be disambiguated by other rows."""
    # If other dates from same column have DD>12, it's DD/MM/YYYY format
    for d in all_dates:
        parts = d.split("/") if "/" in d else d.split("-")
        if len(parts) == 3:
            first = int(parts[0]) if parts[0].isdigit() else 0
            if first > 12:
                return None  # Confirmed DD/MM/YYYY

    return {
        "rule": "ambiguous_date",
        "severity": "medium",
        "description": f"Cannot determine date format for '{value}' — both DD/MM and MM/DD are valid",
        "context": {"field": field, "original": value, "parsed_as_ddmm": parsed},
        "ai_suggestion": f"Parsed as DD/MM/YYYY: {parsed}",
    }


def evaluate_dedup_escalation(group: dict, records: list[dict]) -> dict | None:
    """Decide if a duplicate conflict needs escalation."""
    conflicts = group.get("conflicts", [])

    if not conflicts:
        # No conflicts — auto-merge (keep primary)
        return None

    # Check if we can auto-merge (e.g., one record has more filled fields)
    primary = records[group["primary_idx"]] if group["primary_idx"] < len(records) else {}
    duplicate = records[group["duplicate_idx"]] if group["duplicate_idx"] < len(records) else {}

    # Count non-null fields
    primary_filled = sum(1 for v in primary.values() if v is not None and str(v).strip())
    dup_filled = sum(1 for v in duplicate.values() if v is not None and str(v).strip())

    non_trivial_conflicts = [c for c in conflicts if c["field"] not in ("employee_id",)]

    if not non_trivial_conflicts:
        return None  # Only ID differs, auto-merge

    if len(non_trivial_conflicts) <= 2 and primary_filled > dup_filled:
        return None  # Primary has more data, auto-merge favoring primary

    return {
        "rule": "duplicate_conflict",
        "severity": "high" if len(non_trivial_conflicts) > 3 else "medium",
        "description": f"Duplicate records with {len(non_trivial_conflicts)} conflicting field(s)",
        "context": {
            "primary_data": primary,
            "duplicate_data": duplicate,
            "conflicts": non_trivial_conflicts,
            "match_type": group["match_type"],
            "match_score": group["match_score"],
        },
        "ai_suggestion": "Keep primary record (more complete)" if primary_filled >= dup_filled else "Keep duplicate record (more complete)",
    }


def evaluate_validation_escalation(error: dict, record: dict) -> dict | None:
    """Check if a validation error needs escalation after auto-fix attempt."""
    if error.get("auto_fixable") and error.get("suggested_fix"):
        return None  # Was auto-fixed

    return {
        "rule": error["rule"],
        "severity": "high" if error["rule"] == "missing_required" else "medium",
        "description": error["message"],
        "context": {
            "field": error["field"],
            "current_value": record.get(error["field"]),
            "record_preview": {k: v for k, v in record.items() if v is not None},
        },
        "ai_suggestion": error.get("suggested_fix"),
    }
