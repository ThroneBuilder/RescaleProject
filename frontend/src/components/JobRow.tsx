import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { deleteJob, updateJobStatus } from '../services/api';
import type { Job, StatusType } from '../types/job';

const STATUS_OPTIONS: StatusType[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];

interface JobRowProps {
  job: Job;
  onUpdated: (job: Job) => void;
  onDeleted: (id: number) => void;
}

export function JobRow({ job, onUpdated, onDeleted }: JobRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleStatusChange(e: ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as StatusType;
    setUpdating(true);
    setError(null);
    try {
      const updated = await updateJobStatus(job.id, newStatus);
      onUpdated(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteJob(job.id);
      onDeleted(job.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const busy = updating || deleting;

  return (
    <tr>
      <td>{job.name}</td>
      <td data-status={job.current_status ?? 'none'}>
        <select
          value={job.current_status ?? ''}
          onChange={handleStatusChange}
          disabled={busy}
        >
          {!job.current_status && <option value="" disabled>—</option>}
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td>
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={busy}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        {error && <span className="row-error">{error}</span>}
      </td>
    </tr>
  );
}
