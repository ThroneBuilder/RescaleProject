import type { Job, PaginatedResponse } from '../types/job';

const BASE_URL = '/api';

export async function fetchJobs(page = 1, pageSize = 25): Promise<PaginatedResponse<Job>> {
  const response = await fetch(`${BASE_URL}/jobs/?page=${page}&page_size=${pageSize}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.statusText}`);
  }
  return response.json();
}
