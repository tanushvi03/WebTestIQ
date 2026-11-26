/**
 * UI Testing Service — Playwright-based automated UI tests.
 *
 * Screenshots captured (all from the REAL browser session):
 *  1. "Page Load"          — immediately after the page loads successfully
 *  2. "Homepage"           — full above-the-fold view after DOM settle
 *  3. "Navigation State"   — after navigation links are verified
 *  4. "Form State"         — if forms exist on the page
 *  5. "Failed — <name>"    — at the exact moment any test fails
 *  6. "Final State"        — after all tests complete
 *
 * Each screenshot object has:
 *   { name, label, pageUrl, status, timestamp, data (base64 PNG), mime }
 */
const { chromium } = require('playwright');
const logger = require('../utils/logger');

const TIMEOUT = 30_000;

/**
 * Take a real Playwright screenshot and push it onto the screenshots array.
 * Never throws — logs a warning and continues on failure.
 */
async function capture(page, screenshots, name, label, status = 'info') {
  try {
    // Small wait so the page has settled visually before we shoot
    await page.waitForTimeout(300).catch(() => {});
    const buf = await page.screenshot({ fullPage: false });
    screenshots.push({
      name,
      label,
      pageUrl:   page.url(),
      status,
      timestamp: new Date().toISOString(),
      data:      buf.toString('base64'),
      mime:      'image/png',
    });
    logger.info(`  📷 Captured: "${label}"`);
  } catch (e) {
    logger.warn(`  Screenshot failed ("${label}"): ${e.message}`);
  }
}

async function runUiTests(targetUrl) {
  const results = {
    passed:        0,
    failed:        0,
    tests:         [],
    issues:        [],
    screenshots:   [],
    consoleErrors: [],
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport:  { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (compatible; WebTestIQ/1.0; Automation Testing Platform)',
    });
    const page = await context.newPage();

    // ── Console error capture ─────────────────────────────────────────────────
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const loc = msg.location();
        results.consoleErrors.push({
          text:   msg.text() || null,
          url:    loc?.url    || null,
          line:   loc?.lineNumber   != null ? loc.lineNumber   : null,
          column: loc?.columnNumber != null ? loc.columnNumber : null,
        });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Page Load
    // Screenshot: "Page Load" — taken right after the page responds
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Page Load', async () => {
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });
      const status = response?.status();
      if (!status || status >= 400) throw new Error(`HTTP ${status}`);
      // Screenshot 1 — page just loaded
      await capture(page, results.screenshots, 'page-load', 'Page Load', 'passed');
      return `HTTP ${status}`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Page Title
    // Screenshot: "Homepage" — wait for networkidle so above-the-fold renders
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Page Title Present', async () => {
      // Try to wait for a more complete render; ignore timeout if site is slow
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      const title = await page.title();
      if (!title || title.trim().length === 0) throw new Error('Page has no title');
      // Screenshot 2 — homepage fully rendered
      await capture(page, results.screenshots, 'homepage', 'Homepage', 'passed');
      return `Title: "${title}"`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Navigation Links
    // Screenshot: "Navigation State" — after verifying links
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Navigation Links', async () => {
      const links = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((a) => ({ text: a.innerText?.trim(), href: a.getAttribute('href') }))
          .filter((l) => l.href && l.href !== '#' && !l.href.startsWith('javascript:'))
      );
      if (links.length === 0) throw new Error('No valid navigation links found');
      // Screenshot 3 — navigation state
      await capture(page, results.screenshots, 'navigation-state', 'Navigation State', 'passed');
      return `${links.length} links found`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Buttons Visible
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Buttons Visible', async () => {
      const count = await page.$$eval(
        'button, [role="button"], input[type="submit"]',
        (btns) => btns.filter((b) => b.offsetParent !== null).length
      );
      return `${count} visible button(s)`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Images Alt Text
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Images Alt Text', async () => {
      const { total, missing } = await page.$$eval('img', (imgs) => ({
        total:   imgs.length,
        missing: imgs.filter((i) => !i.alt || i.alt.trim() === '').length,
      }));
      if (missing > 0) {
        results.issues.push({
          source:      'accessibility',
          id:          'image-alt',
          description: `${missing} of ${total} images are missing alternative text`,
          severity:    'moderate',
          nodes:       missing,
          selector:    'img[alt=""], img:not([alt])',
        });
        throw new Error(`${missing}/${total} images missing alt text`);
      }
      return `All ${total} images have alt text`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Forms Discoverable
    // Screenshot: "Form State" — only if forms actually exist
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Forms Discoverable', async () => {
      const count = await page.$$eval('form', (f) => f.length);
      if (count > 0) {
        // Screenshot 4 (conditional) — page state showing forms
        await capture(page, results.screenshots, 'form-state', 'Form State', 'info');
      }
      return `${count} form(s) on page`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Input Fields Interactable
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Input Fields Interactable', async () => {
      const inputs = await page.$$(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled])'
      );
      if (inputs.length === 0) return 'No input fields found (skip)';
      let interactable = 0;
      for (const input of inputs.slice(0, 5)) {
        try { await input.fill('TestValue'); await input.clear(); interactable++; }
        catch { /* some inputs reject programmatic fill */ }
      }
      return `${interactable}/${Math.min(inputs.length, 5)} inputs interactable`;
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Console Errors Check
    // ─────────────────────────────────────────────────────────────────────────
    await runTest(results, 'Console Errors Check', async () => {
      if (results.consoleErrors.length > 0) {
        results.issues.push({
          source:        'runtime',
          description:   `${results.consoleErrors.length} console error(s) detected`,
          severity:      'minor',
          selector:      'browser console',
          consoleErrors: results.consoleErrors,
        });
        throw new Error(`${results.consoleErrors.length} console error(s)`);
      }
      return 'No console errors';
    }, page, results.screenshots);

    // ─────────────────────────────────────────────────────────────────────────
    // Screenshot: "Final State" — after all tests, whatever the page looks like
    // ─────────────────────────────────────────────────────────────────────────
    await capture(page, results.screenshots, 'final-state', 'Final State', 'info');

  } catch (fatalErr) {
    logger.error(`UI test fatal error: ${fatalErr.message}`);
    results.issues.push({
      description: `UI testing aborted: ${fatalErr.message}`,
      severity:    'critical',
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return results;
}

/**
 * Wraps each test fn.
 * On failure: captures a "Failed — <Test Name>" screenshot at the exact
 * browser state when the failure occurred, then records the failure.
 */
async function runTest(results, name, fn, page, screenshots) {
  const start = Date.now();
  try {
    const detail = await fn();
    results.passed++;
    results.tests.push({ name, passed: true, detail, duration: Date.now() - start });
    logger.info(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    // Failure screenshot — named clearly so the frontend can link it
    if (page && screenshots) {
      await capture(
        page,
        screenshots,
        `failed-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
        `Failed — ${name}`,
        'failed'
      );
    }
    results.failed++;
    results.tests.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    logger.warn(`  ✗ ${name} — ${err.message}`);
  }
}

module.exports = { runUiTests };
