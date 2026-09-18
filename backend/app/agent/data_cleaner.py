"""Deterministic data cleaning transforms."""
import re
import math
from datetime import datetime
from app.config import TARGET_SCHEMA


def _str(value) -> str | None:
    """Coerce any value to string, handling floats/ints from Excel."""
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        if value == int(value):
            return str(int(value))
        return str(value)
    return str(value)


def clean_string(value) -> str | None:
    v = _str(value)
    if v is None:
        return None
    return v.strip()


def clean_name(value) -> str | None:
    v = _str(value)
    if v is None:
        return None
    return v.strip().title()


def split_full_name(value) -> tuple[str | None, str | None]:
    """Split 'First Last' into (first, last)."""
    v = _str(value)
    if v is None:
        return None, None
    parts = v.strip().split(None, 1)
    first = parts[0].title() if parts else None
    last = parts[1].title() if len(parts) > 1 else None
    return first, last


def clean_email(value) -> str | None:
    v = _str(value)
    if v is None:
        return None
    return v.strip().lower()


def clean_phone(value) -> str | None:
    v = _str(value)
    if v is None:
        return None
    cleaned = re.sub(r"[^\d+\s\-()]", "", v.strip())
    return cleaned if cleaned else None


def normalize_gender(value) -> str | None:
    if value is None:
        return None
    s = _str(value)
    if s is None:
        return None
    v = s.strip().lower()
    gender_map = {
        "m": "Male", "male": "Male", "man": "Male",
        "f": "Female", "female": "Female", "woman": "Female",
        "nb": "Non-binary", "non-binary": "Non-binary", "nonbinary": "Non-binary",
        "other": "Other",
    }
    return gender_map.get(v, s.strip().title())


DEPARTMENT_MAP = {
    "engg": "Engineering", "eng": "Engineering", "engineering": "Engineering", "tech": "Engineering",
    "mktg": "Marketing", "marketing": "Marketing",
    "sales": "Sales",
    "hr": "Human Resources", "human resources": "Human Resources",
    "fin": "Finance", "finance": "Finance",
    "ops": "Operations", "operations": "Operations",
    "prod": "Product", "product": "Product",
    "des": "Design", "design": "Design",
    "legal": "Legal",
    "cs": "Customer Support", "customer support": "Customer Support", "support": "Customer Support",
    "ds": "Data Science", "data science": "Data Science", "data": "Data Science",
    "it": "IT", "admin": "Administration", "administration": "Administration",
}


def normalize_department(value) -> tuple[str | None, bool]:
    """Returns (normalized_value, needs_escalation)."""
    if value is None:
        return None, False
    s = _str(value)
    if s is None:
        return None, False
    v = s.strip().lower()
    if v in DEPARTMENT_MAP:
        return DEPARTMENT_MAP[v], False
    # Check if it's already a valid value
    valid = [x.lower() for x in TARGET_SCHEMA["department"]["values"]]
    if v in valid:
        idx = valid.index(v)
        return TARGET_SCHEMA["department"]["values"][idx], False
    return value, True  # needs escalation


def normalize_employment_type(value) -> tuple[str | None, bool]:
    if value is None:
        return None, False
    s = _str(value)
    if s is None:
        return None, False
    v = s.strip().lower()
    emp_map = {
        "ft": "Full-time", "full-time": "Full-time", "full time": "Full-time", "fulltime": "Full-time",
        "pt": "Part-time", "part-time": "Part-time", "part time": "Part-time", "parttime": "Part-time",
        "contract": "Contract", "contractor": "Contract", "c2c": "Contract",
        "intern": "Intern", "internship": "Intern",
    }
    if v in emp_map:
        return emp_map[v], False
    return value, True


DATE_FORMATS = [
    ("%Y-%m-%d", "iso"),
    ("%d/%m/%Y", "dmy"),
    ("%m/%d/%Y", "mdy"),
    ("%d-%m-%Y", "dmy"),
    ("%m-%d-%Y", "mdy"),
]

MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}


def parse_date(value) -> tuple[str | None, bool]:
    """Try to parse date into YYYY-MM-DD. Returns (date_str, is_ambiguous).

    Ambiguous = DD/MM/YYYY where both DD and MM <= 12.
    """
    if value is None:
        return None, False

    s = _str(value)
    if s is None:
        return None, False
    value = s.strip()

    # Handle "Mon DD, YYYY" format (e.g., "Jan 15, 2023")
    named_match = re.match(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})", value)
    if named_match:
        month_str, day, year = named_match.groups()
        month_num = MONTH_NAMES.get(month_str.lower())
        if month_num:
            return f"{year}-{month_num:02d}-{int(day):02d}", False

    # Try ISO format first (unambiguous)
    try:
        dt = datetime.strptime(value, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d"), False
    except ValueError:
        pass

    # Try DD/MM/YYYY and check ambiguity
    slash_match = re.match(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", value)
    if slash_match:
        a, b, year = int(slash_match.group(1)), int(slash_match.group(2)), int(slash_match.group(3))

        if a > 12 and b <= 12:
            # a must be day (DD/MM/YYYY)
            return f"{year}-{b:02d}-{a:02d}", False
        elif b > 12 and a <= 12:
            # b must be day (MM/DD/YYYY)
            return f"{year}-{a:02d}-{b:02d}", False
        elif a <= 12 and b <= 12:
            # Ambiguous! Default to DD/MM/YYYY but flag it
            return f"{year}-{b:02d}-{a:02d}", True
        else:
            return None, False  # invalid

    return None, False


def clean_salary(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned = re.sub(r"[^\d.]", "", str(value))
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


async def clean_record(record: dict, mappings: dict, file_columns: list[str]) -> tuple[dict, list[dict]]:
    """Clean a mapped record according to target schema rules.

    Args:
        record: mapped_data dict {target_field: value}
        mappings: dict of {source_col: {target_field, needs_split, ...}}
        file_columns: original file column names

    Returns:
        (cleaned_data, escalations) where escalations is a list of dicts
    """
    cleaned = {}
    issues = []

    for field, value in record.items():
        if field == "first_name" and mappings.get("_needs_name_split"):
            first, last = split_full_name(value)
            cleaned["first_name"] = clean_name(first)
            cleaned["last_name"] = clean_name(last)
            continue

        if field in ("first_name", "last_name"):
            cleaned[field] = clean_name(value)
        elif field == "email" or field == "manager_email":
            cleaned[field] = clean_email(value)
        elif field == "phone":
            cleaned[field] = clean_phone(value)
        elif field == "gender":
            cleaned[field] = normalize_gender(value)
        elif field == "department":
            norm, needs_esc = normalize_department(value)
            cleaned[field] = norm
            if needs_esc:
                issues.append({
                    "rule": "unknown_enum",
                    "field": field,
                    "value": value,
                    "description": f"Unknown department value: '{value}'",
                })
        elif field == "employment_type":
            norm, needs_esc = normalize_employment_type(value)
            cleaned[field] = norm
            if needs_esc:
                issues.append({
                    "rule": "unknown_enum",
                    "field": field,
                    "value": value,
                    "description": f"Unknown employment type: '{value}'",
                })
        elif field in ("date_of_joining", "date_of_birth"):
            parsed, is_ambiguous = parse_date(value)
            cleaned[field] = parsed
            if is_ambiguous:
                issues.append({
                    "rule": "ambiguous_date",
                    "field": field,
                    "value": value,
                    "parsed_as": parsed,
                    "description": f"Ambiguous date '{value}' — could be DD/MM or MM/DD",
                })
        elif field == "salary":
            cleaned[field] = clean_salary(value)
        elif field == "employee_id":
            cleaned[field] = clean_string(value)
        else:
            cleaned[field] = clean_string(value)

    return cleaned, issues
