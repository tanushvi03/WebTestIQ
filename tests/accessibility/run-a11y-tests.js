/**
 * Standalone Accessibility Test Runner
 * =====================================
 * Uses Playwright + axe-core to scan every page of the WebTestIQ platform
 * for WCAG 2.1 AA violations.
 *
 * Prerequisites:
 *   1. Backend  running on port 5001  (cd backend && npm start)
 *   2. Frontend running on port 3000  (cd frontend && npm start)
 *   3. Chromium installed            (cd backend && npx playwright install chromium)
 *
 * Usage:
 *   node run-a11y-tests.js [baseUrl]
 *   node run-a11y-tests.js http://localhost:3000
 */

const { chromium }  = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs            = require('fs');
const path          = require('path');

const BASE_URL     = process.argv[2] || 'http://localhost:3000';
const RESULTS_DIR  = path.join(__dirname, 'results');
const RESULTS_FILE = path.join(RESULTS_DIR, `a11y-results-${Date.now()}.json`);

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// Pages to scan — (path, requiresAuth, label)
const PAGES_PUBLIC = [
  { path: '/',       label: 'Landing Page' },
  { path: '/login',  label: 'Login Page'   },
];

const PAGES_AUTH = [
  { path: '/dashboard',                         label: 'Dashboard'     },
  { path: '/test',                              label: 'New Test'      },
  { path: '/reports',                           label: 'Reports'       },
  { path: '/history',                           label: 'History'       },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

async function scanPage(page, url, label) {
  console.log(`  Scanning: ${label} (${url})`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

  return {
    label,
    url,
    violations:  results.violations,
    passes:      results.passes.length,
    incomplete:  results.incomplete.length,
    inapplicable: results.inapplicable.length,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n♿ WebTestIQ Accessibility Tests`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Tags:   ${WCAG_TAGS.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await context.newPage();

  const allResults = [];
  let totalViolations = 0;
  let totalCritical   = 0;

  try {
    // ── Public pages ──────────────────────────────────────────────────────────
    console.log('── Public Pages ──');
    for (const p of PAGES_PUBLIC) {
      const result = await scanPage(page, `${BASE_URL}${p.path}`, p.label);
      allResults.push(result);
      totalViolations += result.violations.length;
      totalCritical   += result.violations.filter(v => v.impact === 'critical').length;
      printPageSummary(result);
    }

    // ── Authenticated pages ───────────────────────────────────────────────────
    console.log('\n── Authenticated Pages ──');
    await login(page);

    for (const p of PAGES_AUTH) {
      const result = await scanPage(page, `${BASE_URL}${p.path}`, p.label);
      allResults.push(result);
      totalViolations += result.violations.length;
      totalCritical   += result.violations.filter(v => v.impact === 'critical').length;
      printPageSummary(result);
    }

  } catch (err) {
    console.error(`\n✗ Fatal error: ${err.message}`);
  } finally {
    await browser.close();
  }

  // ── Save report ────────────────────────────────────────────────────────────
  const report = {
    generatedAt:    new Date().toISOString(),
    baseUrl:        BASE_URL,
    wcagTags:       WCAG_TAGS,
    totalViolations,
    totalCritical,
    pages:          allResults,
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────');
  console.log(`  Pages scanned   : ${allResults.length}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log(`  Critical        : ${totalCritical}`);
  console.log(`  Report          : ${RESULTS_FILE}`);
  console.log('──────────────────────────────────────────────────────\n');

  if (totalCritical > 0) {
    console.log('❌ Critical accessibility violations found. Review the report.');
    process.exit(1);
  } else if (totalViolations > 0) {
    console.log('⚠️  Accessibility violations found (none critical). Review the report.');
    process.exit(0);
  } else {
    console.log('✅ No accessibility violations found!');
    process.exit(0);
  }
}

function printPageSummary(result) {
  const vCount = result.violations.length;
  const icon   = vCount === 0 ? '  ✓' : `  ⚠`;
  const crit   = result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
  console.log(`${icon} ${result.label.padEnd(20)} ${vCount} violation(s)${crit > 0 ? ` (${crit} critical/serious)` : ''}`);
  if (vCount > 0) {
    result.violations.forEach(v => {
      console.log(`       [${v.impact.toUpperCase()}] ${v.id}: ${v.description}`);
    });
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
