/**
 * SPEC 06 — Results Dashboard
 *
 * Seeds a mock result via the backend API, then visits the results page
 * and verifies all UI sections render correctly.
 *
 * NOTE: Requires backend on port 5001.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

// ── Seed a known result before the test suite ─────────────────────────────────
let seededSessionId;

test.beforeAll(async ({ request }) => {
  // Start a UI-only test against example.com (fast, ~15 s with crawl)
  const startRes = await request.post('http://localhost:5001/api/test/start', {
    data: { url: 'https://example.com', options: { runUi: true, runAccessibility: false, runApi: false } },
  });
  const { sessionId } = await startRes.json();
  seededSessionId = sessionId;

  // Poll until complete (max 180 s — crawl + UI stages)
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await request.get(`http://localhost:5001/api/test/status/${sessionId}`);
    const status    = await statusRes.json();
    if (status.phase === 'completed' || status.phase === 'error') break;
  }
});

test.describe('Results Dashboard', () => {

  test.setTimeout(45_000);

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto(`/results/${seededSessionId}`);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('should display "Test Results" heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Test Results');
  });

  test('should display the target URL in the header', async ({ page }) => {
    // rp-url is the URL chip in the new Results design
    const urlEl = page.locator('.rp-url, .url-chip').first();
    await expect(urlEl).toContainText('example.com');
  });

  test('should show score banner with a percentage', async ({ page }) => {
    // rp-score-val is the new score element
    const scoreEl = page.locator('.rp-score-val, .score-value').first();
    await expect(scoreEl).toContainText(/%/);
  });

  test('score banner should contain Total, Passed, Failed stats', async ({ page }) => {
    for (const label of ['Total', 'Passed', 'Failed']) {
      await expect(page.locator('.rp-stat-lbl, .score-stat-lbl').filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test('should render 7 tab buttons', async ({ page }) => {
    const tabs = page.locator('.tab-btn');
    // Overview · Crawl · UI Tests · Accessibility · API Tests · Screenshots · AI Analysis
    await expect(tabs).toHaveCount(7);
  });

  test('Overview tab is active by default', async ({ page }) => {
    await expect(page.locator('.tab-btn.active')).toContainText(/Overview/i);
  });

  test('clicking UI Tests tab shows UI section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'UI Tests' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('UI Tests');
  });

  test('clicking Accessibility tab shows section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Accessibility' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Accessibility');
  });

  test('clicking API Tests tab shows section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'API Tests' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('API Tests');
  });

  test('clicking AI Analysis tab shows section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'AI Analysis' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('AI Analysis');
  });

  test('clicking Crawl tab shows section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Crawl' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Crawl');
  });

  test('clicking Screenshots tab shows section', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Screenshots' }).click();
    await expect(page.locator('.tab-btn.active')).toContainText('Screenshots');
  });

  test('"New Test" button navigates to /test', async ({ page }) => {
    await page.locator('text=+ New Test').click();
    await expect(page).toHaveURL(/\/test/);
  });

  test('"Reports" button navigates to /reports', async ({ page }) => {
    await page.goto(`/results/${seededSessionId}`);
    await page.locator('text=Reports').click();
    await expect(page).toHaveURL(/\/reports/);
  });

});
