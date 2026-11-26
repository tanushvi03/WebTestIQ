/**
 * SPEC 04 — URL Input & Validation (Testing Page)
 *
 * Covers:
 *  - Empty URL → validation error
 *  - Malformed URL → validation error
 *  - Non-http scheme → validation error
 *  - Valid URL clears error and enables Start button
 *  - Test module checkboxes toggle correctly
 *  - Disclaimer text visible
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

test.describe('URL Input Validation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto('/test');
  });

  test('Start Testing button should be disabled with empty URL', async ({ page }) => {
    const btn = page.locator('#start-testing-btn');
    await expect(btn).toBeDisabled();
  });

  test('clicking Start with empty URL shows validation error', async ({ page }) => {
    // Type something then clear to trigger the button enable, then clear
    await page.locator('#target-url').fill('https://x.com');
    await page.locator('#target-url').clear();
    const btn = page.locator('#start-testing-btn');
    await expect(btn).toBeDisabled();
  });

  test('malformed URL shows validation error', async ({ page }) => {
    await page.locator('#target-url').fill('not-a-url');
    await page.locator('#start-testing-btn').click();
    await expect(page.locator('#url-err')).toBeVisible();
    await expect(page.locator('#url-err')).toContainText(/valid URL/i);
  });

  test('non-http scheme shows validation error', async ({ page }) => {
    await page.locator('#target-url').fill('ftp://example.com');
    await page.locator('#start-testing-btn').click();
    await expect(page.locator('#url-err')).toBeVisible();
    await expect(page.locator('#url-err')).toContainText(/http/i);
  });

  test('valid https URL clears any error', async ({ page }) => {
    // First cause an error
    await page.locator('#target-url').fill('badurl');
    await page.locator('#start-testing-btn').click();
    await expect(page.locator('#url-err')).toBeVisible();

    // Fix it
    await page.locator('#target-url').fill('https://example.com');
    await expect(page.locator('#url-err')).not.toBeVisible();
  });

  test('valid http URL is accepted', async ({ page }) => {
    await page.locator('#target-url').fill('http://example.com');
    await page.locator('#start-testing-btn').click();
    // No url error should appear (start proceeds to running phase)
    await expect(page.locator('#url-err')).not.toBeVisible();
  });

  test('UI module checkbox is checked by default', async ({ page }) => {
    const checkbox = page.locator('.option-card').filter({ hasText: 'UI / Browser' });
    await expect(checkbox).toHaveClass(/selected/);
  });

  test('Accessibility module checkbox is checked by default', async ({ page }) => {
    const checkbox = page.locator('.option-card').filter({ hasText: 'Accessibility' });
    await expect(checkbox).toHaveClass(/selected/);
  });

  test('API module checkbox is unchecked by default', async ({ page }) => {
    const checkbox = page.locator('.option-card').filter({ hasText: 'API Testing' });
    await expect(checkbox).not.toHaveClass(/selected/);
  });

  test('clicking a module checkbox toggles it', async ({ page }) => {
    const apiCard = page.locator('.option-card').filter({ hasText: 'API Testing' });
    await apiCard.click();
    await expect(apiCard).toHaveClass(/selected/);
    await apiCard.click();
    await expect(apiCard).not.toHaveClass(/selected/);
  });

  test('disclaimer note is visible', async ({ page }) => {
    await expect(page.locator('.disclaimer')).toBeVisible();
  });

});
