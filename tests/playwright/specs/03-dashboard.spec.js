/**
 * SPEC 03 — Dashboard Page
 *
 * Covers:
 *  - Page renders after login
 *  - Stat cards present
 *  - Sidebar navigation links
 *  - "New Test" button goes to /test
 *  - "View all" history link
 *  - Tip cards visible
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

test.describe('Dashboard Page', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
  });

  test('should display Dashboard heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show four stat cards', async ({ page }) => {
    const cards = page.locator('.stat-card');
    await expect(cards).toHaveCount(4);
  });

  test('stat card labels should be present', async ({ page }) => {
    for (const label of ['Total Runs', 'Tests Passed', 'Tests Failed', 'Avg Score']) {
      await expect(page.locator(`.stat-label`, { hasText: label })).toBeVisible();
    }
  });

  test('"New Test" button navigates to /test', async ({ page }) => {
    await page.locator('#start-new-test-btn').click();
    await expect(page).toHaveURL(/\/test/);
  });

  test('"View all" link navigates to /history', async ({ page }) => {
    await page.locator('text=View all').click();
    await expect(page).toHaveURL(/\/history/);
  });

  test('sidebar should show all navigation items', async ({ page }) => {
    for (const label of ['Dashboard', 'New Test', 'History', 'Reports']) {
      await expect(page.locator('.nav-label', { hasText: label })).toBeVisible();
    }
  });

  test('sidebar Reports link navigates to /reports', async ({ page }) => {
    await page.locator('.nav-item', { hasText: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports/);
  });

  test('should show three tip cards', async ({ page }) => {
    const tips = page.locator('.tip-card');
    await expect(tips).toHaveCount(3);
  });

  test('sidebar toggle collapses and expands', async ({ page }) => {
    const toggle = page.locator('.sidebar-toggle');
    await toggle.click();
    // Sidebar labels should be hidden after collapse
    await expect(page.locator('.nav-label').first()).not.toBeVisible();

    await toggle.click();
    await expect(page.locator('.nav-label').first()).toBeVisible();
  });

});
