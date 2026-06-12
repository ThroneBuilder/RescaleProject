<!-- SYNC IMPACT REPORT
Version change: [template] → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (5 principles)
  - Technology Stack & Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (no changes needed; Constitution Check references are generic and compatible)
  - .specify/templates/spec-template.md ✅ aligned (structure compatible)
  - .specify/templates/tasks-template.md ✅ aligned (phase structure compatible)
Follow-up TODOs: None — all placeholders resolved.
-->

# Rescale Job Management Dashboard Constitution

## Core Principles

### I. Deployment Pipeline Integrity (NON-NEGOTIABLE)

The primary acceptance gate is `make test` passing on a clean Linux or macOS host with
only `make`, `docker`, `docker compose`, and `bash` available. Every architectural and
implementation decision MUST ensure this gate remains green.

- All services MUST be containerized via Docker with explicit, reproducible image builds.
- `docker-compose.yml` MUST orchestrate backend (Django), database (PostgreSQL), and
  frontend (React) as distinct services.
- The Makefile MUST expose exactly: `build`, `up`, `test`, `stop`, `clean`.
- No host-installed runtimes (Python, Node, npm) may be required at any stage of the
  build, test, or run pipeline.
- Health checks or wait-for-ready logic MUST ensure services are ready before tests run.

### II. API Contract Fidelity

The REST API MUST conform exactly to the specified contract. Deviations require explicit
justification and must not break the E2E tests.

- `GET /api/jobs/` MUST return all jobs, each including the `status_type` from the latest
  `JobStatus` entry for that job.
- `POST /api/jobs/` MUST atomically create a `Job` and an initial `JobStatus` of `PENDING`.
- `PATCH /api/jobs/{id}/` MUST create a new `JobStatus` entry rather than mutating existing
  status records — status history is append-only.
- `DELETE /api/jobs/{id}/` MUST cascade-delete all associated `JobStatus` entries.
- All endpoints MUST return appropriate HTTP status codes and structured JSON error responses.

### III. E2E Test Coverage (NON-NEGOTIABLE)

At least one Playwright E2E test MUST cover a complete critical user flow against the
live, containerized stack. Tests are the final arbiter of correctness.

- Tests MUST execute via `make test` against the Docker Compose stack (not mocks or stubs).
- Each E2E test MUST assert observable UI state — not just API responses.
- Critical flows to cover: (a) create a new job and verify it appears with PENDING status;
  (b) update a job's status and verify the change is reflected in the UI.
- Tests MUST be deterministic and idempotent — re-running `make test` MUST produce the
  same result.

### IV. Frontend Correctness & UX Integrity

The React/TypeScript frontend MUST be functional, dynamically responsive, and gracefully
handle errors at all API boundaries.

- The job list MUST display each job's name and current status, refreshing after every
  create, update, or delete action without requiring a full page reload.
- The create-job form MUST enforce client-side validation (name cannot be empty) before
  submitting to the API.
- Each job row MUST expose controls to update status (to any defined state) and delete
  the job.
- API errors MUST surface a user-visible message — silent failures are not acceptable.
- TypeScript strict mode MUST be enabled; `any` types are prohibited except at explicit
  API boundary serialization points.

### V. Performance Awareness for Large Datasets

The implementation MUST assume the job table could contain millions of rows. All data
retrieval paths MUST be bounded.

- `GET /api/jobs/` MUST implement server-side pagination (page + page_size or cursor-based).
- Database indexes MUST exist on `job_id` (FK on `JobStatus`) and `timestamp` (for latest
  status lookup efficiency).
- The frontend MUST handle paginated responses — it MUST NOT load the entire dataset into
  memory at once.
- Performance decisions and any query optimizations MUST be documented in `README.md`.

## Technology Stack & Constraints

**Backend**: Django (Python 3.11+) with Django REST Framework; PostgreSQL 15+.

**Frontend**: React with TypeScript, bootstrapped via Vite or Create React App.

**Testing**: Playwright for E2E tests. Tests run against the live Docker Compose stack.

**Containerization**: Docker (multi-stage builds encouraged for smaller images); Docker
Compose v2 for orchestration.

**Build Tooling**: GNU Make for the top-level developer interface.

**No additional runtimes** may be required on the host beyond `make`, `docker`,
`docker compose`, and `bash`.

**Status states** MUST include at minimum: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`.

## Development Workflow & Quality Gates

**Order of operations**: API contract → Django models + migrations → REST endpoints →
React components → E2E tests → Docker/Compose integration → Makefile wiring.

**Quality gates** (all MUST pass before a feature is considered complete):
1. `make build` succeeds from a clean state with no pre-pulled images.
2. `make up` brings all services healthy within a reasonable timeout.
3. `make test` executes all Playwright E2E tests and they pass.
4. `make stop` and `make clean` leave no dangling containers or volumes.

**Code quality standards**:
- Backend: PEP 8 compliance; Django best practices (signals or `save()` override for
  auto-creating initial `JobStatus`; `select_related`/`prefetch_related` for status joins).
- Frontend: No `console.error` left unhandled in production paths; components are
  single-responsibility.
- Error handling: every API call in the frontend MUST have a `.catch()` or `try/catch`
  that updates UI state.

**README.md** MUST contain: setup instructions, Makefile command reference, performance
considerations writeup, and time-spent disclosure (per assignment requirements).

## Governance

This constitution supersedes all other implied practices for the Rescale Job Management
Dashboard project. It is the authoritative source of non-negotiable rules.

**Amendment procedure**: Any change to a Core Principle requires an explicit version bump
with rationale. Governance or workflow changes are MINOR bumps. Principle removals or
redefinitions are MAJOR bumps. Clarifications are PATCH bumps.

**Versioning policy** (semantic):
- MAJOR: Backward-incompatible governance or principle removal/redefinition.
- MINOR: New principle or materially expanded guidance added.
- PATCH: Clarifications, wording, non-semantic refinements.

**Compliance**: All implementation tasks MUST be reviewed against the Constitution Check
gate in the plan before Phase 0 research begins, and re-checked after Phase 1 design.

**Version**: 1.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-06-12
