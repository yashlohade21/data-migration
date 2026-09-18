# AI-Powered Data Migration Agent

An autonomous agent that migrates HR/CRM data from multiple inconsistent CSV/Excel files into a unified target schema, with a **human-in-the-loop (HITL)** web UI for reviewing decisions the agent can't make on its own.

Built as a take-home assignment for Darwinbox Forward Deployed Engineer.

## Architecture

```
┌──────────────────┐     ┌───────────────────────┐
│   Next.js 16     │────▸│   FastAPI + SSE        │
│   React 19       │◂────│   Migration Agent      │
│   Tailwind CSS   │     │   Heuristic Engine     │
└──────────────────┘     └───────────────────────┘
                                │
                          ┌─────┴─────┐
                          │  SQLite   │
                          └───────────┘
```

**Stack:** FastAPI (Python) + Next.js 16 (TypeScript/Tailwind CSS 4) + SQLite + Heuristic Matching Engine

## What Makes This Different

### Agent Autonomy with Clear Boundaries

The agent doesn't just process data — it **makes decisions**. For each operation, it has clear rules about what it can handle autonomously vs. what requires human input:

| Rule | Trigger | Agent Behavior |
|------|---------|----------------|
| **Column mapping** | Confidence < 50% | Always escalates to human |
| **Ambiguous date** | DD/MM vs MM/DD both valid | Disambiguates from other rows in the same file; escalates only if no disambiguating row exists |
| **Duplicate conflict** | Same person, different field values | Auto-merges if one record is more complete; escalates when both have conflicting non-null values |
| **Validation failure** | Field fails schema rules | Attempts auto-fix first; escalates only on second failure |
| **Unknown enum** | Value not in target enum set | Auto-maps if heuristic confidence >= 80%; escalates otherwise |
| **Missing required** | Null after column mapping | Escalates to human for manual resolution |

### Phase-Level Batching (Not Per-Escalation Blocking)

The agent completes an **entire phase** and batches all escalations before pausing. This means the human reviewer resolves 5-20 escalations at once instead of being interrupted after every single decision. Minimizes context-switching, maximizes throughput.

### Full Audit Trail + Delta Report

Every action — whether by the agent or the human — is logged with actor attribution. The delta report shows exactly what percentage of decisions were automated vs. human-resolved, broken down by phase.

## Agent Workflow (6 Phases)

```
 Upload ──▸ Ingest ──▸ Map ──▸ Clean ──▸ Dedup ──▸ Validate ──▸ Push
              │         │        │         │          │           │
              ▼         ▼        ▼         ▼          ▼           ▼
           Parse     Keyword   Date     Email +    Per-field   Mock API
           CSV/XLSX  + Fuzzy   Phone    Fuzzy      Schema      90% success
           Detect    Matching  Gender   Name       Validation  Retry 2x
           Schemas   w/Conf.  Dept     Matching   Auto-fix    Audit trail
                     Scores   Normalize            Attempts
```

1. **Ingest** — Parse uploaded CSV/XLSX files, detect column schemas, count rows
2. **Map** — Keyword + fuzzy matching maps source columns to target fields with confidence scores. Auto-accept >= 85%, escalate < 50%
3. **Clean** — Deterministic transforms: date parsing (DD/MM/YYYY, Mon DD YYYY, etc.), phone normalization, gender/department enum mapping, name splitting, salary conversion
4. **Deduplicate** — Email exact match + fuzzy name matching (thefuzz library). Auto-merge when one record is strictly more complete
5. **Validate** — Per-field schema validation (email format, date ranges, enum membership, required fields). Auto-fix attempt before escalation
6. **Push** — Mock target API with configurable success rate (default 90%), up to 2 retries per record, full push audit

## Target Schema (14 fields)

