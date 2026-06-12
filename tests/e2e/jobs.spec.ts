import { expect, test } from '@playwright/test';

test.describe('Job Management', () => {
  test('create job appears with PENDING status', async ({ page }) => {
    const jobName = `E2E Create ${Date.now()}`;

    await page.goto('/');

    await page.fill('input[type="text"]', jobName);
    await page.click('button[type="submit"]');

    const row = page.locator('tr', { hasText: jobName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('select')).toHaveValue('PENDING');
  });

  test('update job status is reflected in list', async ({ page, request }) => {
    const jobName = `E2E Update ${Date.now()}`;

    await request.post('http://frontend/api/jobs/', {
      data: { name: jobName },
    });

    await page.goto('/');

    const row = page.locator('tr', { hasText: jobName });
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.locator('select').selectOption('RUNNING');

    await expect(row.locator('select')).toHaveValue('RUNNING', { timeout: 10000 });
  });
});
