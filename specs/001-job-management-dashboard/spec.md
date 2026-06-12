# Feature Specification: Rescale Job Management Dashboard

**Feature Branch**: `001-job-management-dashboard`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "flesh out a spec for this assignment, optimizing for complete, clean,
and explainable, built incrementally starting with the boring version and elaborating after testing
and review"

## User Scenarios & Testing *(mandatory)*

<!--
  Stories are ordered by implementation priority. Each story is independently testable
  and delivers a usable MVP increment on its own. The incremental strategy is:
  boring-first (working > polished), test early, elaborate after review.
-->

### User Story 1 - View All Jobs (Priority: P1)

A user opens the dashboard and sees a paginated list of all existing computational jobs.
Each entry shows the job name and its current status at a glance.

**Why this priority**: Reading jobs is the foundational operation. All other interactions
depend on this list rendering correctly. Without it there is no MVP.

**Independent Test**: Seed the database with several jobs in different statuses. Load the
dashboard. Confirm each job's name and current status appear in the list. Confirm that a
large dataset loads without stalling the browser (only a bounded page is shown).

**Acceptance Scenarios**:

1. **Given** no jobs exist, **When** the user opens the dashboard, **Then** the list is
   empty with a clear "no jobs" indicator.
2. **Given** jobs with different statuses exist, **When** the user opens the dashboard,
   **Then** each job shows its name and its most recent status.
3. **Given** many jobs exist (simulated large dataset), **When** the user opens the
   dashboard, **Then** only a bounded page of results is displayed — the browser does
   not stall or load the entire dataset.

---

### User Story 2 - Create a New Job (Priority: P2)

A user enters a job name in a form and submits it. The new job appears immediately in
the list with a PENDING status — no page reload required.

**Why this priority**: Job creation is the primary write path. It validates the full
create-read cycle end-to-end and is the next logical MVP step after listing.

**Independent Test**: Fill in the job name field with a valid name and submit. Confirm
the new job appears in the list with PENDING status without a full page reload. Then
try submitting with an empty name and confirm the form rejects it with a visible message.

**Acceptance Scenarios**:

1. **Given** the create form is open, **When** the user submits an empty name, **Then**
   the form shows a validation error and does not send a request to the backend.
2. **Given** the create form has a valid name, **When** the user submits, **Then** the
   new job appears in the list with PENDING status — no reload needed.
3. **Given** the backend is unavailable, **When** the user submits a valid name, **Then**
   the UI displays a readable error message and the list remains intact.

---

### User Story 3 - Update Job Status (Priority: P3)

A user selects a new status for an existing job using an inline dropdown (select element)
on the job row. The list immediately reflects the change. Each update preserves history —
it does not overwrite the previous status.

**Why this priority**: Status updates are the core state-transition path that drives job
management. Each change creates a new status record, making history queryable.

**Independent Test**: Change a PENDING job's status to RUNNING via the UI control. Confirm
the list reflects RUNNING immediately. Reload the page and confirm the change persists.

**Acceptance Scenarios**:

1. **Given** a job is in PENDING, **When** the user selects RUNNING from the status
   control, **Then** the job's displayed status updates to RUNNING immediately.
2. **Given** a job is in COMPLETED, **When** the user changes it to FAILED, **Then**
   the change persists and is shown after a page reload.
3. **Given** the backend fails during a status update, **When** the user tries to change
   status, **Then** a readable error is shown and the list stays in its previous valid state.

---

### User Story 4 - Delete a Job (Priority: P4)

A user clicks Delete on a job. It is removed from the list immediately. All associated
status records are removed along with it.

**Why this priority**: Deletion completes the full CRUD cycle. Cascade deletion prevents
orphaned data that would complicate future status queries.

**Independent Test**: Delete a job via the UI. Confirm it disappears from the list
immediately. Verify via the API that its status records are also gone.

**Acceptance Scenarios**:

1. **Given** a job exists, **When** the user clicks Delete, **Then** the job is removed
   from the list immediately without a page reload.
2. **Given** the job had multiple status entries, **When** deleted, **Then** no orphaned
   status records remain (verified via the jobs API returning clean data).
3. **Given** the backend fails during deletion, **When** the user attempts to delete,
   **Then** an error message is displayed and the job remains in the list.

---

### User Story 5 - Reproducible One-Command Deployment and Testing (Priority: P1)

A new evaluator clones the repository and runs `make test` on a Linux or macOS machine
that has only `make`, `docker`, `docker compose`, and `bash` installed. All Playwright
E2E tests pass without any manual setup, configuration, or internet access beyond
DockerHub.

**Why this priority**: This is a hard gate in the evaluation criteria — a failing
deployment means the rest of the submission is not reviewed. It is co-equal with P1
job listing.

**Independent Test**: On a clean environment (no Python, Node, or other runtimes), run
`make build && make up && make test` from the project root. All tests pass. Then run
`make stop` and `make clean` — no containers, volumes, or networks remain.

**Acceptance Scenarios**:

1. **Given** a clean machine with only the required tools, **When** `make build` runs,
   **Then** all Docker images build successfully without errors.
2. **Given** images are built, **When** `make up` runs, **Then** all services (backend,
   database, frontend) become healthy and the application is accessible.
3. **Given** the stack is running, **When** `make test` runs, **Then** all Playwright
   E2E tests pass and exit zero.
4. **Given** the stack is running, **When** `make stop` runs, **Then** all containers
   stop gracefully.
5. **Given** the stack was previously run, **When** `make clean` runs, **Then** all
   volumes and networks are removed leaving a clean slate.

