from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class SessionCreate(BaseModel):
    name: str
    autonomy_level: str = "balanced"


class SessionResponse(BaseModel):
    id: str
    name: str
    status: str
    current_phase: str
    autonomy_level: str
    created_at: datetime
    updated_at: datetime
    stats: dict

    class Config:
        from_attributes = True


class FileResponse(BaseModel):
    id: str
    session_id: str
    filename: str
    file_type: Optional[str]
    row_count: int
    columns: list
    uploaded_at: datetime

    class Config:
        from_attributes = True


class MappingResponse(BaseModel):
    id: str
    session_id: str
    file_id: str
    source_column: str
    target_field: Optional[str]
    confidence: float
    ai_reasoning: str
    status: str
    human_override: Optional[str]

    class Config:
        from_attributes = True


class MappingUpdate(BaseModel):
    target_field: Optional[str] = None
    status: str = "human_overridden"


class EscalationResponse(BaseModel):
    id: str
    session_id: str
    phase: str
    rule: str
    severity: str
    description: str
    context: Optional[dict]
    ai_suggestion: Optional[str]
    status: str
    human_resolution: Optional[str]
    record_id: Optional[str]
    mapping_id: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class EscalationResolve(BaseModel):
    status: str  # approved, rejected, overridden
    human_resolution: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if self.status not in ("approved", "rejected", "overridden"):
            raise ValueError(f"Invalid escalation status: {self.status}. Must be approved, rejected, or overridden.")


class RecordResponse(BaseModel):
    id: str
    session_id: str
    source_file_id: str
    source_row_index: Optional[int]
    raw_data: Optional[dict]
    mapped_data: Optional[dict]
    cleaned_data: Optional[dict]
    final_data: Optional[dict]
    status: str
    is_duplicate: int
    duplicate_of: Optional[str]
    validation_errors: Optional[list]
    push_status: Optional[str]

    class Config:
        from_attributes = True


class PushResultResponse(BaseModel):
    id: str
    record_id: str
    attempt: int
    status: str
    response: dict
    pushed_at: datetime

    class Config:
        from_attributes = True


class DeltaReport(BaseModel):
    total_records: int
    ai_auto_resolved: int
    human_resolved: int
    escalation_breakdown: dict
    phase_stats: dict
    ai_contribution_pct: float
    human_contribution_pct: float
