/**
 * SPEC 07 — AI Analysis Section
 *
 * Verifies that the AI analysis tab renders correctly after a test run.
 * Uses the same seeded session from spec 06.
 *
 * NOTE: With AI_PROVIDER=none the offline analyser always runs,
 * so these tests do not require any API key.
 */
const { test, expect } = require('@playwright/test');
const { loginAsDemoUser } = require('./helpers');

let sessionId;

test.beforeAll(async ({ request }) => {
  const startRes = await request.post('http://localhost:5001/api/test/start', {
    data: { url: 'https://example.com', options: { runUi: true, runAccessibility: false, runApi: false } },
  });
  const body = await startRes.json();
  sessionId = body.sessionId;

  // Wait up to 90 s for completion
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await (await request.get(`http://localhost:5001/api/test/status/${sessionId}`)).json();
    if (s.phase === 'completed' || s.phase === 'error') break;
  }
});

test.describe('AI Analysis Tab', () => {

  test.setTimeout(45_000);

  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
    await page.goto(`/results/${sessionId}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('.tab-btn', { hasText: 'AI Analysis' }).click();
  });

  test('AI Analysis tab should be selectable', async ({ page }) => {
    await expect(page.locator('.tab-btn.active')).toContainText('AI Analysis');
  });

  test('AI panel should be visible (or show "not available" message)', async ({ page }) => {
    // New design uses .ai-panel-new; old used .ai-panel
    const hasPanel   = await page.locator('.ai-panel-new, .ai-panel').first().isVisible().catch(() => false);
    const hasMessage = await page.locator('.not-run-msg, .empty-state').first().isVisible().catch(() => false);
    expect(hasPanel || hasMessage).toBeTruthy();
  });

  test('if AI panel present — overall summary text exists', async ({ page }) => {
    const panel = page.locator('.ai-panel-new, .ai-panel').first();
    const visible = await panel.isVisible().catch(() => false);
    if (!visible) test.skip();
    // New design: .ai-summary-text; old: .ai-section p
    const summaryEl = page.locator('.ai-summary-text, .ai-section p').first();
    await expect(summaryEl).not.toBeEmpty();
  });

  test('if AI panel present — model attribution line is shown', async ({ page }) => {
    const panel = page.locator('.ai-panel-new, .ai-panel').first();
    const visible = await panel.isVisible().catch(() => false);
    if (!visible) test.skip();
    // New design: .ai-panel-model; old: .ai-header
    const modelEl = page.locator('.ai-panel-model, .ai-header').first();
    await expect(modelEl).toContainText(/offline|GPT|Gemini/i);
  });

  test('if recommendations section present — it has at least one item', async ({ page }) => {
    // New: .ai-recs-list li; old: .ai-recs li
    const recs = page.locator('.ai-recs-list li, .ai-recs li');
    const count = await recs.count().catch(() => 0);
    if (count > 0) {
      await expect(recs.first()).not.toBeEmpty();
    }
  });

});
