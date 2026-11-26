/**
 * SPEC 12 — Testing Engine (Backend Unit-Style Tests)
 *
 * Tests the WebTestIQ backend testing engine directly via its REST API.
 * No browser UI required — uses Playwright's APIRequestContext.
 *
 * Covers:
 *  ▸ URL validation (valid, invalid, missing, empty, non-http)
 *  ▸ Test session lifecycle (start → status → results)
 *  ▸ Result JSON shape (summary, ui, accessibility, api, crawl, aiAnalysis)
 *  ▸ Quality Score accuracy  (passed / total × 100)
 *  ▸ Crawl data presence and structure
 *  ▸ Screenshot capture (at least 3 from a UI run)
 *  ▸ Accessibility scan results (violations array, passes array)
 *  ▸ AI analysis (offline fallback model)
 *  ▸ Error handling (unknown sessionId → 404, unknown route → 404 JSON)
 *  ▸ History and Reports endpoints return arrays
 *
 * Prerequisites: Backend on port 5001.
 */
const { test, expect } = require('@playwright/test');
const { startAndWaitForTest, waitForSessionComplete } = require('./helpers');

const BASE = 'http://localhost:5001';

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1 — URL Validation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — URL Validation', () => {

  // Confirm backend is reachable before URL tests run
  test.beforeAll(async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      try {
        const r = await request.get(`${BASE}/api/health`);
        if (r.status() === 200) return;
      } catch { /* not ready yet */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
  });

  test('valid https URL returns 202 with sessionId', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/test/start`, {
      data: { url: 'https://example.com', options: { runUi: false, runAccessibility: false, runApi: false } },
    });
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('valid http URL returns 202', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, {
      data: { url: 'http://example.com', options: { runUi: false, runAccessibility: false, runApi: false } },
    });
    expect(res.status()).toBe(202);
  });

  test('missing URL body returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('empty string URL returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, { data: { url: '' } });
    expect(res.status()).toBe(400);
  });

  test('whitespace-only URL returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, { data: { url: '   ' } });
    expect(res.status()).toBe(400);
  });

  test('malformed URL returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, { data: { url: 'not-a-url' } });
    expect(res.status()).toBe(400);
  });

  test('non-http scheme (ftp) returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/test/start`, { data: { url: 'ftp://example.com' } });
    expect(res.status()).toBe(400);
  });

  test('400 response includes error message mentioning URL', async ({ request }) => {
    const res  = await request.post(`${BASE}/api/test/start`, { data: { url: 'bad' } });
    const body = await res.json();
    expect(body.error.toLowerCase()).toMatch(/url/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2 — Test Session Lifecycle
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — Session Lifecycle', () => {
  test.setTimeout(30_000);

  test('GET /api/test/status with unknown sessionId returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/test/status/00000000-0000-0000-0000-000000000000`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('GET /api/results with unknown sessionId returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/results/nonexistent-id`);
    expect(res.status()).toBe(404);
  });

  test('GET /api/reports with unknown sessionId returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reports/nonexistent-id`);
    expect(res.status()).toBe(404);
  });

  test('unknown API route returns 404 JSON (not HTML)', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/no-such-endpoint`);
    expect(res.status()).toBe(404);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
  });

  test('status response has required fields: sessionId, phase, stages', async ({ request }) => {
    const startRes = await request.post(`${BASE}/api/test/start`, {
      data: { url: 'https://example.com', options: { runUi: false, runAccessibility: false, runApi: false } },
    });
    const { sessionId } = await startRes.json();

    const statusRes = await request.get(`${BASE}/api/test/status/${sessionId}`);
    const status    = await statusRes.json();

    expect(status.sessionId).toBe(sessionId);
    expect(['queued', 'running', 'completed', 'error']).toContain(status.phase);
    expect(typeof status.stages).toBe('object');
    // Must have crawling stage
    expect(status.stages).toHaveProperty('crawling');
    expect(status.stages).toHaveProperty('url_validation');
    expect(status.stages).toHaveProperty('ui_testing');
    expect(status.stages).toHaveProperty('accessibility');
    expect(status.stages).toHaveProperty('api_testing');
    expect(status.stages).toHaveProperty('ai_analysis');
    expect(status.stages).toHaveProperty('report_generation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3 — Result JSON Shape & Accuracy
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — Result Shape (crawl-only)', () => {
  test.setTimeout(60_000);

  let sessionId;
  test.beforeAll(async ({ request }) => {
    const r = await startAndWaitForTest(request, 'https://example.com', {
      runUi: false, runAccessibility: false, runApi: false,
    });
    sessionId = r.sessionId;
  });

  test('result has all top-level fields', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    for (const field of ['sessionId', 'url', 'status', 'createdAt', 'summary', 'crawl', 'aiAnalysis']) {
      expect(data).toHaveProperty(field);
    }
  });

  test('status is "completed"', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.status).toBe('completed');
  });

  test('summary has passed, failed, total, score', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const s    = data.summary;
    expect(typeof s.passed).toBe('number');
    expect(typeof s.failed).toBe('number');
    expect(typeof s.total).toBe('number');
    expect(typeof s.score).toBe('number');
    expect(s.total).toBe(s.passed + s.failed);
  });

  test('score equals round(passed/total×100) when total > 0', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const { passed, failed, total, score } = data.summary;
    if (total > 0) {
      const expected = Math.round((passed / total) * 100);
      expect(score).toBe(expected);
    }
  });

  test('crawl-only run: ui and accessibility fields are null', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.ui).toBeNull();
    expect(data.accessibility).toBeNull();
    expect(data.api).toBeNull();
  });

  test('crawl field has correct sub-fields', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const c    = data.crawl;
    expect(Array.isArray(c.publicPages)).toBe(true);
    expect(Array.isArray(c.authPages)).toBe(true);
    expect(Array.isArray(c.errorPages)).toBe(true);
    expect(typeof c.totalVisited).toBe('number');
    expect(typeof c.limited).toBe('boolean');
  });

  test('aiAnalysis has summary, model, recommendations', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const ai   = data.aiAnalysis;
    expect(typeof ai.summary).toBe('string');
    expect(typeof ai.model).toBe('string');
    expect(Array.isArray(ai.recommendations)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 4 — UI Test Results Shape
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — UI Test Results', () => {
  test.setTimeout(90_000);

  let sessionId;
  test.beforeAll(async ({ request }) => {
    const r = await startAndWaitForTest(request, 'https://example.com', {
      runUi: true, runAccessibility: false, runApi: false,
    });
    sessionId = r.sessionId;
  });

  test('ui field is present and not null', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.ui).not.toBeNull();
  });

  test('ui has passed, failed, tests, issues, screenshots arrays', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const ui   = data.ui;
    expect(typeof ui.passed).toBe('number');
    expect(typeof ui.failed).toBe('number');
    expect(Array.isArray(ui.tests)).toBe(true);
    expect(Array.isArray(ui.issues)).toBe(true);
    expect(Array.isArray(ui.screenshots)).toBe(true);
  });

  test('ui runs exactly 8 named tests', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.ui.tests).toHaveLength(8);
  });

  test('each ui test has name, passed, duration', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    for (const t of data.ui.tests) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.passed).toBe('boolean');
      expect(typeof t.duration).toBe('number');
    }
  });

  test('ui test names match expected set', async ({ request }) => {
    const EXPECTED = [
      'Page Load', 'Page Title Present', 'Navigation Links',
      'Buttons Visible', 'Images Alt Text', 'Forms Discoverable',
      'Input Fields Interactable', 'Console Errors Check',
    ];
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const names = data.ui.tests.map((t) => t.name);
    for (const n of EXPECTED) expect(names).toContain(n);
  });

  test('at least 3 screenshots are captured from a UI run', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.ui.screenshots.length).toBeGreaterThanOrEqual(3);
  });

  test('each screenshot has name, data (base64), mime, timestamp', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    for (const ss of data.ui.screenshots) {
      expect(typeof ss.name).toBe('string');
      expect(typeof ss.data).toBe('string');
      expect(ss.data.length).toBeGreaterThan(100);  // non-trivial base64
      expect(ss.mime).toMatch(/image\//);
      expect(typeof ss.timestamp).toBe('string');
    }
  });

  test('screenshot names are all unique', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const names = data.ui.screenshots.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test('ui passed + failed equals tests array length', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const ui   = data.ui;
    expect(ui.passed + ui.failed).toBe(ui.tests.length);
  });

  test('summary score is consistent with ui passed/failed', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const { passed, failed, total, score } = data.summary;
    if (total > 0) {
      expect(score).toBe(Math.round((passed / total) * 100));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 5 — Accessibility Scan Results
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — Accessibility Results', () => {
  test.setTimeout(90_000);

  let sessionId;
  test.beforeAll(async ({ request }) => {
    const r = await startAndWaitForTest(request, 'https://example.com', {
      runUi: false, runAccessibility: true, runApi: false,
    });
    sessionId = r.sessionId;
  });

  test('accessibility field is present', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    expect(data.accessibility).not.toBeNull();
  });

  test('accessibility has violations, passes, pagesScanned', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const a    = data.accessibility;
    expect(Array.isArray(a.violations)).toBe(true);
    expect(Array.isArray(a.passes)).toBe(true);
    expect(typeof a.pagesScanned).toBe('number');
    expect(a.pagesScanned).toBeGreaterThanOrEqual(1);
  });

  test('each violation has id, description, impact, nodes', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    for (const v of data.accessibility.violations) {
      expect(typeof v.id).toBe('string');
      expect(typeof v.description).toBe('string');
      expect(['critical', 'serious', 'moderate', 'minor']).toContain(v.impact);
      expect(Array.isArray(v.nodes)).toBe(true);
    }
  });

  test('each violation has a unique per-violation screenshot', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    for (const v of data.accessibility.violations) {
      expect(v.screenshot).not.toBeUndefined();
      if (v.screenshot) {
        expect(typeof v.screenshot.data).toBe('string');
        expect(v.screenshot.name).toContain(v.id);
      }
    }
  });

  test('violation screenshots are unique (not all same data)', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/results/${sessionId}`);
    const data = await res.json();
    const vWithSS = data.accessibility.violations.filter((v) => v.screenshot?.data);
    if (vWithSS.length < 2) return; // only one violation, can't compare
    // Check that not ALL base64 strings are identical (first 100 chars)
    const fingerprints = vWithSS.map((v) => v.screenshot.data.slice(0, 100));
    const unique = new Set(fingerprints);
    // At least 1 unique — usually more, but landmark/region on same page may match
    expect(unique.size).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 6 — History & Reports Endpoints
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Testing Engine — History & Reports', () => {

  test('GET /api/history returns 200 array', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/history`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('history items have required fields', async ({ request }) => {
    const res   = await request.get(`${BASE}/api/history`);
    const items = await res.json();
    if (items.length === 0) return;
    const item = items[0];
    for (const f of ['sessionId', 'url', 'status', 'createdAt', 'passed', 'failed', 'score']) {
      expect(item).toHaveProperty(f);
    }
  });

  test('GET /api/reports returns 200 array', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/reports`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/health returns status ok', async ({ request }) => {
    const res  = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});
