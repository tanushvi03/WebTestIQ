/**
 * Step definitions for landing.feature
 */
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('I open the WebTestIQ landing page', async function () {
  await this.page.goto(this.baseUrl + '/');
});

Then('I should see the page title contains {string}', async function (expected) {
  await expect(this.page).toHaveTitle(new RegExp(expected, 'i'));
});

Then('I should see a hero heading containing {string}', async function (expected) {
  const heading = this.page.locator('h1').first();
  await expect(heading).toBeVisible();
  await expect(heading).toContainText(expected);
});

Then('I should see {int} feature cards', async function (count) {
  const cards = this.page.locator('.feature-card');
  await expect(cards).toHaveCount(count);
});

Then('I should see a {string} button', async function (label) {
  await expect(this.page.locator(`text=${label}`).first()).toBeVisible();
});

When('I click the {string} button', async function (label) {
  // Try ID first (for buttons like "New Test" that have #start-new-test-btn),
  // then fall back to text match. Avoid combining CSS + text engines in one
  // selector string — that causes parse errors.
  const byId = this.page.locator('#start-new-test-btn');
  const idCount = await byId.count().catch(() => 0);
  if (idCount > 0 && await byId.first().isVisible().catch(() => false)) {
    await byId.first().click();
  } else {
    await this.page.locator(`text=${label}`).first().click();
  }
});

Then('I should be redirected to the login page', async function () {
  await this.page.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(this.page).toHaveURL(/\/login/);
});

Then('the browser console should not have errors', async function () {
  // Allow a short settle time for async console errors
  await this.page.waitForTimeout(1000);
  expect(this.consoleErrors).toHaveLength(0);
});
