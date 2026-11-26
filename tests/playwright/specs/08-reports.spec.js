/**
 * SPEC 08 — Reports Page
 *
 * Verifies the Reports listing page renders, shows stored reports,
 * and allows navigating to a full report.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

test.describe('Reports Page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto('/reports');
  });

  test('should display "Reports" heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Reports');
  });

  test('should show "+ New Test" button', async ({ page }) => {
    await expect(page.locator('text=+ New Test')).toBeVisible();
  });

  test('"+ New Test" button navigates to /test', async ({ page }) => {
    await page.locator('text=+ New Test').click();
    await expect(page).toHaveURL(/\/test/);
  });

  test('should show report cards or empty state', async ({ page }) => {
    await page.goto('/reports');
    const hasCards  = await page.locator('.report-card').first().isVisible().catch(() => false);
    const hasEmpty  = await page.locator('.empty-state').isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('if reports exist — each card shows a URL', async ({ page }) => {
    const cards = page.locator('.report-card');
    const count = await cards.count();
    if (count === 0) return; // nothing stored yet

    await expect(cards.first().locator('.report-url')).not.toBeEmpty();
  });

  test('if reports exist — "View full report" link is clickable', async ({ page }) => {
    const cards = page.locator('.report-card');
    const count = await cards.count();
    if (count === 0) return;

    await cards.first().locator('text=View full report').click();
    await expect(page).toHaveURL(/\/results\/.+/);
  });

});
