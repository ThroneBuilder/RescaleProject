import type { Job, PaginatedResponse } from '../types/job';

const BASE_URL = '/api';

export async function fetchJobs(page = 1, pageSize = 25): Promise<PaginatedResponse<Job>> {
  const response = await fetch(`${BASE_URL}/jobs/?page=${page}&page_size=${pageSize}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.statusText}`);
  }
  return response.json();
}

export async function createJob(name: string): Promise<Job> {
  const response = await fetch(`${BASE_URL}/jobs/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create job: ${response.statusText}`);
  }
  return response.json();
}
