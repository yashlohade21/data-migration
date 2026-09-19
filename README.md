# Data Migration Agent

An autonomous agent that migrates HR data from messy CSV/Excel files into a unified target schema, with a human-in-the-loop web UI for reviewing decisions the agent can't make on its own.

**Live:** [data-migration-kappa.vercel.app](https://data-migration-kappa.vercel.app)

## Architecture

```
┌──────────────────┐       ┌───────────────────────┐       ┌────────────┐
│   Next.js 16     │──────▸│   FastAPI + SSE        │──────▸│   Neon     │
│   React 19       │◂──────│   Migration Agent      │◂──────│  PostgreSQL│
│   Tailwind CSS 4 │       │   Heuristic Engine     │       │            │
│   (Vercel)       │       │   (Cloud Run)          │       │ (Serverless)│
└──────────────────┘       └───────────────────────┘       └────────────┘
```

## How It Works

```
Upload ──▸ Map ──▸ Clean ──▸ Dedup ──▸ Validate ──▸ Push
```

1. **Upload** — Drop CSV/XLSX files. The agent parses them, detects schemas, and counts rows.
2. **Map** — Keyword + fuzzy matching maps source columns to target fields with confidence scores. Auto-accepts ≥85%, escalates <50%.
3. **Clean** — Date parsing, phone normalization, gender/department enum mapping, name splitting, salary conversion.
4. **Deduplicate** — Email exact match + fuzzy name matching. Auto-merges when one record is strictly more complete.
5. **Validate** — Per-field schema validation. Attempts auto-fix before escalating to human.
6. **Push** — Mock target API with 90% success rate, up to 2 retries, full audit trail.

## Agent Autonomy Rules

| Rule | Trigger | Behavior |
|------|---------|----------|
| Column mapping | Confidence < 50% | Escalates to human |
| Ambiguous date | DD/MM vs MM/DD both valid | Disambiguates from other rows; escalates if ambiguous |
| Duplicate conflict | Same person, different values | Auto-merges if one is more complete; escalates conflicts |
| Validation failure | Field fails schema | Auto-fix first; escalates on second failure |
| Unknown enum | Value not in target set | Auto-maps if ≥80% confidence; escalates otherwise |
| Missing required | Null after mapping | Escalates to human |

The agent completes an entire phase and batches all escalations before pausing — the reviewer resolves 5–20 issues at once instead of being interrupted per-decision.

## Target Schema

14 fields: `employee_id`, `first_name`, `last_name`, `email`, `phone`, `department`, `designation`, `date_of_joining`, `date_of_birth`, `gender`, `location`, `manager_email`, `employment_type`, `salary`.

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./migration.db` | Database connection string (SQLite or PostgreSQL) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Backend API base URL |
| `UPLOAD_DIR` | `uploads` | File upload directory |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions` | List sessions |
| `GET` | `/api/sessions/{id}` | Get session details |
| `POST` | `/api/sessions/{id}/upload` | Upload CSV/XLSX files |
| `POST` | `/api/sessions/{id}/run` | Start migration agent |
| `POST` | `/api/sessions/{id}/resume` | Resume after review |
| `GET` | `/api/sessions/{id}/stream` | SSE event stream |
| `GET` | `/api/sessions/{id}/mappings` | Column mappings |
| `PUT` | `/api/sessions/{id}/mappings/{mid}` | Override a mapping |
| `GET` | `/api/sessions/{id}/escalations` | List escalations |
| `PUT` | `/api/sessions/{id}/escalations/{eid}` | Resolve escalation |
| `POST` | `/api/sessions/{id}/escalations/batch` | Bulk resolve |
| `GET` | `/api/sessions/{id}/records` | Migration records |
| `POST` | `/api/sessions/{id}/push` | Push to target API |
| `GET` | `/api/sessions/{id}/delta` | Human vs AI delta report |
| `GET` | `/api/sessions/{id}/audit` | Full audit log |

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, pandas, thefuzz, sse-starlette
**Frontend:** Next.js 16, React 19, Tailwind CSS 4, lucide-react
**Database:** Neon PostgreSQL (prod) / SQLite (dev)
**Hosting:** Vercel (frontend), Google Cloud Run (backend)

---

## Write-up: Approach, Design Trade-offs & Scaling

### Approach

The agent runs a five-phase pipeline — **Ingest → Map → Clean → Dedup → Validate** — and pauses at each phase boundary only when it encounters genuinely ambiguous decisions. A non-technical implementation consultant can upload multiple CSV/Excel files, watch the agent work in real-time via SSE streaming, resolve a small queue of escalations, and push clean data to the target system — all without writing a single line of code.

### Where I Drew the Escalation Boundary

The core design question: what should the agent handle alone vs. escalate? My principle: **escalate only when two reasonable people would disagree on the right answer.**

**Agent handles autonomously (no human needed):**
- Column mappings above 85% confidence (keyword + fuzzy matching + Gemini LLM reasoning)
- Date format normalization when the format is unambiguous (DD > 12 confirms DD/MM/YYYY)
- Phone/email/name cleaning (whitespace, casing, format normalization)
- Department/gender/employment-type enum normalization via known aliases
- Duplicate detection where one record is clearly more complete (auto-merge favoring the fuller record)
- Validation auto-fixes via fuzzy matching to the nearest valid enum value

**Agent escalates to human (genuinely ambiguous):**
- **Unknown enum values** — e.g., "Strategic Initiatives" doesn't map to any known department; the human picks the right one
- **Duplicate conflicts with 3+ differing fields** — e.g., same employee in two systems with different salary, location, title, and manager; the agent can't guess which is authoritative
- **Missing required fields** — e.g., contractors with no employee ID; the human decides the policy (generate IDs, skip, or fill manually)
- **Ambiguous dates** — e.g., 03/06/2021 could be March 6 or June 3, and no other date in the file disambiguates it

Escalations are **deduplicated** (one per issue type, not per record) and **batched per phase** so the human sees a clean queue of 3–5 decisions, not 50 repetitive ones. Each escalation card shows the AI's suggestion, full context, and one-click Accept/Override/Reject.

### Delta Solutioning

The Audit tab shows a delta report: what percentage of decisions the AI made autonomously vs. what required human input. For the demo dataset (19 records, 3 files), the agent auto-resolves ~90% of decisions and escalates ~10% — a clear signal of how much manual work was eliminated.

### What I'd Build Next to Scale to 50+ Enterprise Clients

1. **Learning from corrections** — store human overrides and feed them back into the mapper so the same escalation never appears twice for the same client
2. **Configurable autonomy levels** — the architecture already supports conservative/balanced/aggressive presets; I'd expose per-rule confidence thresholds in the UI
3. **Real Darwinbox API integration** — replace the mock push with actual API calls, field-level error handling, and rollback support
4. **Batch processing at scale** — chunked file processing, background job queues (Celery/Redis), and progress tracking for 100K+ record migrations
5. **Multi-entity support** — extend beyond employees to handle departments, designations, cost centers, and org hierarchies as separate but linked migration pipelines

---

## Project Structure

```
backend/
├── main.py                     # FastAPI app, CORS
├── app/
│   ├── config.py               # Target schema, thresholds
│   ├── database.py             # SQLAlchemy setup
│   ├── models.py               # DB models
│   ├── schemas.py              # Pydantic models
│   ├── routes/                 # API endpoints
│   ├── agent/                  # Migration agent (orchestrator, mapper, cleaner, validator)
│   └── services/               # File parser, dedup, mock target
frontend/
├── src/
│   ├── app/                    # Pages (landing, upload, mapping, review, push, audit)
│   ├── components/             # UI components
│   ├── hooks/                  # useSSE, useSession
│   └── lib/                    # API client, types
```
