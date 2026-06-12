# Quickstart Validation Guide: Rescale Job Management Dashboard

**Date**: 2026-06-12
**Prerequisites**: `make`, `docker`, `docker compose`, `bash` installed on host.
No other software required.

---

## Scenario 1: Build and Start the Stack

**Purpose**: Verify the entire stack builds and starts from scratch.

```bash
# From project root:
make build   # Build all Docker images
make up      # Start all services (waits for health checks to pass)
```

**Expected outcome**:
- `make build` completes without errors. Three images built: `backend`, `frontend`, `tests`.
- `make up` returns after all services reach healthy state (db → backend → frontend).
- No container crash-loops (`docker compose ps` shows all services as `healthy` or `running`).

---

## Scenario 2: Verify the API is Reachable

**Purpose**: Confirm the backend responds and the health endpoint works.

```bash
curl http://localhost:8000/api/health/
# Expected: {"status": "ok"}

curl http://localhost:8000/api/jobs/
# Expected: {"count": 0, "next": null, "previous": null, "results": []}
```

Also reachable via nginx proxy:
```bash
curl http://localhost:3000/api/health/
# Expected: {"status": "ok"}
```

---

## Scenario 3: Verify the UI is Accessible

**Purpose**: Confirm the React app serves correctly.

Open `http://localhost:3000/` in a browser.

**Expected outcome**:
- The dashboard loads without errors.
- An empty job list is shown (or a "no jobs" message).
- The create-job form is visible.

---

## Scenario 4: Create a Job (Manual)

**Purpose**: Verify the create flow end-to-end.

1. In the browser at `http://localhost:3000/`:
   - Type a job name (e.g., "Fluid Dynamics Simulation") in the create form.
   - Submit.
2. **Expected**: The new job appears in the list with status `PENDING`.

Alternatively via API:
```bash
curl -X POST http://localhost:3000/api/jobs/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Fluid Dynamics Simulation"}'
# Expected: 201 Created, body includes "current_status": "PENDING"
```

---

## Scenario 5: Update Job Status (Manual)

**Purpose**: Verify the status-update flow.

1. In the browser, find the job created in Scenario 4.
2. Change the status dropdown from `PENDING` to `RUNNING`.
3. **Expected**: The status in the list updates to `RUNNING` immediately (no page reload).

Alternatively via API:
```bash
curl -X PATCH http://localhost:3000/api/jobs/1/ \
  -H "Content-Type: application/json" \
  -d '{"status_type": "RUNNING"}'
# Expected: 200 OK, body includes "current_status": "RUNNING"
```

---

## Scenario 6: Delete a Job (Manual)

**Purpose**: Verify the delete flow.

1. In the browser, click the Delete button on the job from Scenario 4.
2. **Expected**: The job disappears from the list immediately.

Alternatively via API:
```bash
curl -X DELETE http://localhost:3000/api/jobs/1/
# Expected: 204 No Content
curl http://localhost:3000/api/jobs/
# Expected: {"count": 0, ..., "results": []}
```

---

## Scenario 7: Run Playwright E2E Tests

**Purpose**: Verify the automated test suite passes.

```bash
make test
```

**Expected outcome**:
- All Playwright tests pass (exit code 0).
- Test output confirms: (a) create job → PENDING verified; (b) update status → change verified.

---

## Scenario 8: Validate Pagination

**Purpose**: Verify large-dataset handling.

Seed 50+ jobs via the API, then:
```bash
curl "http://localhost:3000/api/jobs/?page=1&page_size=25"
# Expected: "count" ≥ 50, "results" contains exactly 25 items, "next" is non-null

curl "http://localhost:3000/api/jobs/?page=2&page_size=25"
# Expected: "results" contains the next 25 items
```

---

## Scenario 9: Stop and Clean

**Purpose**: Verify the teardown commands work cleanly.

```bash
make stop    # Stops all containers
make clean   # Removes containers, volumes, networks
```

**Expected outcome**:
- `docker compose ps` shows no running containers after `make stop`.
- `docker volume ls` shows no project volumes after `make clean`.
- Running `make build && make up && make test` again from this state succeeds (fully
  repeatable).

---

## Failure Indicators

| Symptom | Likely cause |
|---------|-------------|
| `make up` hangs indefinitely | Health check failing — check `docker compose logs backend` or `docker compose logs db` |
| `make test` exits non-zero | Service not ready or a test assertion failed — check Playwright output |
| `curl` to `/api/` returns 502 | nginx cannot reach `backend:8000` — check backend container logs |
| React app shows blank screen | Build error or nginx misconfiguration — check `docker compose logs frontend` |
| `make clean` leaves volumes | Use `docker compose down -v` manually if `make clean` is incomplete |

---

## Reference

- API contract: [contracts/api.md](contracts/api.md)
- Data model: [data-model.md](data-model.md)
- Port mappings: backend → `localhost:8000`, frontend → `localhost:3000`
