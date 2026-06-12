---
description: "Task list for Rescale Job Management Dashboard"
---

# Tasks: Rescale Job Management Dashboard

**Input**: Design documents from `specs/001-job-management-dashboard/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Delivery strategy**: One user story at a time. Each phase ends at a code-review checkpoint.
Do not begin Phase N+1 until Phase N is verified working via `docker compose ps` and manual
quickstart.md checks.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: Which user story (US1–US5) this task belongs to
- Include exact file paths in all descriptions

## Path Conventions

```
backend/          Django project root
frontend/         React/TypeScript SPA root
tests/            Playwright E2E tests
docker-compose.yml
Makefile
README.md
```

---

## Phase 1: Setup

**Purpose**: Create the repository skeleton. No application logic yet.

- [x] T001 Create top-level directory structure: `backend/`, `frontend/`, `tests/` at repository root
- [x] T002 [P] Initialize Django project in `backend/`: run `django-admin startproject config .` (produces `backend/manage.py`, `backend/config/`)
- [x] T003 [P] Initialize React+TypeScript Vite project in `frontend/`: run `npm create vite@latest . -- --template react-ts` (produces `frontend/src/`, `frontend/package.json`, `frontend/vite.config.ts`)

---

## Phase 2: US5 Deployment Skeleton

**Purpose**: Get `make build && make up` working with all services healthy. This is the hard gate
(US5 P1). No CRUD logic yet — just a placeholder health endpoint and static React page.

**⚠️ CRITICAL**: No user story work (US1–US4) can begin until this phase is complete and
`make up` shows all services as `healthy`.

- [x] T004 [US5] Create `backend/requirements.txt` with exact pinned versions: `Django==5.1.*`, `djangorestframework==3.15.*`, `psycopg2-binary==2.9.*`, `gunicorn==22.*`
- [x] T005 [US5] Write `backend/Dockerfile`: multi-stage (`python:3.12-slim` builder installs deps, runtime copies app; final CMD: `sh -c "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000"`) — migration runs automatically on every container start, which is safe and idempotent
- [x] T006 [P] [US5] Write `frontend/nginx.conf`: location `/api/` proxies to `http://backend:8000`; location `/` serves SPA with `try_files $uri $uri/ /index.html`
- [x] T007 [P] [US5] Write `frontend/Dockerfile`: multi-stage (`node:20-alpine` builder runs `npm ci && npm run build`; `nginx:alpine` runtime copies `dist/` to `/usr/share/nginx/html` and `nginx.conf` to `/etc/nginx/conf.d/default.conf`)
- [x] T008 [US5] Create Django `jobs` app: run `python manage.py startapp jobs` inside `backend/`; produces `backend/jobs/`
- [x] T009 [US5] Configure `backend/config/settings.py`: replace SQLite DATABASES block with PostgreSQL using env vars `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`; set `ALLOWED_HOSTS = ['*']` for containerized use; set `SECRET_KEY` from env var
- [x] T010 [US5] Add `rest_framework` and `jobs` to `INSTALLED_APPS` in `backend/config/settings.py`; configure DRF default renderer to JSON only
- [x] T011 [US5] Create health check view in `backend/jobs/views.py`: `GET /api/health/` returns `{"status": "ok"}` with HTTP 200; wire into `backend/config/urls.py` at path `api/health/`
- [x] T012 [US5] Write `docker-compose.yml` with four services: `db` (`postgres:16-alpine`, health check `pg_isready`), `backend` (depends on db healthy, health check `curl -f http://localhost:8000/api/health/`), `frontend` (depends on backend healthy, health check `curl -f http://localhost:80/`), `tests` (placeholder — `depends_on: frontend: condition: service_healthy`)
- [x] T013 [US5] Write `Makefile` with targets: `build` (`docker compose build`), `up` (`docker compose up -d --wait`), `test` (see below — self-contained), `stop` (`docker compose stop`), `clean` (`docker compose down -v --remove-orphans`). The `test` target MUST build and start the stack itself: `docker compose up --build -d --wait && docker compose run --rm tests echo "no tests yet"` — this ensures `make test` alone works on a clean machine as required by the assignment
- [x] T014 [P] [US5] Update `frontend/tsconfig.json` to enable `"strict": true`; create directory stubs `frontend/src/components/`, `frontend/src/services/`, `frontend/src/types/`
- [x] T015 [US5] Stub `frontend/src/App.tsx` to render a single `<h1>Job Dashboard</h1>` heading with no API calls (replaces Vite default content)

