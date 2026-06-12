import { useState } from 'react';

import './App.css';
import { CreateJobForm } from './components/CreateJobForm';
import { JobList } from './components/JobList';
import type { Job } from './types/job';

function App() {
  const [listKey, setListKey] = useState(0);

  function handleCreated(_job: Job) {
    setListKey((k) => k + 1);
  }

  return (
    <div>
      <h1>Job Dashboard</h1>
      <CreateJobForm onCreated={handleCreated} />
      <JobList key={listKey} />
    </div>
  );
}

export default App;
