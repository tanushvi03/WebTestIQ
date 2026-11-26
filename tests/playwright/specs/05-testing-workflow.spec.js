/**
 * SPEC 05 — Testing Workflow
 *
 * Submits a real test against https://example.com and verifies the full
 * workflow: progress stages appear → completion → results navigable.
 *
 * NOTE: This test requires the backend to be running on port 5001.
 * It can take up to 90 s while the actual Playwright + axe tests run.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser, waitForTestCompletion } = require('./helpers');

test.describe('Testing Workflow', () => {

  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto('/test');
  });

  test('submitting a valid URL shows progress card', async ({ page }) => {
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();
    await expect(page.locator('.progress-card')).toBeVisible({ timeout: 8_000 });
  });

  test('URL Validation stage shows as completed quickly', async ({ page }) => {
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();

    // Allow up to 25 s — crawl stage runs before URL validation completes in UI
    await expect(
      page.locator('.stage-item', { hasText: 'URL Validation' }).locator('.stage-badge')
    ).toHaveText(/completed/i, { timeout: 25_000 });
  });

  test('all seven stages appear in the progress list', async ({ page }) => {
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();

    const stageLabels = [
      'URL Validation',
      'Crawling',
      'UI Testing',
      'Accessibility Scan',
      'API Testing',
      'AI Analysis',
      'Report Generation',
    ];

    for (const label of stageLabels) {
      await expect(page.locator('.stage-item', { hasText: label })).toBeVisible();
    }
  });

  test('testing completes and "View Results" button appears', async ({ page }) => {
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();
    await waitForTestCompletion(page, 110_000);
    await expect(page.locator('#view-results-btn')).toBeVisible();
  });

  test('"View Results" button navigates to /results/:sessionId', async ({ page }) => {
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();
    await waitForTestCompletion(page, 110_000);
    await page.locator('#view-results-btn').click();
    await expect(page).toHaveURL(/\/results\/.+/);
  });

  test('target URL is shown in the progress card', async ({ page }) => {
    const url = 'https://example.com';
    await page.locator('#target-url').fill(url);
    await page.locator('#start-testing-btn').click();
    await expect(page.locator('.progress-card')).toContainText(url);
  });

});
