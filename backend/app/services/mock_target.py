"""Mock target API — simulates a real HR system API with ~90% success rate."""
import random


def push_record(record: dict) -> dict:
    """Simulate pushing a record to target system.

    Returns {success: bool, message: str, employee_id: str}
    90% success rate, 10% random failures.
    """
    if random.random() < 0.9:
        return {
            "success": True,
            "message": "Record created successfully",
            "employee_id": record.get("employee_id", "unknown"),
        }
    else:
        errors = [
            "Connection timeout",
            "Rate limit exceeded",
            "Internal server error",
            "Duplicate entry detected by target system",
            "Field validation failed on target system",
        ]
        return {
            "success": False,
            "message": random.choice(errors),
            "employee_id": record.get("employee_id", "unknown"),
        }
