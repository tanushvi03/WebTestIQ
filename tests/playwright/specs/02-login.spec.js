/**
 * SPEC 02 — Login Page
 *
 * Covers:
 *  - Page structure
 *  - Valid credentials → dashboard redirect
 *  - Invalid credentials → error message
 *  - Empty fields → validation messages
 *  - Username-only / password-only → validation
 *  - Logout flow
 */
const { test, expect } = require('@playwright/test');

const VALID_USER = 'admin';
const VALID_PASS = 'admin123';

test.describe('Login Page', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any stored auth
    await page.goto('/login');
  });

  // ── Page structure ──────────────────────────────────────────────────────────

  test('should render login form', async ({ page }) => {
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show demo credential hint', async ({ page }) => {
    // The hint text contains 'admin' in a <code> element — be specific
    await expect(page.locator('.login-sub code').first()).toContainText('admin');
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  test('should show error when both fields empty', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#username-err')).toBeVisible();
    await expect(page.locator('#password-err')).toBeVisible();
  });

  test('should show error when only username is empty', async ({ page }) => {
    await page.locator('#password').fill(VALID_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#username-err')).toBeVisible();
  });

  test('should show error when only password is empty', async ({ page }) => {
    await page.locator('#username').fill(VALID_USER);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#password-err')).toBeVisible();
  });

  // ── Invalid credentials ─────────────────────────────────────────────────────

  test('should show error message for wrong password', async ({ page }) => {
    await page.locator('#username').fill(VALID_USER);
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Wait for any error indicator: inline banner or react-hot-toast
    await page.waitForTimeout(1500);
    const bannerVisible = await page.locator('.form-error-banner').isVisible().catch(() => false);
    const toastVisible  = await page.locator('[class*="toast"]').isVisible().catch(() => false);
    expect(bannerVisible || toastVisible).toBeTruthy();
  });

  test('should show error message for wrong username', async ({ page }) => {
    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill(VALID_PASS);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    const bannerVisible = await page.locator('.form-error-banner').isVisible().catch(() => false);
    const toastVisible  = await page.locator('[class*="toast"]').isVisible().catch(() => false);
    expect(bannerVisible || toastVisible).toBeTruthy();
  });

  // ── Successful login ────────────────────────────────────────────────────────

  test('should redirect to /dashboard on valid credentials', async ({ page }) => {
    await page.locator('#username').fill(VALID_USER);
    await page.locator('#password').fill(VALID_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('should persist login across page reload', async ({ page }) => {
    // Login
    await page.locator('#username').fill(VALID_USER);
    await page.locator('#password').fill(VALID_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Reload
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // ── Logout ──────────────────────────────────────────────────────────────────

  test('should redirect back to /login after logout', async ({ page }) => {
    // Login first
    await page.locator('#username').fill(VALID_USER);
    await page.locator('#password').fill(VALID_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout via sidebar button (aria-label="Logout")
    await page.locator('[aria-label="Logout"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  test('unauthenticated user should be redirected to /login from /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user should be redirected from /test', async ({ page }) => {
    await page.goto('/test');
    await expect(page).toHaveURL(/\/login/);
  });

});
