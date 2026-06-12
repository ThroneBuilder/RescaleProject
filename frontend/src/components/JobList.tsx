import { useEffect, useState } from 'react';

import { fetchJobs } from '../services/api';
import type { Job } from '../types/job';
import { JobRow } from './JobRow';

const PAGE_SIZE = 25;

export function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJobs(page, PAGE_SIZE)
      .then((data) => {
        setJobs(data.results);
        setTotalCount(data.count);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  function handleJobUpdated(updatedJob: Job) {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  }

  function handleJobDeleted(id: number) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotalCount((c) => c - 1);
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Error: {error}</p>;
  if (jobs.length === 0) return <p>No jobs yet.</p>;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onUpdated={handleJobUpdated}
              onDeleted={handleJobDeleted}
            />
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} ({totalCount} total)
        </span>
        <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </>
  );
}
