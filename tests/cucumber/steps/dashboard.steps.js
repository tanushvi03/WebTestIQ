/**
 * Step definitions for dashboard.feature
 *
 * NOTE: "I click the {string} button" is defined in landing.steps.js to avoid
 * duplicate step definition errors. This file only contains dashboard-specific
 * steps not covered elsewhere.
 */
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

When('I navigate to the dashboard', async function () {
  await this.page.goto(this.baseUrl + '/dashboard');
  await this.page.waitForURL('**/dashboard', { timeout: 10_000 });
});

Then('I should see the dashboard heading {string}', async function (heading) {
  await expect(this.page.locator('h1')).toContainText(heading);
});

Then('I should see {int} stat cards', async function (count) {
  await expect(this.page.locator('.stat-card')).toHaveCount(count);
});

Then('I should see stat card labels for {string}, {string}, {string}, {string}',
  async function (l1, l2, l3, l4) {
    for (const label of [l1, l2, l3, l4]) {
      await expect(this.page.locator('.stat-label', { hasText: label })).toBeVisible();
    }
  }
);

Then('I should see {int} tip cards', async function (count) {
  await expect(this.page.locator('.tip-card')).toHaveCount(count);
});

Then('I should see a chart card with the heading {string}', async function (heading) {
  await expect(this.page.locator('.chart-card, .section-title', { hasText: heading }).first()).toBeVisible({ timeout: 8_000 });
});

Then('I may see the empty state with text {string} if no tests have been run', async function (text) {
  // This step is a conditional fallback — the chart OR the empty state should be visible
  const chartVisible = await this.page.locator('.chart-card').isVisible().catch(() => false);
  if (!chartVisible) {
    await expect(this.page.locator('.empty-state', { hasText: text })).toBeVisible({ timeout: 5_000 });
  }
});

Then('I should be on the test page', async function () {
  await this.page.waitForURL('**/test', { timeout: 10_000 });
  await expect(this.page).toHaveURL(/\/test/);
});

Then('the sidebar should show navigation items for {string}, {string}, {string}, {string}',
  async function (n1, n2, n3, n4) {
    for (const label of [n1, n2, n3, n4]) {
      await expect(this.page.locator('.nav-label', { hasText: label })).toBeVisible();
    }
  }
);

When('I click the sidebar link for {string}', async function (label) {
  await this.page.locator('.nav-item', { hasText: label }).click();
});

Then('I should be on the reports page', async function () {
  await this.page.waitForURL('**/reports', { timeout: 10_000 });
  await expect(this.page).toHaveURL(/\/reports/);
});

When('I click the sidebar toggle', async function () {
  await this.page.locator('.sidebar-toggle').click();
});

When('I click the sidebar toggle again', async function () {
  await this.page.locator('.sidebar-toggle').click();
});

Then('the sidebar labels should be hidden', async function () {
  await expect(this.page.locator('.nav-label').first()).not.toBeVisible();
});

Then('the sidebar labels should be visible', async function () {
  await expect(this.page.locator('.nav-label').first()).toBeVisible();
});
