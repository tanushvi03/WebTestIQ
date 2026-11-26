/**
 * SPEC 01 — Landing Page
 *
 * Verifies the public landing page renders correctly and the
 * "Get Started" CTA navigates to the login page.
 */
const { test, expect } = require('@playwright/test');

test.describe('Landing Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/WebTestIQ/i);
  });

  test('should display hero headline', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Test Any Website/i);
  });

  test('should display all six feature cards', async ({ page }) => {
    const cards = page.locator('.feature-card');
    await expect(cards).toHaveCount(6);
  });

  test('Get Started button should navigate to /login', async ({ page }) => {
    await page.locator('text=Get Started').first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('CTA "Launch Platform" button should navigate to /login', async ({ page }) => {
    await page.locator('text=Launch Platform').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('features section should be reachable via "See Features" button', async ({ page }) => {
    await page.locator('text=See Features').click();
    const features = page.locator('#features');
    await expect(features).toBeInViewport();
  });

  test('landing page should not have console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

});
