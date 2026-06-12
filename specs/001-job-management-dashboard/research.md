# Research: Rescale Job Management Dashboard

**Date**: 2026-06-12
**Input**: spec.md + constitution.md + user direction (one story at a time, boring first)

---

## Decision 1: Backend Framework & Version

**Decision**: Django 5.1 + Django REST Framework 3.15 + Python 3.12

**Rationale**: Django 5.1 is current stable. Python 3.12 is the LTS-adjacent release with
the best Docker image availability (`python:3.12-slim`). DRF is the de-facto standard for
Django REST APIs — minimal boilerplate, built-in pagination, browsable API for debugging.

**Alternatives considered**:
- FastAPI: better async performance but more setup for this CRUD-heavy workload; DRF's
  `ModelViewSet` reduces boilerplate significantly for the four specified endpoints.
- Django 4.2: still supported but 5.x is current and evaluation environments are fresh.

---

## Decision 2: Database & Driver

**Decision**: PostgreSQL 16 with `psycopg2-binary` driver

**Rationale**: PostgreSQL 16 is the current stable release, available on DockerHub as
`postgres:16-alpine` (small image). `psycopg2-binary` bundles its own libpq, avoiding
OS-level dependency installation in the Dockerfile.

**Alternatives considered**:
- `psycopg3` (psycopg): newer async-capable driver; the sync flavour works fine with
  Django but binary wheel availability in Alpine is inconsistent — `psycopg2-binary` is
  safer for the evaluation environment.

---

## Decision 3: Latest-Status Query Strategy

**Decision**: Annotate the Job queryset with a `Subquery` or use `select_related` +
`prefetch_related` to fetch the latest `JobStatus` per job.

**Rationale**: The most efficient approach at scale is to annotate `Job.objects.all()`
with a subquery that selects `status_type` from the `JobStatus` row with the maximum
`timestamp` for each job. This avoids N+1 queries and keeps the paginated list query
to a single round-trip.

```python
from django.db.models import OuterRef, Subquery

latest_status = JobStatus.objects.filter(
    job=OuterRef('pk')
).order_by('-timestamp').values('status_type')[:1]

queryset = Job.objects.annotate(
    current_status=Subquery(latest_status)
).order_by('-created_at')
```

**Index required**: Composite index on `JobStatus(job_id, timestamp DESC)` to make the
subquery fast. This index supports both the status lookup and the cascade delete query.

---

## Decision 4: Pagination

**Decision**: DRF `PageNumberPagination` with default `page_size=25`, max `page_size=100`

**Rationale**: Specified in clarifications (offset-based, `?page=N&page_size=N`). DRF's
built-in paginator produces `count`, `next`, `previous`, and `results` envelope — standard
and reviewer-familiar. Setting `max_page_size=100` prevents clients from pulling the
entire table.

```python
class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100
```

---

## Decision 5: Frontend Build Tooling

**Decision**: Vite 5 + React 18 + TypeScript 5 (`npm create vite@latest`)

**Rationale**: Vite has superseded Create React App as the community standard. Fast dev
server (not needed for CI but useful during development), small production bundle,
excellent TypeScript support. `react-ts` template gives strict TypeScript out of the box.

**Alternatives considered**:
- Create React App: officially unmaintained as of 2023; avoids it.
- Next.js: SSR overkill for this SPA; adds Dockerfile complexity.

---

## Decision 6: Frontend-to-Backend Communication & CORS

**Decision**: nginx reverse proxy — React served at `/`, API proxied at `/api/` → Django.
No CORS configuration needed.

**Rationale**: By having nginx proxy `/api/` requests to the Django backend, all browser
requests originate from the same host+port (port 3000 externally or port 80 inside Docker
network). This eliminates the cross-origin problem entirely without requiring
`django-cors-headers`. It also means React uses relative API paths (`/api/jobs/`), making
the app portable across environments.

