"""Deduplication service: email exact match + fuzzy name matching."""
from thefuzz import fuzz
from app.config import FUZZY_NAME_MATCH_THRESHOLD


def find_duplicates(records: list[dict]) -> list[dict]:
    """Find duplicate records based on email exact match + fuzzy name.

    Returns list of duplicate groups:
    [{
        "primary_idx": int,
        "duplicate_idx": int,
        "match_type": "email" | "fuzzy_name",
        "match_score": float,
        "conflicts": [{field, value_a, value_b}]
    }]
    """
    email_index: dict[str, list[int]] = {}
    duplicates = []

    # Phase 1: Email exact match
    for i, rec in enumerate(records):
        email = (rec.get("email") or "").lower().strip()
        if email:
            if email not in email_index:
                email_index[email] = []
            email_index[email].append(i)

    for email, indices in email_index.items():
        if len(indices) > 1:
            primary = indices[0]
            for dup in indices[1:]:
                conflicts = _find_conflicts(records[primary], records[dup])
                duplicates.append({
                    "primary_idx": primary,
                    "duplicate_idx": dup,
                    "match_type": "email",
                    "match_score": 1.0,
                    "conflicts": conflicts,
                })

    # Phase 2: Fuzzy name match (only for records without email match)
    matched_indices = set()
    for d in duplicates:
        matched_indices.add(d["duplicate_idx"])

    unmatched = [i for i in range(len(records)) if i not in matched_indices]

    for i, idx_a in enumerate(unmatched):
        rec_a = records[idx_a]
        name_a = _full_name(rec_a)
        if not name_a:
            continue

        for idx_b in unmatched[i + 1:]:
            rec_b = records[idx_b]
            name_b = _full_name(rec_b)
            if not name_b:
                continue

            score = fuzz.ratio(name_a.lower(), name_b.lower())
            if score >= FUZZY_NAME_MATCH_THRESHOLD:
                conflicts = _find_conflicts(rec_a, rec_b)
                duplicates.append({
                    "primary_idx": idx_a,
                    "duplicate_idx": idx_b,
                    "match_type": "fuzzy_name",
                    "match_score": score / 100.0,
                    "conflicts": conflicts,
                })

    return duplicates


def _full_name(rec: dict) -> str | None:
    fn = rec.get("first_name") or ""
    ln = rec.get("last_name") or ""
    full = f"{fn} {ln}".strip()
    return full if full else None


def _find_conflicts(a: dict, b: dict) -> list[dict]:
    """Find fields where both records have different non-null values."""
    conflicts = []
    all_fields = set(list(a.keys()) + list(b.keys()))

    for field in all_fields:
        val_a = a.get(field)
        val_b = b.get(field)

        if val_a is not None and val_b is not None:
            if str(val_a).strip().lower() != str(val_b).strip().lower():
                conflicts.append({
                    "field": field,
                    "value_a": val_a,
                    "value_b": val_b,
                })

    return conflicts