**Checkpoint**: `make build && make up` completes without errors. `docker compose ps` shows all
three services (db, backend, frontend) as healthy. `curl http://localhost:8000/api/health/`
returns `{"status": "ok"}`. Browser at `http://localhost:3000/` shows "Job Dashboard".

---

## Phase 3: US1 — View All Jobs (Priority: P1) 🎯 MVP

**Goal**: Fetch and display a paginated list of jobs, each showing name and current status.
Empty state shown when no jobs exist. API errors surface a readable message.

**Independent Test**: Open `http://localhost:3000/` — list renders (empty or with seeded data).
Error scenario: stop the backend container; UI shows an error message, not a blank screen.

### Implementation for User Story 1

- [x] T016 [P] [US1] Define `Job` and `JobStatus` models in `backend/jobs/models.py`: `Job` has `id` (AutoField PK), `name` (CharField max_length=255), `created_at`/`updated_at` (auto); `JobStatus` has `id`, `job` (FK→Job ON DELETE CASCADE), `status_type` (TextChoices: PENDING/RUNNING/COMPLETED/FAILED), `timestamp` (auto_now_add); add `Meta.indexes` with `Index(fields=['job', '-timestamp'])` on JobStatus
- [x] T017 [US1] Generate and apply initial migration: `python manage.py makemigrations jobs` → `backend/jobs/migrations/0001_initial.py`; apply with `python manage.py migrate` (run via `docker compose exec backend`)
- [x] T018 [US1] Create `StandardPagination` in `backend/jobs/pagination.py`: subclasses `PageNumberPagination`, `page_size = 25`, `page_size_query_param = 'page_size'`, `max_page_size = 100`
- [x] T019 [US1] Create `JobSerializer` in `backend/jobs/serializers.py`: `ModelSerializer` for `Job` with fields `id`, `name`, `current_status` (SerializerMethodField reading from annotated `current_status`), `created_at`, `updated_at`
- [x] T020 [US1] Implement `JobViewSet.list()` in `backend/jobs/views.py`: annotates queryset with `Subquery` selecting latest `status_type` per job (ordered by `-timestamp`), orders by `-created_at`, applies `StandardPagination`
- [x] T021 [US1] Register `JobViewSet` with `DefaultRouter` in `backend/jobs/urls.py`; include `jobs.urls` in `backend/config/urls.py` at prefix `api/`
- [x] T022 [P] [US1] Define TypeScript types in `frontend/src/types/job.ts`: `StatusType` union (`'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'`), `Job` interface, `PaginatedResponse<T>` interface
- [x] T023 [US1] Implement `fetchJobs(page?: number, pageSize?: number): Promise<PaginatedResponse<Job>>` in `frontend/src/services/api.ts`; throws `Error` with message on non-2xx response
- [x] T024 [P] [US1] Create `frontend/src/components/JobRow.tsx`: renders a table row with job `name` and `current_status` as a plain text badge (no interactive controls yet); accepts `job: Job` prop
- [x] T025 [US1] Create `frontend/src/components/JobList.tsx`: fetches jobs on mount with `fetchJobs()`; renders table of `JobRow` components; shows "No jobs yet" when `results` is empty; shows error message string when fetch throws; includes Previous/Next pagination controls (G4 finding — FR-008 satisfied at Phase 3)
- [x] T026 [US1] Replace `frontend/src/App.tsx` content: render `<h1>Job Dashboard</h1>` and `<JobList />`

