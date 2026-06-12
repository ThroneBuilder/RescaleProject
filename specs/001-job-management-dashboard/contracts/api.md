# API Contract: Rescale Job Management Dashboard

**Date**: 2026-06-12
**Base URL**: `/api/` (all endpoints are relative to this prefix)
**Format**: JSON request/response bodies
**Pagination**: Offset-based (`?page=N&page_size=N`), default `page_size=25`, max `page_size=100`

---

## Conventions

- All timestamps are ISO 8601 UTC strings: `"2026-06-12T14:30:00.000Z"`
- `current_status` on a Job is derived from the latest `JobStatus.status_type`
- Error responses follow the DRF default shape: `{"field": ["error message"]}` or
  `{"detail": "error message"}` for non-field errors
- HTTP status codes follow REST conventions (200 OK, 201 Created, 204 No Content,
  400 Bad Request, 404 Not Found, 500 Internal Server Error)

---

## Endpoints

### GET /api/health/

Liveness check for Docker health checks and monitoring.

**Request**: No body, no parameters.

**Response** `200 OK`:
```json
{"status": "ok"}
```

---

### GET /api/jobs/

Return a paginated list of all jobs, each including the current status.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `page_size` | integer | 25 | Results per page (max 100) |

**Response** `200 OK`:
```json
{
  "count": 142,
  "next": "http://localhost:8000/api/jobs/?page=2&page_size=25",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Fluid Dynamics Simulation",
      "current_status": "RUNNING",
      "created_at": "2026-06-12T10:00:00.000Z",
      "updated_at": "2026-06-12T10:05:00.000Z"
    },
    {
      "id": 2,
      "name": "ML Model Training",
      "current_status": "PENDING",
      "created_at": "2026-06-12T10:01:00.000Z",
      "updated_at": "2026-06-12T10:01:00.000Z"
    }
  ]
}
```

**Sort order**: `created_at DESC` (newest first)

---

### POST /api/jobs/

Create a new job. Atomically creates the Job and an initial `PENDING` JobStatus record.

**Request Body**:
```json
{
  "name": "Fluid Dynamics Simulation"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Non-empty, max 255 chars |

**Response** `201 Created`:
```json
{
  "id": 3,
  "name": "Fluid Dynamics Simulation",
  "current_status": "PENDING",
  "created_at": "2026-06-12T14:30:00.000Z",
  "updated_at": "2026-06-12T14:30:00.000Z"
}
```

**Response** `400 Bad Request` (empty name):
```json
{
  "name": ["This field may not be blank."]
}
```

---

### PATCH /api/jobs/{id}/

Update a job's status. Creates a new `JobStatus` record with the provided `status_type`.
Does not mutate existing status records.

**Path Parameter**: `id` — integer primary key of the job.

**Request Body**:
```json
{
  "status_type": "RUNNING"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status_type` | string | Yes | One of: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |

**Response** `200 OK` (returns updated job with new current_status):
```json
{
  "id": 3,
  "name": "Fluid Dynamics Simulation",
  "current_status": "RUNNING",
  "created_at": "2026-06-12T14:30:00.000Z",
  "updated_at": "2026-06-12T14:35:00.000Z"
}
```

**Response** `400 Bad Request` (invalid status_type):
```json
{
  "status_type": ["\"INVALID\" is not a valid choice."]
}
```

**Response** `404 Not Found`:
```json
{
  "detail": "No Job matches the given query."
}
```

---

### DELETE /api/jobs/{id}/

Delete a job and all its associated JobStatus records (cascade).

**Path Parameter**: `id` — integer primary key of the job.

**Request**: No body.

**Response** `204 No Content`: Empty body.

**Response** `404 Not Found`:
```json
{
  "detail": "No Job matches the given query."
}
```

---

## Frontend API Client Contract

The React frontend communicates with the backend via relative URLs (nginx proxies `/api/`
to the backend). The frontend API service module (`src/services/api.ts`) wraps all
endpoints and returns typed results.

### TypeScript Types

```typescript
type StatusType = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

interface Job {
  id: number;
  name: string;
  current_status: StatusType;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

### Error Handling Contract

All API functions MUST:
- Return `Promise<T>` for success paths
- Throw a typed `ApiError` (or re-throw `Error`) on non-2xx responses
- The caller (component) MUST catch errors and update local error state for display

---

## nginx Proxy Configuration

The frontend nginx instance routes API traffic to the backend:

```nginx
server {
    listen 80;

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

This ensures:
- React SPA routing works (all unknown paths serve `index.html`)
- API calls use the same origin (no CORS)
- The Playwright test container reaches the full app at `http://frontend:80`
