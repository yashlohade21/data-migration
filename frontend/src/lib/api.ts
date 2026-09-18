import type {
  Session, UploadedFile, ColumnMapping, Escalation,
  MigrationRecord, DeltaReport, PushResult,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

interface AgentStatus {
  status: string;
  session_id: string;
}

interface RecordCount {
  total: number;
  active: number;
  duplicates: number;
}

interface PushResponse {
  total: number;
  success: number;
  failed: number;
}

interface RetryResponse {
  retried: number;
  success: number;
  failed: number;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  phase: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export const api = {
  // Sessions
  createSession: (name: string) =>
    request<Session>("/sessions", { method: "POST", body: JSON.stringify({ name }) }),
  listSessions: () => request<Session[]>("/sessions"),
  getSession: (id: string) => request<Session>(`/sessions/${id}`),

  // Upload
  uploadFiles: async (sessionId: string, files: File[]): Promise<UploadedFile[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  listFiles: (sessionId: string) => request<UploadedFile[]>(`/sessions/${sessionId}/files`),

  // Agent
  startAgent: (sessionId: string, autonomyLevel?: string) =>
    request<AgentStatus>(`/sessions/${sessionId}/run`, {
      method: "POST",
      body: JSON.stringify({ autonomy_level: autonomyLevel || "balanced" }),
    }),
  cancelAgent: (sessionId: string) =>
    request<AgentStatus>(`/sessions/${sessionId}/cancel`, { method: "POST" }),
  resumeAgent: (sessionId: string) =>
    request<AgentStatus>(`/sessions/${sessionId}/resume`, { method: "POST" }),

  // Mappings
  getMappings: (sessionId: string) => request<ColumnMapping[]>(`/sessions/${sessionId}/mappings`),
  updateMapping: (sessionId: string, mappingId: string, data: { target_field?: string; status: string }) =>
    request<ColumnMapping>(`/sessions/${sessionId}/mappings/${mappingId}`, { method: "PUT", body: JSON.stringify(data) }),

  // Escalations
  getEscalations: (sessionId: string, phase?: string) =>
    request<Escalation[]>(`/sessions/${sessionId}/escalations${phase ? `?phase=${phase}` : ""}`),
  resolveEscalation: (sessionId: string, escalationId: string, data: { status: string; human_resolution?: string | null }) =>
    request<Escalation>(`/sessions/${sessionId}/escalations/${escalationId}`, { method: "PUT", body: JSON.stringify(data) }),

  // Records
  getRecords: (sessionId: string, limit = 100) =>
    request<MigrationRecord[]>(`/sessions/${sessionId}/records?limit=${limit}`),
  getRecordCount: (sessionId: string) => request<RecordCount>(`/sessions/${sessionId}/records/count`),

  // Push
  pushRecords: (sessionId: string) =>
    request<PushResponse>(`/sessions/${sessionId}/push`, { method: "POST" }),
  retryFailed: (sessionId: string) =>
    request<RetryResponse>(`/sessions/${sessionId}/push/retry`, { method: "POST" }),
  getPushResults: (sessionId: string) => request<PushResult[]>(`/sessions/${sessionId}/push/results`),

  // Delta & Audit
  getDelta: (sessionId: string) => request<DeltaReport>(`/sessions/${sessionId}/delta`),
  getAudit: (sessionId: string) => request<AuditEntry[]>(`/sessions/${sessionId}/audit`),
};

export function createSSEStream(sessionId: string) {
  return new EventSource(`${API_BASE}/sessions/${sessionId}/stream`);
}