**Checkpoint**: `http://localhost:3000/` shows the job list (empty). Seeding a job directly via
`curl -X POST http://localhost:8000/api/jobs/ -H 'Content-Type: application/json' -d '{"name":"test"}'`
(after US2 is done — for now verify the GET endpoint returns empty list via curl).

---

## Phase 4: US2 — Create a New Job (Priority: P2)

**Goal**: Create-job form appears on the dashboard. Submitting a valid name adds the job to the
list with PENDING status instantly. Empty-name submission is rejected client-side.

**Independent Test**: Type a name and submit → job appears in list with PENDING. Try submitting
empty → validation error shown, no network request made. Stop backend → submit → API error shown.

### Implementation for User Story 2

- [x] T027 [US2] Create `JobCreateSerializer` in `backend/jobs/serializers.py`: accepts `name` (CharField, required, non-empty); `create()` method uses `@transaction.atomic` to create `Job` then `JobStatus(status_type='PENDING')`; returns serialized job with `current_status`
- [x] T028 [US2] Add `create()` action to `JobViewSet` in `backend/jobs/views.py`: uses `JobCreateSerializer`; returns HTTP 201 with created job body
- [x] T029 [US2] Implement `createJob(name: string): Promise<Job>` in `frontend/src/services/api.ts`; POST to `/api/jobs/`; throw `Error` on non-2xx
- [x] T030 [US2] Create `frontend/src/components/CreateJobForm.tsx`: controlled `<input>` for name; client-side validation blocks submit when name is empty (shows inline "Name is required" message); on submit calls `createJob()`; calls `onCreated(job)` prop callback on success; shows inline API error message on failure; clears input on success
- [x] T031 [US2] Integrate `CreateJobForm` into `frontend/src/App.tsx`: pass `onCreated` callback that re-fetches page 1 (via React key remount of JobList)

**Checkpoint**: Submit a new job in the browser → it appears immediately in the list with PENDING.
Empty submit → error shown. `curl` the list → new job visible with correct status.

---

## Phase 5: US3 — Update Job Status (Priority: P3)

**Goal**: Each job row has a `<select>` dropdown showing current status. Changing the selection
updates the status immediately via PATCH. The history is preserved server-side (new JobStatus
record appended).

**Independent Test**: Change a PENDING job to RUNNING → dropdown and list reflect RUNNING. Reload
page → RUNNING persists. Verify via `GET /api/jobs/` that previous status records still exist
(check via Django admin or DB query).

### Implementation for User Story 3

- [x] T032 [US3] Create `StatusUpdateSerializer` in `backend/jobs/serializers.py`: write-only `status_type` CharField validated against `JobStatus.StatusType.values`; raises `ValidationError` on unknown value
- [x] T033 [US3] Add `partial_update()` action to `JobViewSet` in `backend/jobs/views.py`: validates body with `StatusUpdateSerializer`; creates new `JobStatus(job=instance, status_type=validated_status_type)`; returns updated job serialized with `JobSerializer` (re-annotated)
- [x] T034 [US3] Implement `updateJobStatus(id: number, statusType: StatusType): Promise<Job>` in `frontend/src/services/api.ts`; PATCH to `/api/jobs/{id}/`; throw `Error` on non-2xx
- [x] T035 [US3] Add `<select>` to `frontend/src/components/JobRow.tsx`: options are PENDING/RUNNING/COMPLETED/FAILED; `value` bound to `job.current_status`; `onChange` calls `updateJobStatus()`; on success calls `onUpdated(updatedJob)` prop; on failure shows inline error span next to dropdown; accept `onUpdated: (job: Job) => void` prop; JobList.tsx wired with handleJobUpdated (replaces matching job in local state)

**Checkpoint**: Change status via dropdown → list updates immediately. Reload page → new status
persists. Invalid PATCH body (tested via curl with bad status) → 400 returned.

---

## Phase 6: US4 — Delete a Job (Priority: P4)

**Goal**: Each job row has a Delete button. Clicking it removes the job and all its status
records, and the row disappears from the list immediately.

