/**
 * Shared test helpers — login, wait utilities, etc.
 */

/**
 * Log in with demo credentials and wait for the dashboard.
 * @param {import('@playwright/test').Page} page
 */
async function loginAsDemoUser(page) {
  await page.goto('/login');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Wait for a test run to complete by polling the progress UI.
 * Uses two independent waitForSelector calls racing each other so no
 * single selector contains special characters (the ✓ symbol breaks CSS parsing).
 * @param {import('@playwright/test').Page} page
 * @param {number} maxMs
 */
async function waitForTestCompletion(page, maxMs = 120_000) {
  const deadline = Date.now() + maxMs;
  // Poll until #view-results-btn appears OR the progress title no longer
  // says "in progress" (i.e. the test run has finished).
  while (Date.now() < deadline) {
    const btnVisible = await page.locator('#view-results-btn').isVisible().catch(() => false);
    if (btnVisible) return;

    const title = await page.locator('.progress-title').textContent().catch(() => '');
    if (title && !title.toLowerCase().includes('progress') && !title.includes('…')) return;

    await page.waitForTimeout(1500);
  }
  // Final check — throw if still not visible so the calling test fails clearly
  await page.locator('#view-results-btn').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Poll the backend status API until phase is completed or error.
 * Returns the final status object.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} sessionId
 * @param {number} maxWaitMs
 */
async function waitForSessionComplete(request, sessionId, maxWaitMs = 120_000) {
  const interval = 2000;
  const maxIter  = Math.ceil(maxWaitMs / interval);
  for (let i = 0; i < maxIter; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const res    = await request.get(`http://localhost:5001/api/test/status/${sessionId}`);
    const status = await res.json();
    if (status.phase === 'completed' || status.phase === 'error') return status;
  }
  return null;
}

/**
 * Start a test run via the backend API and wait for it to complete.
 * Returns { sessionId, finalStatus }.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} url
 * @param {object} options
 */
async function startAndWaitForTest(request, url, options = {}) {
  const startRes = await request.post('http://localhost:5001/api/test/start', {
    data: { url, options },
  });
  const { sessionId } = await startRes.json();
  const finalStatus = await waitForSessionComplete(request, sessionId);
  return { sessionId, finalStatus };
}

module.exports = {
  loginAsDemoUser,
  waitForTestCompletion,
  waitForSessionComplete,
  startAndWaitForTest,
};
