import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://frontend',
    headless: true,
    actionTimeout: 10000,
  },
  workers: 1,
  retries: 0,
  timeout: 30000,
});
