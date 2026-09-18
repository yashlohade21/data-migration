import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(dotenv_path="../.env.local", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./migration.db")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

TARGET_SCHEMA = {
    "employee_id": {"type": "string", "required": True, "pattern": r"^[A-Za-z0-9\-]+$"},
    "first_name": {"type": "string", "required": True},
    "last_name": {"type": "string", "required": True},
    "email": {"type": "string", "required": True, "pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
    "phone": {"type": "string", "required": False, "pattern": r"^\+?[\d\s\-\(\)]{7,20}$"},
    "department": {
        "type": "enum",
        "required": True,
        "values": [
            "Engineering", "Marketing", "Sales", "Human Resources", "Finance",
            "Operations", "Product", "Design", "Legal", "Customer Support",
            "Data Science", "IT", "Administration"
        ],
    },
    "designation": {"type": "string", "required": True},
    "date_of_joining": {"type": "date", "required": True, "format": "YYYY-MM-DD"},
    "date_of_birth": {"type": "date", "required": False, "format": "YYYY-MM-DD"},
    "gender": {"type": "enum", "required": False, "values": ["Male", "Female", "Non-binary", "Other"]},
    "location": {"type": "string", "required": False},
    "manager_email": {"type": "string", "required": False, "pattern": r"^[^@\s]+@[^@\s]+\.[^@\s]+$"},
    "employment_type": {
        "type": "enum",
        "required": True,
        "values": ["Full-time", "Part-time", "Contract", "Intern"],
    },
    "salary": {"type": "number", "required": False, "min": 0},
}

TARGET_FIELDS = list(TARGET_SCHEMA.keys())

CONFIDENCE_AUTO_ACCEPT = 0.85
CONFIDENCE_ESCALATE = 0.5

AUTONOMY_PRESETS = {
    "conservative": {"auto_threshold": 1.0, "esc_threshold": 0.5},
    "balanced": {"auto_threshold": 0.85, "esc_threshold": 0.5},
    "aggressive": {"auto_threshold": 0.60, "esc_threshold": 0.3},
}

# Fuzzy matching thresholds
FUZZY_COLUMN_MATCH_THRESHOLD = 70    # Min score for column-to-field fuzzy match
FUZZY_NAME_MATCH_THRESHOLD = 85      # Min score for duplicate name detection
FUZZY_ENUM_MATCH_THRESHOLD = 70      # Min score for auto-fixing unknown enum values

# Upload limits
MAX_UPLOAD_SIZE_MB = 50