| Field | Type | Validation |
|-------|------|------------|
| `employee_id` | String | Required |
| `first_name` | String | Required |
| `last_name` | String | Required |
| `email` | String | Required, valid format |
| `phone` | String | 10+ digits |
| `department` | Enum | Engineering, Marketing, Sales, HR, Finance, Operations, Product, Design, Legal, Support |
| `designation` | String | - |
| `date_of_joining` | Date | YYYY-MM-DD, not future |
| `date_of_birth` | Date | YYYY-MM-DD, age 16-100 |
| `gender` | Enum | Male, Female, Non-binary, Other |
| `location` | String | - |
| `manager_email` | String | Valid email format |
| `employment_type` | Enum | Full-time, Part-time, Contract, Intern |
| `salary` | Number | > 0 |

## Mock Test Data

4 intentionally messy files are included (135 total rows, 15+ overlapping employees):

| File | Rows | Issues |
|------|------|--------|
| `employees_old_system.csv` | 50 | DD/MM/YYYY dates, non-standard column names (`emp_code`, `fname`, `joining_dt`) |
| `employees_hrms.csv` | 40 | `full_name` needs splitting, abbreviated departments (`Engg`, `Mktg`) |
| `contractors.csv` | 20 | Missing many fields, "Mon DD, YYYY" date format, `hourly_rate` instead of salary |
| `employee_updates.xlsx` | 25 | Partial updates that conflict with earlier files |

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt

# Generate mock data files
python3 mock_data/generate_mock_data.py

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Environment Variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Backend API base URL |

## Usage Walkthrough

1. **Create a session** — Name your migration run (e.g., "Q4 HR Data Migration")
2. **Upload files** — Drag & drop the 4 mock CSV/XLSX files
3. **Start the agent** — Watch real-time progress via SSE in the Agent Log panel
4. **Review column mappings** — See confidence scores, override any mapping
5. **Resolve escalations** — For each batch, choose:
   - **Accept** the agent's suggestion
   - **Reject** (skip the record)
   - **Override** with your own value
6. **Resume the agent** — It continues from where it paused
7. **Push records** — Send validated data to the mock target API (with confirmation dialog)
8. **View delta report** — See the split: what % was automated vs. human-decided

## Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Landing | `/` | Create/resume sessions, feature overview |
| Upload | `/session/[id]/upload` | Drag-drop files, view detected schemas, start agent |
| Mapping | `/session/[id]/mapping` | Column mapping table with confidence bars, override dropdowns |
| Review | `/session/[id]/review` | Escalation cards (accept/reject/override), data preview, agent log |
| Push | `/session/[id]/push` | Push results, retry failed, delta report |

