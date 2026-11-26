/**
 * SPEC 09 — History Page
 *
 * Verifies the History table renders with correct columns,
 * filter buttons work, and rows link to results.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

test.describe('History Page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto('/history');
  });

  test('should display "Test History" heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Test History');
  });

  test('should show three filter buttons (All / Passed / Failed)', async ({ page }) => {
    const btns = page.locator('.filter-btn');
    await expect(btns).toHaveCount(3);
  });

  test('"All" filter button is active by default', async ({ page }) => {
    await expect(page.locator('.filter-btn.active')).toContainText('All');
  });

  test('clicking "Passed" filter changes active button', async ({ page }) => {
    await page.locator('.filter-btn', { hasText: 'Passed' }).click();
    await expect(page.locator('.filter-btn.active')).toContainText('Passed');
  });

  test('clicking "Failed" filter changes active button', async ({ page }) => {
    await page.locator('.filter-btn', { hasText: 'Failed' }).click();
    await expect(page.locator('.filter-btn.active')).toContainText('Failed');
  });

  test('history table should have correct column headers', async ({ page }) => {
    // Use partial text match — "Date & Time" contains "Date", etc.
    const expectedHeaders = ['URL', 'Passed', 'Failed', 'Score', 'Status'];
    for (const h of expectedHeaders) {
      await expect(page.locator('th').filter({ hasText: h }).first()).toBeVisible();
    }
    // Date column may say "Date" or "Date & Time"
    await expect(page.locator('th').filter({ hasText: 'Date' }).first()).toBeVisible();
  });

  test('if history rows exist — View links are present', async ({ page }) => {
    const rows = page.locator('.history-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;

    await expect(rows.first().locator('text=View')).toBeVisible();
  });

  test('if history rows exist — clicking View navigates to /results', async ({ page }) => {
    const rows = page.locator('.history-table tbody tr');
    const count = await rows.count();
    if (count === 0) return;

    await rows.first().locator('text=View').click();
    await expect(page).toHaveURL(/\/results\/.+/);
  });

  test('"+ New Test" button navigates to /test', async ({ page }) => {
    await page.locator('text=+ New Test').click();
    await expect(page).toHaveURL(/\/test/);
  });

});
