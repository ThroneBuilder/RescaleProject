import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { updateJobStatus } from '../services/api';
import type { Job, StatusType } from '../types/job';

const STATUS_OPTIONS: StatusType[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];

interface JobRowProps {
  job: Job;
  onUpdated: (job: Job) => void;
}

export function JobRow({ job, onUpdated }: JobRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

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

  return (
    <tr>
      <td>{job.name}</td>
      <td>
        <select
          value={job.current_status ?? ''}
          onChange={handleStatusChange}
          disabled={updating}
        >
          {!job.current_status && <option value="" disabled>—</option>}
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {error && <span> {error}</span>}
      </td>
    </tr>
  );
}
