"""Validate records against target schema rules."""
import re
from thefuzz import fuzz
from app.config import TARGET_SCHEMA, FUZZY_ENUM_MATCH_THRESHOLD


def validate_record(record: dict) -> list[dict]:
    """Validate a cleaned record against the target schema.

    Returns list of validation errors: [{field, rule, message, auto_fixable, suggested_fix}]
    """
    errors = []

    for field, schema in TARGET_SCHEMA.items():
        value = record.get(field)

        # Check required
        if schema.get("required") and (value is None or str(value).strip() == ""):
            errors.append({
                "field": field,
                "rule": "missing_required",
                "message": f"Required field '{field}' is missing",
                "auto_fixable": False,
                "suggested_fix": None,
            })
            continue

        if value is None or str(value).strip() == "":
            continue

        # Type/pattern checks
        if schema["type"] == "string" and "pattern" in schema:
            if not re.match(schema["pattern"], str(value)):
                errors.append({
                    "field": field,
                    "rule": "validation_fail",
                    "message": f"'{field}' value '{value}' doesn't match pattern",
                    "auto_fixable": False,
                    "suggested_fix": None,
                })

        elif schema["type"] == "enum":
            if str(value) not in schema["values"]:
                errors.append({
                    "field": field,
                    "rule": "unknown_enum",
                    "message": f"'{field}' value '{value}' not in allowed values: {schema['values']}",
                    "auto_fixable": True,
                    "suggested_fix": None,
                })

        elif schema["type"] == "date":
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)):
                errors.append({
                    "field": field,
                    "rule": "validation_fail",
                    "message": f"'{field}' value '{value}' is not in YYYY-MM-DD format",
                    "auto_fixable": False,
                    "suggested_fix": None,
                })

        elif schema["type"] == "number":
            try:
                num = float(value)
                if "min" in schema and num < schema["min"]:
                    errors.append({
                        "field": field,
                        "rule": "validation_fail",
                        "message": f"'{field}' value {num} below minimum {schema['min']}",
                        "auto_fixable": False,
                        "suggested_fix": None,
                    })
            except (ValueError, TypeError):
                errors.append({
                    "field": field,
                    "rule": "validation_fail",
                    "message": f"'{field}' value '{value}' is not a valid number",
                    "auto_fixable": False,
                    "suggested_fix": None,
                })

    return errors


async def attempt_auto_fix(record: dict, errors: list[dict]) -> tuple[dict, list[dict]]:
    """Try to auto-fix validation errors using fuzzy matching.

    Returns (fixed_record, remaining_errors).
    """
    fixed = dict(record)
    remaining = []

    for err in errors:
        field = err["field"]
        schema = TARGET_SCHEMA.get(field, {})

        if err["rule"] == "unknown_enum" and schema.get("values"):
            value = str(record.get(field, ""))
            # Fuzzy match to closest enum value
            best_match = None
            best_score = 0
            for valid in schema["values"]:
                score = fuzz.ratio(value.lower(), valid.lower())
                if score > best_score:
                    best_score = score
                    best_match = valid

            if best_score >= FUZZY_ENUM_MATCH_THRESHOLD and best_match:
                fixed[field] = best_match
                continue

            remaining.append(err)
        elif err["rule"] == "missing_required":
            remaining.append(err)
        else:
            remaining.append(err)

    return fixed, remaining