All pages share: step indicator, session status badge, tab navigation, responsive layout.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions` | List sessions |
| `GET` | `/api/sessions/{id}` | Get session details |
| `POST` | `/api/sessions/{id}/upload` | Upload CSV/XLSX files |
| `GET` | `/api/sessions/{id}/files` | List uploaded files |
| `POST` | `/api/sessions/{id}/run` | Start migration agent |
| `POST` | `/api/sessions/{id}/resume` | Resume after review |
| `GET` | `/api/sessions/{id}/stream` | SSE real-time event stream |
| `GET` | `/api/sessions/{id}/mappings` | Column mappings with confidence |
| `PUT` | `/api/sessions/{id}/mappings/{mid}` | Override a mapping |
| `GET` | `/api/sessions/{id}/escalations` | List escalations |
| `PUT` | `/api/sessions/{id}/escalations/{eid}` | Resolve an escalation |
| `POST` | `/api/sessions/{id}/escalations/batch` | Bulk resolve escalations |
| `GET` | `/api/sessions/{id}/records` | Migration records |
| `GET` | `/api/sessions/{id}/records/count` | Record counts (total/active/duplicates) |
| `POST` | `/api/sessions/{id}/push` | Push to mock target API |
| `POST` | `/api/sessions/{id}/push/retry` | Retry failed pushes |
| `GET` | `/api/sessions/{id}/delta` | Human vs AI contribution report |
| `GET` | `/api/sessions/{id}/audit` | Full audit log |

## Key Design Decisions

- **Deterministic-first matching**: Column mapping uses keyword dictionaries + fuzzy string matching (thefuzz) with explicit confidence thresholds. No LLM dependency means instant, reproducible results.
- **Phase-level batching**: Agent completes an entire phase and batches all escalations, minimizing human context-switching.
- **SSE for real-time updates**: Server-Sent Events stream agent progress to the frontend — no polling.
- **SQLAlchemy `flag_modified`**: JSON column mutations are explicitly flagged so SQLAlchemy's change detection works correctly with SQLite.
- **Configurable autonomy thresholds**: Auto-accept >= 85% confidence, escalate < 50%. The band between 50-85% is accepted but flagged for optional review.
- **Mock target API with realistic failure**: 90% success rate with retry support tests the push pipeline's error handling.
- **Full audit trail**: Every agent action and human decision is logged with actor attribution (`agent` vs `human`), enabling the delta report.

## Tech Stack

### Backend
| Package | Purpose |
|---------|---------|
| FastAPI | REST API + async support |
| SQLAlchemy | ORM with SQLite |
| pandas + openpyxl | CSV/XLSX parsing |
| thefuzz | Fuzzy string matching for dedup + mapping |
| sse-starlette | Server-Sent Events streaming |

### Frontend
| Package | Purpose |
|---------|---------|
| Next.js 16 | React framework with App Router |
| React 19 | UI with `use()` hook for async params |
| Tailwind CSS 4 | Utility-first styling |
| lucide-react | Icon library |

## Project Structure

```
├── backend/
│   ├── main.py                          # FastAPI app, CORS, startup
│   ├── requirements.txt
│   ├── app/
│   │   ├── config.py                    # Target schema, field definitions
│   │   ├── database.py                  # SQLAlchemy + SQLite setup
│   │   ├── models.py                    # 7 tables (sessions, files, mappings, records, escalations, audit, push_results)
│   │   ├── schemas.py                   # Pydantic request/response models
│   │   ├── routes/
│   │   │   ├── sessions.py              # Session CRUD
│   │   │   ├── upload.py                # File upload + parsing
│   │   │   ├── agent.py                 # Start/resume agent
│   │   │   ├── escalations.py           # Escalation review (single + batch)
│   │   │   ├── records.py               # Records, mappings, delta, audit
│   │   │   └── mock_api.py              # Mock target push + retry
│   │   ├── agent/
│   │   │   ├── orchestrator.py          # Main agent loop (6 phases + SSE)
│   │   │   ├── schema_mapper.py         # Keyword + fuzzy column mapping
│   │   │   ├── data_cleaner.py          # Deterministic transforms
│   │   │   ├── validator.py             # Per-field validation rules
│   │   │   └── escalation_engine.py     # Autonomy boundary rules
│   │   └── services/
│   │       ├── file_parser.py           # CSV/XLSX → DataFrame
│   │       ├── dedup_service.py         # Email + fuzzy name dedup
│   │       └── mock_target.py           # Simulated target API
│   └── mock_data/
│       └── generate_mock_data.py        # Creates 4 test files
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                 # Landing page
│   │   │   ├── layout.tsx               # Root layout
│   │   │   └── session/[id]/
│   │   │       ├── layout.tsx           # Session layout (step indicator, tabs)
│   │   │       ├── upload/page.tsx      # File upload + agent start
│   │   │       ├── mapping/page.tsx     # Column mapping review
│   │   │       ├── review/page.tsx      # Escalation review + agent log
│   │   │       └── push/page.tsx        # Push + delta report
│   │   ├── components/
│   │   │   ├── FileUploader.tsx         # Drag-drop file upload
│   │   │   ├── MappingTable.tsx         # Mapping table with confidence bars
│   │   │   ├── EscalationCard.tsx       # Accept/reject/override card
│   │   │   ├── AgentLog.tsx             # Real-time SSE event log
│   │   │   ├── DataPreviewTable.tsx     # Record data preview
│   │   │   ├── DeltaReport.tsx          # Human vs AI contribution chart
│   │   │   └── StepIndicator.tsx        # Pipeline progress indicator
│   │   ├── hooks/
│   │   │   ├── useSSE.ts               # Server-Sent Events hook
│   │   │   └── useSession.ts           # Session data hook
│   │   └── lib/
│   │       ├── api.ts                   # API client (configurable base URL)
│   │       └── types.ts                 # TypeScript interfaces
│   └── package.json
└── README.md
```
