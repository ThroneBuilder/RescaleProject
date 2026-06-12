# Implementation Plan: Rescale Job Management Dashboard

**Branch**: `001-job-management-dashboard` | **Date**: 2026-06-12 | **Spec**: [spec.md](spec.md) | **Status**: ✅ COMPLETE

**Input**: Feature specification from `specs/001-job-management-dashboard/spec.md`

**User direction**: Implement one user story at a time, allow testing and code review between each.

## Summary

Build a full-stack Job Management Dashboard: a Django/DRF REST API backed by PostgreSQL,
a React/TypeScript SPA served through nginx, Playwright E2E tests, and a Docker Compose
stack wired with a Makefile. Delivery is incremental — deployment skeleton first, then
each CRUD story one at a time, each reviewable before the next begins.

## Technical Context

**Language/Version**: Python 3.12 (backend), Node 20 LTS (frontend build)

**Primary Dependencies**:
- Backend: Django 5.1, Django REST Framework 3.15, psycopg2-binary, gunicorn
- Frontend: React 18, TypeScript 5, Vite 5
- Infrastructure: PostgreSQL 16, nginx (alpine), Playwright 1.50

**Storage**: PostgreSQL 16 (`postgres:16-alpine`)

**Testing**: Playwright E2E — runs in Docker against the live stack via `make test`

**Target Platform**: Linux containers (Docker); evaluated on Linux/macOS with Docker Compose v2

**Project Type**: Web application — separate backend API container + frontend SPA container

**Performance Goals**:
- Job list renders in < 2 seconds (SC-001–SC-003)
- List stays usable with 10,000+ rows (SC-005): offset pagination (page_size=25) + DB index

**Constraints**:
- No host runtimes beyond `make`, `docker`, `docker compose`, `bash`
- `make test` MUST pass on a clean host (constitution Principle I, US5)
- Offset-based pagination (`?page=N&page_size=N`, default 25, max 100) — clarification Q1
- Inline `<select>` for status updates — clarification Q3
- Docker health checks + `depends_on: condition: service_healthy` — clarification Q4

**Scale/Scope**: Millions of potential job rows; single-tenant, no auth; 4 REST endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Deployment Pipeline Integrity | All services containerized; Makefile exposes build/up/test/stop/clean; no host runtimes required; health checks + `depends_on: service_healthy` | ✅ PASS |
| II. API Contract Fidelity | GET lists with current_status; POST atomically creates Job+PENDING status; PATCH appends new JobStatus (never mutates); DELETE cascades | ✅ PASS |
| III. E2E Test Coverage | Playwright in Docker; tests run via `make test` against live stack; covers create→PENDING and update-status flows | ✅ PASS |
| IV. Frontend Correctness & UX | Dynamic list updates; empty-name validation; inline `<select>` for status; error messages on API failure; TypeScript strict mode | ✅ PASS |
| V. Performance Awareness | Offset pagination (page_size=25); composite index on `(job_id, timestamp DESC)`; frontend handles paginated responses; README documents decisions | ✅ PASS |

All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-job-management-dashboard/
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── contracts/
│   └── api.md       # REST API contract
└── tasks.md         # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── config/
│   ├── __init__.py
│   ├── settings.py          # Django settings (env-var driven)
│   ├── urls.py              # Root URL conf: /api/ → jobs.urls, /api/health/
│   └── wsgi.py
├── jobs/
│   ├── migrations/
│   ├── __init__.py
│   ├── models.py            # Job, JobStatus models + TextChoices
│   ├── serializers.py       # JobSerializer (with current_status), StatusUpdateSerializer
│   ├── views.py             # JobViewSet (list/create/partial_update/destroy)
│   └── urls.py              # Router registration
├── manage.py
├── requirements.txt
└── Dockerfile               # Multi-stage: builder + runtime (python:3.12-slim)

frontend/
├── src/
│   ├── components/
│   │   ├── JobList.tsx      # Paginated job list
│   │   ├── JobRow.tsx       # Single row: name, status dropdown, delete button
│   │   └── CreateJobForm.tsx # Controlled form with empty-name validation
│   ├── services/
│   │   └── api.ts           # All API calls; returns typed promises; throws on error
│   ├── types/
│   │   └── job.ts           # Job, StatusType, PaginatedResponse types
│   ├── App.tsx              # Root: state management, error display
│   └── main.tsx
├── e2e/
│   └── jobs.spec.ts         # Playwright E2E: create flow + status update flow
├── nginx.conf               # nginx: proxy /api/ → backend:8000; SPA fallback
├── package.json
├── tsconfig.json            # strict: true
├── vite.config.ts
└── Dockerfile               # Multi-stage: Node 20 builder + nginx:alpine runtime

docker-compose.yml           # db, backend, frontend, tests services
Makefile                     # build / up / test / stop / clean
README.md                    # Setup instructions + performance writeup
```

**Structure Decision**: Option 2 (web application) — separate `backend/` and `frontend/`
directories at the repository root. The `frontend/` directory also contains the Playwright
E2E test suite (`e2e/`) since Playwright runs in the same Node environment.

## Phase 0: Research

All NEEDS CLARIFICATION items resolved. See [research.md](research.md) for full decisions.

Key decisions summary:
- Django 5.1 + DRF 3.15 + Python 3.12 + psycopg2-binary
- PostgreSQL 16 (`postgres:16-alpine`)
- Vite 5 + React 18 + TypeScript 5
- nginx reverse proxy (no CORS needed; relative API paths)
- Playwright in Docker (`mcr.microsoft.com/playwright:v1.50.0-noble`)
- `docker compose up -d --wait` for health-check-based readiness
- Latest-status via `Subquery` annotation + composite index on `(job_id, timestamp DESC)`

## Phase 1: Design & Contracts

All Phase 1 artifacts generated:

- [data-model.md](data-model.md) — Job and JobStatus field specs, indexes, invariants
- [contracts/api.md](contracts/api.md) — REST API contract, TypeScript types, nginx config
- [quickstart.md](quickstart.md) — Validation scenarios for all user stories

**Post-Phase 1 Constitution Check**: All gates still pass. The nginx proxy approach
(Decision 6) eliminates CORS and keeps the frontend container portable. The `Subquery`
annotation (Decision 3) satisfies Principle V without an extra DB round-trip.

## Incremental Delivery Order

Per user direction — one story at a time, reviewed between each:

| Stage | Stories | Reviewable milestone |
|-------|---------|---------------------|
| 0 | US5 skeleton | `make up` works; `/api/health/` returns 200; React placeholder renders |
| 1 | US1 | Job list renders with paginated data; empty state shown |
| 2 | US2 | Create form submits; new job appears with PENDING |
| 3 | US3 | Status dropdown updates job; change persists |
| 4 | US4 | Delete button removes job from list |
| 5 | E2E | `make test` passes (create + status-update flows) |
| 6 | Polish | Styling, README, performance docs |

Each stage is a code-review checkpoint. Stage N should not begin until Stage N-1 is
verified working (manual check via quickstart.md + `docker compose ps`).

## Complexity Tracking

> No constitution violations — section intentionally omitted.
