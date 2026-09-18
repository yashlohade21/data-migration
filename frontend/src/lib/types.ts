export interface Session {
  id: string;
  name: string;
  status: string;
  current_phase: string;
  autonomy_level: string;
  created_at: string;
  updated_at: string;
  stats: Record<string, any>;
}

export interface UploadedFile {
  id: string;
  session_id: string;
  filename: string;
  file_type: string;
  row_count: number;
  columns: string[];
  uploaded_at: string;
}

export interface ColumnMapping {
  id: string;
  session_id: string;
  file_id: string;
  source_column: string;
  target_field: string | null;
  confidence: number;
  ai_reasoning: string;
  status: string;
  human_override: string | null;
}

export interface Escalation {
  id: string;
  session_id: string;
  phase: string;
  rule: string;
  severity: string;
  description: string;
  context: Record<string, any> | null;
  ai_suggestion: string | null;
  status: string;
  human_resolution: string | null;
  record_id: string | null;
  mapping_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MigrationRecord {
  id: string;
  session_id: string;
  source_file_id: string;
  source_row_index: number;
  raw_data: Record<string, any> | null;
  mapped_data: Record<string, any> | null;
  cleaned_data: Record<string, any> | null;
  final_data: Record<string, any> | null;
  status: string;
  is_duplicate: number;
  duplicate_of: string | null;
  validation_errors: any[];
  push_status: string | null;
}

export interface PushResult {
  id: string;
  record_id: string;
  attempt: number;
  status: string;
  response: Record<string, any>;
  pushed_at: string;
}

export interface DeltaReport {
  total_records: number;
  ai_auto_resolved: number;
  human_resolved: number;
  escalation_breakdown: Record<string, any>;
  phase_stats: Record<string, any>;
  ai_contribution_pct: number;
  human_contribution_pct: number;
}

export interface SSEEvent {
  event: string;
  data: Record<string, any>;
}

export const TARGET_FIELDS = [
  "employee_id", "first_name", "last_name", "email", "phone",
  "department", "designation", "date_of_joining", "date_of_birth",
  "gender", "location", "manager_email", "employment_type", "salary",
];

export const PHASES = ["ingest", "map", "clean", "dedup", "validate", "push"] as const;
export type Phase = typeof PHASES[number];