```nginx
location /api/ {
    proxy_pass http://backend:8000;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

**Alternatives considered**:
- `django-cors-headers`: works but adds a dependency and requires careful ALLOWED_ORIGINS
  configuration that can fail in CI if the frontend hostname/port changes.

---

## Decision 7: Docker Service Architecture

**Decision**: Four Docker services in `docker-compose.yml`:
1. `db` — `postgres:16-alpine`
2. `backend` — multi-stage Django build (`python:3.12-slim`)
3. `frontend` — multi-stage React build (Node 20 + `nginx:alpine`)
4. `tests` — `mcr.microsoft.com/playwright:v1.50.0-noble` for E2E

**Rationale**: Keeping services separate aligns with the constitution and lets each
container be independently health-checked. The `tests` service runs headless Playwright
against the live `frontend` and `backend` via the Docker internal network.

**Multi-stage Dockerfile pattern (backend)**:
```dockerfile
FROM python:3.12-slim AS builder
# Install deps
FROM python:3.12-slim AS runtime
COPY --from=builder /app /app
```

**Multi-stage Dockerfile pattern (frontend)**:
```dockerfile
FROM node:20-alpine AS builder
RUN npm ci && npm run build
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

## Decision 8: Docker Health Checks & Service Readiness

**Decision**: Native Docker health checks on `db` and `backend`; `tests` depends on both
`frontend` and `backend` being healthy.

**db health check**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
  interval: 5s
  timeout: 5s
  retries: 10
```

**backend health check**: Requires a `GET /api/health/` endpoint returning `200 OK`.
```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health/ || exit 1"]
  interval: 5s
  timeout: 5s
  retries: 10
```

**frontend health check**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:80/ || exit 1"]
  interval: 5s
  timeout: 5s
  retries: 10
```

**Rationale**: Declarative health checks with `depends_on: condition: service_healthy`
ensure the test container only starts after all application services are ready. No
external wait scripts needed (per clarification Q4).

---

## Decision 9: Playwright Configuration

**Decision**: Playwright tests run inside the `tests` Docker service using
`mcr.microsoft.com/playwright` image. Tests target `http://frontend:80` (internal Docker
network URL). `make test` runs `docker compose run --rm tests`.

**Rationale**: The Playwright Docker image bundles Chromium/Firefox/WebKit and all system
dependencies. Running inside Docker ensures tests have no dependency on the host Playwright
installation. Using the internal Docker network URL (`http://frontend:80`) allows tests to
hit the nginx-proxied app that in turn reaches the backend at `http://backend:8000`.

---

## Decision 10: Makefile Strategy

**Decision**:
```makefile
build:
    docker compose build

up:
    docker compose up -d --wait

test:
    docker compose up --build -d --wait
    docker compose run --rm tests npx playwright test

stop:
    docker compose stop

clean:
    docker compose down -v --remove-orphans
```

`make test` is self-contained — it builds images and starts all services before running
Playwright. This satisfies the assignment requirement that evaluators run only `make test`
on a clean machine. `docker compose up --build -d --wait` rebuilds changed images and waits
for all health checks to pass (Docker Compose v2.1+ feature).

`make up` (without build) is provided as a convenience for development when images are
already built and a clean restart is needed without a full rebuild.

---

## Decision 11: Incremental User Story Delivery

**Decision**: Implement stories in order: US5 skeleton → US1 → US2 → US3 → US4 → E2E →
polish. Each story is reviewable independently before the next begins.

- **US5 first (skeleton)**: Set up Docker Compose, Makefile, Django project, React project,
  nginx, health checks — get `make up` working with a placeholder response.
- **US1**: Job list API + React list component (read-only, no create/update/delete).
- **US2**: Create job form + POST endpoint.
- **US3**: Status dropdown + PATCH endpoint.
- **US4**: Delete button + DELETE endpoint.
- **E2E**: Playwright tests (create flow + status update flow).
- **Polish**: Styling, README, performance docs.

**Rationale**: Per user direction and spec Assumptions. Each story can be code-reviewed
as a unit. The boring version (working > polished) ships first.
