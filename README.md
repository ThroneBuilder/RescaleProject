# Rescale Job Management Dashboard

A full-stack job management dashboard built with Django + PostgreSQL (backend), React + TypeScript (frontend), Playwright E2E tests, and Docker Compose orchestration.

## Prerequisites

- Docker (with Compose v2 — `docker compose` not `docker-compose`)
- GNU Make
- Nothing else. All runtimes (Python, Node, Playwright browsers) run inside containers.

## Quick Start

```bash
make build   # build all Docker images
make up      # start the stack (db → backend → frontend, health-checked)
```

Open http://localhost:3000 in your browser.

## Make Targets

| Command       | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| `make build`  | Build all Docker images without starting containers                         |
| `make up`     | Start the full stack in the background and wait for all health checks       |
| `make test`   | Build the stack, run Playwright E2E tests in Docker, then exit              |
| `make stop`   | Stop all running containers (volumes preserved)                             |
| `make clean`  | Stop and remove all containers, volumes, and orphaned networks              |

## Port Reference

| Service  | Host port | Notes                                       |
|----------|-----------|---------------------------------------------|
| frontend | 3000      | nginx serving the React SPA + API proxy     |
| backend  | 8000      | Django/DRF (exposed directly for debugging) |
| db       | 5432      | PostgreSQL 16 (exposed for debugging)       |

The React app calls the API at `/api/` which nginx proxies to `http://backend:8000` — no CORS configuration needed.

## Seeding Data

To populate the database with jobs for pagination testing:

```bash
docker compose exec backend python manage.py seed_jobs --count 500
```

## API Endpoints

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | `/api/jobs/`          | Paginated list (`?page=N&page_size=N`)   |
| POST   | `/api/jobs/`          | Create a job (body: `{"name": "..."}`)   |
| PATCH  | `/api/jobs/{id}/`     | Update status (`{"status_type": "..."}`) |
| DELETE | `/api/jobs/{id}/`     | Delete a job                             |
| GET    | `/api/health/`        | Health check (`{"status": "ok"}`)        |

Status values: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`

## Performance Considerations

### Pagination Strategy

The list endpoint uses **offset-based pagination** (`?page=N&page_size=N`, default `page_size=25`, max `100`). This keeps each page query cheap — the backend fetches only the rows for the requested page, never a full table scan.

Trade-off vs cursor-based pagination: offset pagination supports arbitrary page jumps and is simpler to implement and reason about. For this dashboard's use case (sequential browsing of recent jobs), offset is appropriate. At extremely large offsets (e.g. page 10,000 of 100,000 rows), PostgreSQL must skip N rows internally, which becomes O(N). A cursor-based approach would eliminate this but requires a stable, unique sort key and makes "go to page X" impossible.

### Database Indexes

Each job's current status is resolved via a **correlated subquery** that fetches the latest `JobStatus` row for each job:

```sql
SELECT status_type FROM job_statuses
WHERE job_id = <job.pk>
ORDER BY timestamp DESC
LIMIT 1
```

A **composite index** on `(job_id, timestamp DESC)` (`jobs_jobstatus_job_ts_idx`) makes this lookup O(log N) per job regardless of how many status history rows exist. Without it, each lookup would be a full scan of that job's status rows.

### Large Dataset Behavior

With 10,000 jobs and an average of 5 status changes each (50,000 `job_statuses` rows):

- **Page 1 query**: one SQL statement with a correlated subquery, fetching 25 rows. With the index, the status lookup per job is ~O(log 50,000) ≈ 16 comparisons. Total: effectively O(page_size × log N) ≈ fast.
- **Status updates**: append-only (`INSERT` into `job_statuses`, never `UPDATE`). This avoids write contention and preserves full status history.
- **Deletes**: cascade via the FK relationship — deleting a job removes all its status rows in one DB round-trip.

Verified functional with 10,000+ rows via `make test` + `seed_jobs --count 10000`.

## Architecture

```
browser → localhost:3000
            └─ nginx (frontend container)
                  ├─ /        → React SPA (static files)
                  └─ /api/    → proxy → backend:8000 (Django)
                                            └─ PostgreSQL 16
```

All containers are connected on a single Docker bridge network. The `tests` service (Playwright) runs on `--profile test` so it does not start with `make up`.

## Time Spent

Approximately 3–4 hours of human oversight: writing and refining the spec, reviewing each implementation phase, debugging Docker/Playwright integration issues, and writing this README.

Implementation was generated incrementally using AI assistance (see below), with human review and approval between each phase.

## AI Usage & Prompt Engineering

This project was built using **Claude Code** (Anthropic's AI coding assistant) with a structured **Spec Kit** workflow:

1. **Constitution** — governance constraints (deployment integrity, API fidelity, test coverage, UX, performance)
2. **Spec** — user stories with acceptance criteria and non-functional requirements
3. **Clarify** — resolve ambiguities before design (pagination style, status UI, health check approach)
4. **Plan** — architecture, tech stack, file structure, phase ordering
5. **Tasks** — fine-grained task breakdown with parallel markers and dependencies
6. **Implement** — one user story at a time, with testing between phases

**Key prompt engineering decisions:**

- *Incremental delivery*: "implement one user story at a time, allowing for testing and code review between them" — prevented over-building and caught integration issues early (e.g. DRF auth crash in Phase 3, Playwright version mismatch in Phase 7).
- *Boring first*: "optimizing for complete, clean, and explainable, built incrementally starting with the boring version" — kept the code minimal and understandable (plain CSS, no state management library, no ORM magic beyond what DRF provides).
- *Explicit spec phase*: Writing the spec and clarifications before any code generation meant the AI had precise, unambiguous requirements — reducing hallucinated features and scope creep.
- *Phase gates*: Each phase ended with `make test` running in Docker before the next phase began — the AI could not proceed past a broken build.
