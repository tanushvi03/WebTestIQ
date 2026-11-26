/**
 * Step definitions for login.feature
 */
const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('I am on the login page', async function () {
  await this.page.goto(this.baseUrl + '/login');
});

Given('I am logged in as demo user', async function () {
  await this.page.goto(this.baseUrl + '/login');
  await this.page.locator('#username').fill('admin');
  await this.page.locator('#password').fill('admin123');
  await this.page.locator('button[type="submit"]').click();
  await this.page.waitForURL('**/dashboard', { timeout: 10_000 });
});

When('I submit the login form without entering any credentials', async function () {
  await this.page.locator('button[type="submit"]').click();
});

When('I enter username {string} and password {string}', async function (user, pass) {
  await this.page.locator('#username').fill(user);
  await this.page.locator('#password').fill(pass);
});

When('I submit the login form', async function () {
  await this.page.locator('button[type="submit"]').click();
});

Then('I should see a validation error for the username field', async function () {
  await expect(this.page.locator('#username-err')).toBeVisible({ timeout: 5_000 });
});

Then('I should see a validation error for the password field', async function () {
  await expect(this.page.locator('#password-err')).toBeVisible({ timeout: 5_000 });
});

Then('I should see an error message indicating invalid credentials', async function () {
  // Allow toast/inline error to appear
  await this.page.waitForTimeout(1500);
  const bannerVisible = await this.page.locator('.form-error-banner').isVisible().catch(() => false);
  const toastVisible  = await this.page.locator('[class*="toast"]').isVisible().catch(() => false);
  expect(bannerVisible || toastVisible).toBeTruthy();
});

Then('I should be redirected to the dashboard', async function () {
  await this.page.waitForURL('**/dashboard', { timeout: 10_000 });
  await expect(this.page).toHaveURL(/\/dashboard/);
});

When('I reload the page', async function () {
  await this.page.reload();
});

Then('I should still be on the dashboard', async function () {
  await expect(this.page).toHaveURL(/\/dashboard/);
});

When('I click the logout button', async function () {
  await this.page.locator('[aria-label="Logout"]').click();
});

When('I navigate directly to the dashboard URL', async function () {
  await this.page.goto(this.baseUrl + '/dashboard');
});
