/**
 * SPEC 11 — Crawl Tab & Authentication-Aware Crawling
 *
 * Verifies:
 *  - The Crawl tab is present and shows crawl results.
 *  - The Crawl summary chips (Public / Auth / Errors / Visited) render.
 *  - Public pages list shows discovered URLs.
 *  - Auth-required pages are listed separately (if detected).
 *  - The crawling progress stage appears in the test progress UI.
 *  - The backend correctly returns crawl data in the result JSON.
 *
 * Prerequisites: Backend on port 5001, Frontend on port 3000.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser, startAndWaitForTest } = require('./helpers');

let sessionId;

test.beforeAll(async ({ request }) => {
  // example.com is a simple public page — good for verifying crawl structure
  const result = await startAndWaitForTest(request, 'https://example.com', {
    runUi: false, runAccessibility: false, runApi: false,
  });
  sessionId = result.sessionId;
});

test.describe('Crawl Tab — Structure & Display', () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto(`/results/${sessionId}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('.tab-btn', { hasText: 'Crawl' }).click();
  });

  test('Crawl tab is present in the tab bar', async ({ page }) => {
    await expect(page.locator('.tab-btn', { hasText: 'Crawl' })).toBeVisible();
  });

  test('Crawl tab is second tab (after Overview)', async ({ page }) => {
    const tabs = page.locator('.tab-btn');
    await expect(tabs.nth(1)).toContainText('Crawl');
  });

  test('Crawl tab becomes active when clicked', async ({ page }) => {
    await expect(page.locator('.tab-btn.active')).toContainText('Crawl');
  });

  test('summary chips row is visible', async ({ page }) => {
    await expect(page.locator('.crawl-summary-row')).toBeVisible();
  });

  test('all four summary chips are present', async ({ page }) => {
    const chips = page.locator('.crawl-chip');
    await expect(chips).toHaveCount(4);
  });

  test('Public Pages chip has a numeric value', async ({ page }) => {
    const pubChip = page.locator('.crawl-chip-pub .crawl-chip-val');
    await expect(pubChip).toBeVisible();
    const val = await pubChip.textContent();
    expect(Number(val)).toBeGreaterThanOrEqual(0);
  });

  test('example.com has at least 1 public page', async ({ page }) => {
    const pubChip = page.locator('.crawl-chip-pub .crawl-chip-val');
    const val     = await pubChip.textContent();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
  });

  test('Public Pages section lists discovered URLs', async ({ page }) => {
    const section = page.locator('.crawl-hdr-pub');
    await expect(section).toBeVisible();
    const rows = page.locator('.crawl-row-pub');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each public page row shows its URL', async ({ page }) => {
    const firstUrl = page.locator('.crawl-row-pub .crawl-row-url').first();
    await expect(firstUrl).toContainText('example.com');
  });

  test('Auth Required section is absent when no auth barriers detected', async ({ page }) => {
    const authCount = await page.locator('.crawl-hdr-auth').count();
    // example.com has no auth barriers — section should not be shown
    expect(authCount).toBe(0);
  });
});

test.describe('Crawl Tab — Backend Data Integrity', () => {
  test('result JSON contains crawl field with correct shape', async ({ request }) => {
    const res = await request.get(`http://localhost:5001/api/results/${sessionId}`);
    const data = await res.json();

    expect(data.crawl).toBeDefined();
    expect(Array.isArray(data.crawl.publicPages)).toBe(true);
    expect(Array.isArray(data.crawl.authPages)).toBe(true);
    expect(Array.isArray(data.crawl.errorPages)).toBe(true);
    expect(typeof data.crawl.totalVisited).toBe('number');
    expect(typeof data.crawl.limited).toBe('boolean');
    expect(data.crawl.startUrl).toContain('example.com');
  });

  test('crawl visited at least 1 page', async ({ request }) => {
    const res  = await request.get(`http://localhost:5001/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.crawl.totalVisited).toBeGreaterThanOrEqual(1);
  });

  test('public pages each have url, status, httpCode fields', async ({ request }) => {
    const res  = await request.get(`http://localhost:5001/api/results/${sessionId}`);
    const data = await res.json();
    for (const p of data.crawl.publicPages) {
      expect(p.url).toBeTruthy();
      expect(p.status).toBe('public');
      expect(p.httpCode).toBeGreaterThanOrEqual(200);
    }
  });

  test('quality score is not affected by crawl-only session (should be 100)', async ({ request }) => {
    const res  = await request.get(`http://localhost:5001/api/results/${sessionId}`);
    const data = await res.json();
    // No UI/a11y/API tests ran — only crawl, so score should be 100
    expect(data.summary.score).toBe(100);
  });
});

test.describe('Crawl Stage — Progress UI', () => {
  test.setTimeout(120_000);

  test('Crawling stage appears in progress list when test starts', async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto('/test');
    await page.locator('#target-url').fill('https://example.com');
    await page.locator('#start-testing-btn').click();

    // Wait for progress card to show
    await expect(page.locator('.progress-card')).toBeVisible({ timeout: 8_000 });

    // The Crawling stage label should appear
    await expect(
      page.locator('.stage-item', { hasText: 'Crawl' })
    ).toBeVisible({ timeout: 15_000 });
  });
});
