"""Map source columns to target schema using heuristic matching."""
from thefuzz import fuzz
from app.config import TARGET_FIELDS, FUZZY_COLUMN_MATCH_THRESHOLD


async def map_columns(source_columns: list[str], sample_rows: list[dict]) -> list[dict]:
    """Map source columns to target fields using keyword + fuzzy matching.

    Returns list of {source_column, target_field, confidence, reasoning}.
    """
    return _heuristic_map(source_columns, sample_rows)


# Direct keyword mapping
_KEYWORD_MAP = {
    "emp_code": ("employee_id", 0.92),
    "employee_id": ("employee_id", 1.0),
    "contractor_id": ("employee_id", 0.88),
    "fname": ("first_name", 0.95),
    "first_name": ("first_name", 1.0),
    "lname": ("last_name", 0.95),
    "last_name": ("last_name", 1.0),
    "full_name": ("first_name", 0.88),
    "name": ("first_name", 0.86),
    "email": ("email", 1.0),
    "email_id": ("email", 0.95),
    "email_address": ("email", 0.95),
    "contact_email": ("email", 0.92),
    "work_email": ("email", 0.92),
    "phone": ("phone", 0.95),
    "phone_number": ("phone", 0.95),
    "contact_no": ("phone", 0.90),
    "mobile": ("phone", 0.90),
    "mobile_no": ("phone", 0.90),
    "contact_phone": ("phone", 0.90),
    "department": ("department", 1.0),
    "dept_name": ("department", 0.92),
    "dept": ("department", 0.92),
    "team": ("department", 0.88),
    "designation": ("designation", 1.0),
    "role": ("designation", 0.88),
    "title": ("designation", 0.88),
    "date_of_joining": ("date_of_joining", 1.0),
    "joining_dt": ("date_of_joining", 0.92),
    "start_date": ("date_of_joining", 0.90),
    "doj": ("date_of_joining", 0.92),
    "date_of_birth": ("date_of_birth", 1.0),
    "birth_dt": ("date_of_birth", 0.92),
    "birth_date": ("date_of_birth", 0.95),
    "dob": ("date_of_birth", 0.95),
    "gender": ("gender", 1.0),
    "sex": ("gender", 0.92),
    "location": ("location", 0.95),
    "city": ("location", 0.88),
    "work_location": ("location", 0.92),
    "manager_email": ("manager_email", 1.0),
    "mgr_email": ("manager_email", 0.92),
    "reporting_manager": ("manager_email", 0.88),
    "manager": ("manager_email", 0.88),
    "mgr": ("manager_email", 0.86),
    "employment_type": ("employment_type", 1.0),
    "employment_status": ("employment_type", 0.45),
    "type": ("employment_type", 0.86),
    "contract_type": ("employment_type", 0.90),
    "emp_type": ("employment_type", 0.92),
    "salary": ("salary", 1.0),
    "annual_ctc": ("salary", 0.92),
    "ctc": ("salary", 0.92),
    "annual_salary": ("salary", 0.95),
    "monthly_pay": ("salary", 0.88),
    "compensation": ("salary", 0.88),
    "hourly_rate": ("salary", 0.40),
}


def _heuristic_map(source_columns: list[str], sample_rows: list[dict]) -> list[dict]:
    """Keyword match first, then fuzzy match against target field names."""
    results = []
    for col in source_columns:
        col_lower = col.lower().strip()

        # 1. Direct keyword match
        if col_lower in _KEYWORD_MAP:
            target, conf = _KEYWORD_MAP[col_lower]
            results.append({
                "source_column": col,
                "target_field": target,
                "confidence": conf,
                "reasoning": f"Keyword match: '{col}' maps to '{target}'",
            })
            continue

        # 2. Fuzzy match against target field names
        best_target = None
        best_score = 0
        for tf in TARGET_FIELDS:
            score = fuzz.ratio(col_lower.replace("_", " "), tf.replace("_", " "))
            if score > best_score:
                best_score = score
                best_target = tf

        if best_score >= FUZZY_COLUMN_MATCH_THRESHOLD:
            conf = round(best_score / 100, 2)
            results.append({
                "source_column": col,
                "target_field": best_target,
                "confidence": conf,
                "reasoning": f"Fuzzy match ({best_score}%): '{col}' ~ '{best_target}'",
            })
        else:
            results.append({
                "source_column": col,
                "target_field": None,
                "confidence": 0.0,
                "reasoning": f"No match found for '{col}'",
            })

    return results
