import { useState } from 'react';
import type { FormEvent } from 'react';

import { createJob } from '../services/api';
import type { Job } from '../types/job';

interface CreateJobFormProps {
  onCreated: (job: Job) => void;
}

export function CreateJobForm({ onCreated }: CreateJobFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const job = await createJob(name.trim());
      setName('');
      onCreated(job);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Job name"
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Job'}
      </button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}