---

### Edge Cases

- What happens when a job name contains special characters (quotes, angle brackets)?
- What if pagination parameters are out of range (negative page, page_size > max)?
- What if the database is not yet ready when the backend container starts?
- What if two users update the same job's status simultaneously?
- What if the frontend container cannot reach the backend API?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display jobs as a paginated list, each showing the job name
  and its current (most recent) status.
- **FR-002**: System MUST allow users to create a new job by providing a name. On
  creation, the job MUST automatically receive an initial PENDING status with no
  additional user action.
- **FR-003**: System MUST prevent submission of a job creation request when the name
  field is empty, displaying a visible validation message before any backend request
  is made. Job names are free-text labels — duplicate names are permitted.
- **FR-004**: System MUST allow users to change a job's status to any of the defined
  states (PENDING, RUNNING, COMPLETED, FAILED). Each status change MUST create a new
  status record — existing records are never mutated.
- **FR-005**: System MUST allow users to delete a job; deletion MUST remove the job
  and all its associated status records atomically.
- **FR-006**: System MUST display a readable error message when any API operation
  (list, create, update, delete) fails, without corrupting or clearing the displayed
  job list.
- **FR-007**: System MUST update the job list dynamically after every create, update,
  and delete operation — no full page reload may be required.
- **FR-008**: System MUST serve jobs via offset-based paginated responses (`?page=N&page_size=N`)
  to support datasets of millions of records without degrading browser or server performance.
  Default page size MUST be 25. Clients MAY override page size via query parameter up to a
  server-enforced maximum.
- **FR-009**: The entire application stack MUST be buildable, startable, and testable
  via `make build`, `make up`, `make test`, `make stop`, and `make clean` — no
  software beyond make, docker, docker compose, and bash may be required on the host.
  Services MUST declare Docker health checks; the test runner MUST depend on all
  services reaching a healthy state before Playwright executes.
- **FR-010**: Playwright E2E tests MUST cover at minimum two critical flows: (a)
  creating a job and verifying it appears with PENDING status; (b) updating a job's
  status and verifying the change is reflected in the UI.
- **FR-011**: System MUST document performance decisions — including how large datasets
  are handled — in the project README.

### Key Entities

- **Job**: A computational task. Identified by a name (duplicates permitted — no uniqueness
  constraint). Records creation and last modification timestamps automatically. Its current
  status is always derived from the most recent status record, not stored directly on the job.
- **Job Status**: An immutable point-in-time record of a job's state. Appended on every
  status change — never updated in place. Belongs to exactly one job. Removal of a job
  removes all its status records. Valid status types: PENDING, RUNNING, COMPLETED, FAILED.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a new job and see it in the list with PENDING status
  within 2 seconds of submitting the form (under normal local conditions).
- **SC-002**: A user can update a job's status and see the change reflected in the list
  within 2 seconds.
- **SC-003**: A user can delete a job and see it removed from the list within 2 seconds.
- **SC-004**: `make test` exits zero on a clean Linux or macOS host (make + docker +
  docker compose + bash only) within 5 minutes of completing `make build`.
- **SC-005**: The job list loads and renders without browser stalling when the database
  contains at least 10,000 job records.
- **SC-006**: All Playwright E2E tests pass on the first run after `make up` with no
  manual intervention.
- **SC-007**: Every API error scenario (network failure, 4xx, 5xx) produces a user-visible
  message and leaves the UI in a consistent, non-broken state.

## Assumptions

- **Single-tenant, no auth**: No user authentication or access control is required for
  this iteration. The dashboard is open to anyone who can reach it.
- **Separate containers**: The frontend and backend run as separate Docker containers.
  The frontend communicates with the backend exclusively via REST API calls.
- **Append-only status history**: Status records are never updated or deleted individually.
  A status change always creates a new record. Deletion of a job cascades to all its
  status records.
- **Current status definition**: The current status of a job is the `status_type` of the
  most recently created `JobStatus` record for that job.
- **Pagination defaults**: Default page size is 25 jobs. Clients may request a different
  page size via the `page_size` query parameter up to a server-enforced maximum.
- **E2E scope**: The test suite is intentionally minimal — two critical flows per the
  assignment brief. Broader unit and integration tests are out of scope for this iteration.
- **Service readiness**: Docker-native health checks with `depends_on: condition: service_healthy`
  ensure the database, backend, and frontend are ready before Playwright tests execute.
  No external wait scripts are required.
- **Tech stack is fixed**: Django/PostgreSQL (backend), React/TypeScript (frontend),
  Playwright (E2E), Docker + Docker Compose (orchestration), GNU Make (top-level interface)
  are all prescribed by the assignment brief and are treated as constraints, not design
  decisions.
- **Incremental delivery order**: (1) Working backend API + minimal frontend, verified
  by E2E tests; (2) UX polish and styling; (3) Performance optimizations; (4) README
  and deployment hardening. Each step is reviewed before the next begins.

## Clarifications

### Session 2026-06-12

- Q: What pagination strategy should the API use? → A: Offset-based (`?page=N&page_size=N`), default page size 25, using Django's built-in paginator.
- Q: Should job names be unique across the system? → A: No — names are free-text labels; duplicates are permitted.
- Q: What UI mechanism should be used to update job status? → A: Inline `<select>` dropdown on each job row.
- Q: How should `make test` ensure services are ready before Playwright runs? → A: Docker health checks + `depends_on: condition: service_healthy` — no external scripts.
