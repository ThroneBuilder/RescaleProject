import type { Job } from '../types/job';

interface JobRowProps {
  job: Job;
}

export function JobRow({ job }: JobRowProps) {
  return (
    <tr>
      <td>{job.name}</td>
      <td>{job.current_status ?? '—'}</td>
    </tr>
  );
}
