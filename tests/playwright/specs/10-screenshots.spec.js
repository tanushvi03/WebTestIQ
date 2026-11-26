/**
 * SPEC 10 — Screenshots Tab
 *
 * Verifies that screenshots captured during a test run are stored correctly
 * and displayed in the Screenshots tab on the Results page.
 *
 * Uses a real test run (UI only, no axe — faster) against example.com.
 * Expects at least the 3 standard UI screenshots: page-load, homepage, final-state.
 *
 * Prerequisites: Backend on port 5001, Frontend on port 3000.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser, startAndWaitForTest } = require('./helpers');

let sessionId;

test.beforeAll(async ({ request }) => {
  const result = await startAndWaitForTest(request, 'https://example.com', {
    runUi: true, runAccessibility: false, runApi: false,
  });
  sessionId = result.sessionId;
});

test.describe('Screenshots Tab', () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto(`/results/${sessionId}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('.tab-btn', { hasText: 'Screenshots' }).click();
  });

  test('Screenshots tab is present in the tab bar', async ({ page }) => {
    // Tab text contains "Screenshots" — emoji prefix is optional
    await expect(page.locator('.tab-btn', { hasText: 'Screenshots' })).toBeVisible({ timeout: 10_000 });
  });

  test('Screenshots tab becomes active when clicked', async ({ page }) => {
    await expect(page.locator('.tab-btn.active')).toContainText('Screenshots');
  });

  test('Screenshots tab shows content — grid or not-run message', async ({ page }) => {
    const hasGrid    = await page.locator('.ss-grid').isVisible().catch(() => false);
    const hasNotRun  = await page.locator('.not-run-msg').isVisible().catch(() => false);
    expect(hasGrid || hasNotRun).toBeTruthy();
  });

  test('at least 3 screenshots are captured from a UI test run', async ({ page }) => {
    // page-load + homepage + navigation-state or final-state
    const cards = page.locator('.ss-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('each screenshot card shows a thumbnail image', async ({ page }) => {
    const firstThumb = page.locator('.ss-thumb').first();
    await expect(firstThumb).toBeVisible();
    // src should be a base64 data URI
    const src = await firstThumb.getAttribute('src');
    expect(src).toMatch(/^data:image\//);
  });

  test('each screenshot card shows a status badge', async ({ page }) => {
    const firstBadge = page.locator('.ss-status-badge').first();
    await expect(firstBadge).toBeVisible();
  });

  test('each screenshot card shows a label', async ({ page }) => {
    const firstLabel = page.locator('.ss-label').first();
    await expect(firstLabel).not.toBeEmpty();
  });

  test('clicking a screenshot thumbnail opens the lightbox', async ({ page }) => {
    await page.locator('.ss-thumb-btn').first().click();
    await expect(page.locator('.lb-overlay')).toBeVisible({ timeout: 5_000 });
  });

  test('lightbox shows a full-size image', async ({ page }) => {
    await page.locator('.ss-thumb-btn').first().click();
    const lbImg = page.locator('.lb-img');
    await expect(lbImg).toBeVisible();
    const src = await lbImg.getAttribute('src');
    expect(src).toMatch(/^data:image\//);
  });

  test('lightbox can be closed with the ✕ button', async ({ page }) => {
    await page.locator('.ss-thumb-btn').first().click();
    await expect(page.locator('.lb-overlay')).toBeVisible();
    await page.locator('.lb-close').click();
    await expect(page.locator('.lb-overlay')).not.toBeVisible({ timeout: 3_000 });
  });

  test('lightbox can be closed by clicking the overlay backdrop', async ({ page }) => {
    await page.locator('.ss-thumb-btn').first().click();
    await expect(page.locator('.lb-overlay')).toBeVisible();
    // Click the overlay outside the lb-box
    await page.locator('.lb-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.lb-overlay')).not.toBeVisible({ timeout: 3_000 });
  });

  test('lightbox Download button is present', async ({ page }) => {
    await page.locator('.ss-thumb-btn').first().click();
    await expect(page.locator('.lb-actions a[download]')).toBeVisible();
  });

  test('Screenshots tab label in the tab bar shows the count', async ({ page }) => {
    // Tab label should read e.g. "📷 Screenshots (4)"
    const tabLabel = await page.locator('.tab-btn', { hasText: 'Screenshots' }).textContent();
    expect(tabLabel).toMatch(/\d+/);
  });
});