**Independent Test**: Click Delete → job disappears. Curl `GET /api/jobs/` → job gone. Try
deleting a nonexistent ID via curl → 404 returned.

### Implementation for User Story 4

- [x] T036 [US4] Add `destroy()` action to `JobViewSet` in `backend/jobs/views.py`: deletes the `Job` instance (cascade handles `JobStatus` records via `on_delete=CASCADE`); returns HTTP 204
- [x] T037 [US4] Implement `deleteJob(id: number): Promise<void>` in `frontend/src/services/api.ts`; DELETE to `/api/jobs/{id}/`; throw `Error` on non-2xx
- [x] T038 [US4] Add Delete `<button>` to `frontend/src/components/JobRow.tsx`: on click calls `deleteJob(job.id)`; on success calls `onDeleted(job.id)` prop; on failure shows inline error message; accept `onDeleted: (id: number) => void` prop
- [x] T039 [US4] Wire `onUpdated` and `onDeleted` callbacks in `frontend/src/components/JobList.tsx`: `onUpdated` replaces the matching job in local state; `onDeleted` filters the job out of local state; pass these down to each `JobRow`

**Checkpoint**: Full CRUD cycle works in the browser without page reloads. `make up` still passes
health checks after the full cycle.

---

## Phase 7: US5 E2E Tests (Playwright)

**Goal**: `make test` runs Playwright E2E tests against the live Docker stack and exits 0.
Covers the two required critical flows: (a) create job → verify PENDING, (b) update status.

**Independent Test**: `make test` exits 0. Re-running `make stop && make up && make test` also
exits 0 (deterministic).

### Implementation for User Story 5 (E2E continuation)

- [ ] T040 [US5] Create `tests/package.json` with `@playwright/test@^1.50.0` as the only dependency; add `"test"` script: `playwright test`
- [ ] T041 [US5] Create `tests/playwright.config.ts`: `baseURL: 'http://frontend'`, `use: { headless: true }`, `workers: 1`, `retries: 0`, `testDir: './e2e'`
- [ ] T042 [P] [US5] Write `tests/Dockerfile`: `FROM mcr.microsoft.com/playwright:v1.50.0-noble`; `WORKDIR /app`; copy `package.json` + `package-lock.json`; `RUN npm ci`; copy `e2e/` and `playwright.config.ts`; no CMD (command provided by `docker compose run`)
- [ ] T043 [US5] Update `tests` service in `docker-compose.yml`: `build: tests/`; `depends_on: {frontend: {condition: service_healthy}, backend: {condition: service_healthy}}`; `profiles: [test]` so it does not start with `make up`
- [ ] T044 [US5] Write `tests/e2e/jobs.spec.ts` with two tests:
    (a) `test('create job appears with PENDING status')`: navigate to `/`; fill name input; click submit; assert new row appears containing job name and "PENDING"
    (b) `test('update job status is reflected in list')`: create a job via POST API setup; navigate to `/`; find the job row; change `<select>` to "RUNNING"; assert the row now shows "RUNNING"
- [ ] T045 [US5] Update `Makefile` `test` target to be fully self-contained (satisfies assignment "execute make test on a clean machine" requirement):
    ```makefile
    test:
        docker compose up --build -d --wait
        docker compose run --rm tests npx playwright test
    ```
    Remove the placeholder `echo "no tests yet"` from T013. This target builds all images, starts all services (waiting for health checks), then runs Playwright — no prior `make build` or `make up` required

**Checkpoint**: `make test` exits 0 on first run. Re-run from `make clean` also exits 0.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: UX polish, pagination controls, performance docs, README.

