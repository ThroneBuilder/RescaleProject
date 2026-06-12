# Data Model: Rescale Job Management Dashboard

**Date**: 2026-06-12
**Source**: spec.md (Key Entities) + research.md (Decisions 2, 3)

---

## Entities

### Job

Represents a computational task submitted by a user.
(JJ: Deliberately lacks owner/project structure and scheduling fields like priority, resources, and workload to stay simple this pass.)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Integer (auto PK) | NOT NULL, PRIMARY KEY, auto-increment | Django default AutoField |
| `name` | String | NOT NULL, max 255 chars | Free-text label; duplicates permitted |
| `created_at` | DateTime (UTC) | NOT NULL, auto-set on creation | `auto_now_add=True` |
| `updated_at` | DateTime (UTC) | NOT NULL, auto-updated on save | `auto_now=True` |

**Derived field (read-only, not stored)**:
- `current_status` — annotated at query time from the most recent `JobStatus.status_type`
  for this job. If no status records exist (edge case only during bulk imports), returns
  `null`.

---

### JobStatus

An immutable point-in-time record of a job's state. Records are appended on every status
change — never updated in place. Removing a Job cascades to remove all its JobStatus rows.
(JJ: probably needs distress modes (restarted, evicted, preempted) for scheduling and reporting features.)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Integer (auto PK) | NOT NULL, PRIMARY KEY, auto-increment | Django default AutoField |
| `job` | ForeignKey → Job | NOT NULL, ON DELETE CASCADE | Links status to its job |
| `status_type` | String (choice) | NOT NULL | One of: PENDING, RUNNING, COMPLETED, FAILED |
| `timestamp` | DateTime (UTC) | NOT NULL, auto-set on creation | `auto_now_add=True` |

**Status type enumeration**:

| Value | Meaning |
|-------|---------|
| `PENDING` | Job submitted but not yet started |
| `RUNNING` | Job is actively executing |
| `COMPLETED` | Job finished successfully |
| `FAILED` | Job terminated with an error |

---

## Relationships

```
Job (1) ──── (*) JobStatus
             ForeignKey(job, on_delete=CASCADE)
             Ordered by: timestamp ASC (history) / timestamp DESC (latest first)
```

One Job has zero or more JobStatus records. A newly created Job always has exactly one
JobStatus record (`status_type=PENDING`), created atomically with the Job.

---

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| Primary key | Job | `id` | Row identity |
| Primary key | JobStatus | `id` | Row identity |
| **Composite** | JobStatus | `(job_id, timestamp DESC)` | Latest-status subquery; cascade delete |
| **Index** | Job | `created_at DESC` | Default sort order for list endpoint |

The composite `(job_id, timestamp DESC)` index makes the latest-status annotation
efficient for any dataset size (used in the `Subquery` annotating `Job.objects.all()`).

---

## State Transitions

No enforced transition rules — any status may be set from any other status (per spec
clarification). The history table retains all transitions for auditability.

```
         ┌─────────────────────────────┐
         ▼                             │
   PENDING ──→ RUNNING ──→ COMPLETED   │  (all transitions permitted;
         └──────────────→ FAILED       │   this is the typical happy path)
                                       │
         Any status ──────────────────►┘  (PATCH can set any valid status_type)
```

---

## Invariants

1. Every `Job` MUST have at least one `JobStatus` record (enforced by creation logic).
2. `JobStatus` records are never updated — only created or deleted (via cascade).
3. The `current_status` of a job is always the `status_type` from the `JobStatus` row
   with the highest `timestamp` value for that job.
4. Job `name` is free-text; no uniqueness constraint is enforced.
5. `status_type` MUST be one of the four defined values — enforced at the model level
   via Django `TextChoices`.
