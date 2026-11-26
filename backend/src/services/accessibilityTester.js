/**
 * Accessibility Testing Service — uses Playwright + axe-core.
 *
 * Scans every discovered page URL (up to MAX_PAGES) and aggregates violations.
 * Returns axe-core result structure with violations, passes, incomplete arrays.
 */
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const logger = require('../utils/logger');

const MAX_PAGES = 3;

// Human-readable labels for violation IDs used in screenshot names
const VIOLATION_LABELS = {
  'image-alt':            'Missing Image Alt Text',
  'color-contrast':       'Color Contrast Issue',
  'label':                'Missing Form Label',
  'heading-order':        'Heading Order Issue',
  'link-name':            'Link Has No Name',
  'button-name':          'Button Has No Name',
  'landmark-one-main':    'Missing Main Landmark',
  'region':               'Content Outside Landmark',
  'duplicate-id':         'Duplicate ID',
  'html-has-lang':        'Missing Language Attribute',
  'document-title':       'Missing Page Title',
  'aria-required-attr':   'Missing ARIA Attribute',
  'meta-viewport':        'Viewport Zoom Disabled',
};
function getViolationLabel(id) {
  return VIOLATION_LABELS[id] || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function runAccessibilityTests(targetUrl) {
  const aggregated = {
    pagesScanned: 0,
    violations:   [],
    passes:       [],
    incomplete:   [],
    inapplicable: [],
    screenshots:  [],
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    // Collect URLs to scan: start URL + any same-origin links on the page
    const urlsToScan = [targetUrl];

    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // Discover same-origin links for up to MAX_PAGES total
      const origin = new URL(targetUrl).origin;
      const links = await page.$$eval('a[href]', (anchors, origin) =>
        anchors
          .map((a) => {
            try { return new URL(a.href).href; } catch { return null; }
          })
          .filter((href) => href && href.startsWith(origin))
          .slice(0, 10),
        origin
      );

      for (const link of links) {
        if (!urlsToScan.includes(link) && urlsToScan.length < MAX_PAGES) {
          urlsToScan.push(link);
        }
      }
    } catch (e) {
      logger.warn(`Could not gather sub-pages: ${e.message}`);
    } finally {
      await page.close().catch(() => {});
    }

    // Scan each URL
    for (const url of urlsToScan) {
      const scanPage = await context.newPage();
      try {
        logger.info(`  Scanning: ${url}`);
        await scanPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        // Capture a screenshot of each page before running axe
        try {
          const buf = await scanPage.screenshot({ fullPage: false });
          aggregated.screenshots.push({
            name:      `accessibility-page-${aggregated.pagesScanned + 1}`,
            label:     `Accessibility — Page ${aggregated.pagesScanned + 1}`,
            pageUrl:   url,
            status:    'accessibility',
            timestamp: new Date().toISOString(),
            data:      buf.toString('base64'),
            mime:      'image/png',
          });
        } catch (se) {
          logger.warn(`  A11y screenshot failed for ${url}: ${se.message}`);
        }

        const results = await new AxeBuilder({ page: scanPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .analyze();

        aggregated.pagesScanned++;

        // Merge violations (deduplicate by id)
        for (const v of results.violations) {
          const existing = aggregated.violations.find((x) => x.id === v.id);
          if (existing) {
            existing.nodes.push(...v.nodes);
          } else {
            aggregated.violations.push(v);
          }
        }

        // ── Per-violation element screenshots ──────────────────────────────
        // For each violation, scroll to its first affected element and take a
        // fresh, independent screenshot so every issue has unique evidence.
        for (const v of results.violations) {
          const ssName = `a11y-${aggregated.pagesScanned}-${v.id}`;
          let captured = false;

          // Try element-level scroll + screenshot first
          try {
            const selector = v.nodes?.[0]?.target?.[0];
            if (selector && typeof selector === 'string') {
              const el = scanPage.locator(selector).first();
              const count = await el.count().catch(() => 0);
              if (count > 0) {
                await el.scrollIntoViewIfNeeded({ timeout: 3000 });
                await scanPage.waitForTimeout(200);
                const buf = await scanPage.screenshot({ fullPage: false });
                v.screenshot = {
                  name:      ssName,
                  label:     `${getViolationLabel(v.id)} — ${v.id}`,
                  pageUrl:   url,
                  status:    'accessibility',
                  timestamp: new Date().toISOString(),
                  data:      buf.toString('base64'),
                  mime:      'image/png',
                };
                captured = true;
                logger.info(`  📷 A11y screenshot (element): ${v.id}`);
              }
            }
          } catch (e) {
            // Element locate/scroll failed — fall through to viewport screenshot
          }

          // Fallback: scroll to top of page and capture viewport
          if (!captured) {
            try {
              await scanPage.evaluate(() => window.scrollTo(0, 0));
              await scanPage.waitForTimeout(150);
              const buf = await scanPage.screenshot({ fullPage: false });
              v.screenshot = {
                name:      ssName,
                label:     `${getViolationLabel(v.id)} — ${v.id}`,
                pageUrl:   url,
                status:    'accessibility',
                timestamp: new Date().toISOString(),
                data:      buf.toString('base64'),
                mime:      'image/png',
              };
              logger.info(`  📷 A11y screenshot (viewport fallback): ${v.id}`);
            } catch (se) {
              logger.warn(`  A11y per-violation screenshot failed (${v.id}): ${se.message}`);
            }
          }
        }

        // Scroll back to top after all violation screenshots
        await scanPage.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

        // Passes — deduplicate
        for (const p of results.passes) {
          if (!aggregated.passes.find((x) => x.id === p.id)) {
            aggregated.passes.push(p);
          }
        }

        // Incomplete
        for (const inc of results.incomplete) {
          if (!aggregated.incomplete.find((x) => x.id === inc.id)) {
            aggregated.incomplete.push(inc);
          }
        }

        logger.info(
          `  Accessibility — ${results.violations.length} violation(s), ${results.passes.length} pass(es)`
        );
      } catch (err) {
        logger.error(`  Accessibility scan failed for ${url}: ${err.message}`);
      } finally {
        await scanPage.close().catch(() => {});
      }
    }

  } catch (fatalErr) {
    logger.error(`Accessibility fatal error: ${fatalErr.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Strip large node HTML to keep storage lean; preserve per-violation screenshot
  aggregated.violations = aggregated.violations.map((v) => ({
    ...v,
    screenshot: v.screenshot || null,
    nodes: v.nodes.map((n) => ({
      html:           n.html?.slice(0, 300),
      target:         n.target,
      failureSummary: n.failureSummary,
    })),
  }));

  return aggregated;
}

module.exports = { runAccessibilityTests };