- [ ] T046 [P] Style `frontend/src/App.css` and components: add table layout for job list, status color badges (PENDING=gray, RUNNING=blue, COMPLETED=green, FAILED=red), readable form layout; no external CSS framework required (plain CSS acceptable)
- [ ] T047 Add pagination controls to `frontend/src/components/JobList.tsx`: Previous/Next buttons using `next`/`previous` URLs from paginated API response; disable buttons at first/last page; show current page and total count
- [ ] T048 Add loading state to `frontend/src/components/JobList.tsx`: show "Loading..." text (or spinner) while `fetchJobs()` is in-flight; hide list during load
- [ ] T049 [P] Write `README.md` at repository root: setup prerequisites, `make build` / `make up` / `make test` / `make stop` / `make clean` instructions, port reference (backend:8000, frontend:3000), performance considerations writeup (pagination strategy, DB indexes, large dataset behavior), time spent, AI usage / prompt engineering notes
- [ ] T050 Create Django management command `backend/jobs/management/commands/seed_jobs.py`: accepts `--count N` arg; creates N jobs with random statuses for pagination testing (validates SC-005 with 10,000+ rows)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US5 Skeleton)**: Depends on Phase 1 — BLOCKS all user story work
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 3 completion (needs Job model + list)
- **Phase 5 (US3)**: Depends on Phase 4 completion (needs create flow to make test jobs)
- **Phase 6 (US4)**: Depends on Phase 5 completion (full CRUD before E2E)
- **Phase 7 (US5 E2E)**: Depends on Phase 6 — all CRUD operations must exist for E2E flows
- **Phase 8 (Polish)**: Depends on Phase 7 (tests must pass before polish)

### Within Each Phase

- Tasks marked [P] within the same phase can run in parallel
- Backend serializer/view tasks depend on model tasks (T016 before T019, T020)
- Frontend service tasks depend on type definitions (T022 before T023–T025)
- `docker compose exec` / migration tasks require Phase 2 to be `make up`'d

### Parallel Opportunities

```bash
# Phase 1 — run together:
T002: Initialize Django project
T003: Initialize React project

# Phase 2 — run in parallel groups:
Group A: T004, T005          (backend Dockerfile + requirements)
Group B: T006, T007          (frontend Dockerfile + nginx.conf)
Group C: T012, T013          (docker-compose + Makefile)
Group D: T014, T015          (frontend TS config + App stub)
T008, T009, T010, T011       (sequential: Django app setup)

# Phase 3 — parallel groups:
Group A: T016, T022          (models + TS types — no dependencies)
Group B: T024               (JobRow — needs types from T022)
T017 after T016 (migration)
T018, T019, T020 after T017 (serializers, pagination, viewset)
T023 after T022 (api.ts fetchJobs)
T025 after T023, T024 (JobList)

# Phase 7 — parallel:
T040 + T041 + T042           (package.json + playwright.config + Dockerfile)
T044 after T043              (tests after docker-compose wired)
```

---

## Implementation Strategy

### MVP: Phases 1–3 + Partial Phase 7

1. Phase 1: Setup
2. Phase 2: US5 Skeleton → verify `make up` healthy
3. Phase 3: US1 View Jobs → verify list renders and API responds
4. **STOP and REVIEW**: Manual test via quickstart.md Scenarios 1–3

### Incremental Delivery

5. Phase 4 (US2) → review → Phase 5 (US3) → review → Phase 6 (US4) → review
6. Phase 7 (E2E) → `make test` passes → **submit-ready**
7. Phase 8 (Polish) → final README and styling

### One-Story-at-a-Time Rule

Each phase ends at a named checkpoint. The next phase begins only after the checkpoint is
manually verified using `docker compose ps` (all healthy) and the relevant quickstart.md
scenarios. This ensures every increment is reviewable and working — never half-finished.

---

## Notes

- [P] tasks = different files, no shared state — can be dispatched in parallel
- [USN] label maps each task to its user story for traceability
- Migration tasks require a running `db` container: `docker compose exec backend python manage.py migrate`
- Django `@transaction.atomic` on job creation ensures Job + initial JobStatus are created together
- The `profiles: [test]` on the `tests` service prevents it from starting with `make up` (only `make test`)
- All TypeScript in `frontend/` must compile with `strict: true` — no `any` types except at API boundary
- Status badge colors in CSS: use data attributes or className mapping, not inline styles
