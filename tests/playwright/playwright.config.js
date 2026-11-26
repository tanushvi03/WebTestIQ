// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * WebTestIQ Self-Test Suite — Playwright configuration.
 *
 * Tests our OWN platform (Level 2 testing).
 * External website tests use the main WebTestIQ UI.
 *
 * Prerequisites before running:
 *   1. Backend  running: cd backend  && npm start   (port 5001)
 *   2. Frontend running: cd frontend && npm start   (port 3000)
 *
 * Run all self-tests:
 *   npm test
 *
 * Run only API/engine tests (no browser needed):
 *   npm test -- --grep "Testing Engine"
 *
 * Run with visible browser:
 *   npm run test:headed
 */
module.exports = defineConfig({
  testDir:        './specs',
  fullyParallel:  false,   // sequential — login state and seeded sessions must be stable
  retries:        1,       // one retry to handle flaky network conditions
  timeout:        60_000,  // 60 s default (crawl + UI tests can take ~30 s)
  expect:         { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/test-results.json' }],
  ],

  use: {
    baseURL:            'http://localhost:3000',
    headless:           true,
    screenshot:         'only-on-failure',
    video:              'retain-on-failure',
    trace:              'retain-on-failure',
    actionTimeout:      10_000,
    navigationTimeout:  25_000,
  },

  projects: [
    {
      // ── Self-Test Suite (our platform, all specs) ──────────────────────────
      name: 'self-tests',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
});
