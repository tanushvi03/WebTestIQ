/**
 * Authentication-Aware Crawler Service
 *
 * Crawls a target URL using Playwright, discovers internal pages,
 * and classifies each page as:
 *   - public        : reachable, no auth required
 *   - auth_required : redirected to login or blocked by auth
 *   - error         : HTTP error or navigation failure (non-auth)
 *
 * Returns a `crawl` object that is stored on the finalResult JSON and
 * surfaced in the Results page "Crawl" tab.
 *
 * Auth detection signals (any one is sufficient):
 *   1. HTTP 401 or 403 response code
 *   2. Final URL contains common auth path segments
 *   3. Page title / heading contains common auth phrases
 *   4. A login/sign-in form is present AND the original URL was different
 *   5. Meta-refresh or JS redirect landed on an auth page
 *
 * The crawl purposely does NOT handle credentials — it only detects barriers.
 * Authenticated session support can be added later by injecting cookies/storage.
 */

const { chromium } = require('playwright');
const logger = require('../utils/logger');

// ── Configuration ─────────────────────────────────────────────────────────────
const MAX_PAGES        = 10;   // max pages to visit per session
const PAGE_TIMEOUT     = 20_000;
const VIEWPORT         = { width: 1280, height: 800 };
const USER_AGENT       = 'Mozilla/5.0 (compatible; WebTestIQ-Crawler/1.0)';

// URL path segments that strongly indicate an auth endpoint
const AUTH_PATH_PATTERNS = [
  '/login', '/signin', '/sign-in', '/log-in', '/logon',
  '/auth', '/authenticate', '/session/new',
  '/account/login', '/users/sign_in', '/wp-login',
  '/oauth', '/sso', '/saml',
];

// Text patterns in page title or visible h1/h2 that indicate auth walls
const AUTH_TEXT_PATTERNS = [
  /\bsign\s*in\b/i, /\blog\s*in\b/i, /\blogin\b/i,
  /\bauthentication\s+required\b/i, /\baccess\s+denied\b/i,
  /\bunauthorized\b/i, /\bforbidden\b/i,
  /\bplease\s+log\s+in\b/i, /\bplease\s+sign\s+in\b/i,
  /\byou\s+must\s+(be\s+)?log(ged)?\s+in\b/i,
  /\bsession\s+expired\b/i, /\bauth.*required\b/i,
];

// ── Auth detection ────────────────────────────────────────────────────────────

/**
 * Determine whether a visited page is behind an authentication wall.
 * @param {object} opts
 * @param {import('playwright').Page} opts.page   — Playwright page after navigation
 * @param {number|null} opts.httpStatus           — HTTP response status (null on nav error)
 * @param {string} opts.originalUrl               — URL we tried to visit
 * @returns {{ isAuth: boolean, reason: string }}
 */
async function detectAuthBarrier({ page, httpStatus, originalUrl }) {
  // Signal 1 — HTTP 401 / 403
  if (httpStatus === 401 || httpStatus === 403) {
    return { isAuth: true, reason: `HTTP ${httpStatus} — Access denied` };
  }

  const finalUrl = page.url();

  // Signal 2 — final URL landed on a known auth path
  try {
    const finalPath = new URL(finalUrl).pathname.toLowerCase();
    for (const pat of AUTH_PATH_PATTERNS) {
      if (finalPath.includes(pat)) {
        return {
          isAuth: true,
          reason: `Redirected to authentication page (${finalPath})`,
        };
      }
    }
  } catch { /* invalid URL — continue */ }

  // Signal 3 — page title contains auth phrases
  try {
    const title = (await page.title()).toLowerCase();
    for (const re of AUTH_TEXT_PATTERNS) {
      if (re.test(title)) {
        return { isAuth: true, reason: `Page title indicates authentication required` };
      }
    }
  } catch { /* continue */ }

  // Signal 4 — visible h1/h2 contains auth phrases
  try {
    const headings = await page.$$eval(
      'h1, h2',
      (els) => els.map((el) => el.innerText?.trim()).filter(Boolean)
    );
    for (const h of headings) {
      for (const re of AUTH_TEXT_PATTERNS) {
        if (re.test(h)) {
          return { isAuth: true, reason: `Page heading indicates authentication required` };
        }
      }
    }
  } catch { /* continue */ }

  // Signal 5 — a login form exists AND we were redirected away from originalUrl
  try {
    const hasLoginForm = await page.$$eval('form', (forms) =>
      forms.some((f) => {
        const html = f.innerHTML.toLowerCase();
        return (
          html.includes('password') &&
          (html.includes('login') ||
           html.includes('sign') ||
           html.includes('email') ||
           html.includes('username'))
        );
      })
    );

    const redirected = finalUrl.replace(/\/$/, '') !== originalUrl.replace(/\/$/, '');
    if (hasLoginForm && redirected) {
      return { isAuth: true, reason: 'Redirected to a login form' };
    }
  } catch { /* continue */ }

  return { isAuth: false, reason: '' };
}

// ── Screenshot helper ─────────────────────────────────────────────────────────

async function captureScreenshot(page, name, label, status) {
  try {
    await page.waitForTimeout(250).catch(() => {});
    const buf = await page.screenshot({ fullPage: false });
    return {
      name,
      label,
      pageUrl:   page.url(),
      status,
      timestamp: new Date().toISOString(),
      data:      buf.toString('base64'),
      mime:      'image/png',
    };
  } catch (e) {
    logger.warn(`  Crawl screenshot failed (${label}): ${e.message}`);
    return null;
  }
}

// ── Link discovery ────────────────────────────────────────────────────────────

/**
 * Extract all same-origin href links from the current page.
 * Returns an array of absolute URLs.
 */
async function discoverLinks(page, origin) {
  try {
    return await page.$$eval(
      'a[href]',
      (anchors, origin) =>
        anchors
          .map((a) => {
            try {
              const u = new URL(a.href);
              // Same-origin only, no fragments, no mailto/tel
              if (
                u.origin === origin &&
                !a.href.includes('#') &&
                u.protocol.startsWith('http')
              ) {
                return u.href;
              }
            } catch { /* skip */ }
            return null;
          })
          .filter(Boolean),
      origin
    );
  } catch {
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Crawl the target URL, classify each discovered page, and return a
 * structured `crawl` object.
 *
 * Shape returned:
 * {
 *   startUrl: string,
 *   totalDiscovered: number,
 *   totalVisited: number,
 *   publicPages: PageResult[],
 *   authPages:   PageResult[],
 *   errorPages:  PageResult[],
 *   limited: boolean,         // true if MAX_PAGES was hit
 *   screenshots: Screenshot[],
 * }
 *
 * PageResult: { url, status, httpCode, reason, timestamp, screenshotIndex }
 */
async function crawlSite(targetUrl) {
  const result = {
    startUrl:        targetUrl,
    totalDiscovered: 0,
    totalVisited:    0,
    publicPages:     [],
    authPages:       [],
    errorPages:      [],
    limited:         false,
    screenshots:     [],
  };

  const visited    = new Set();
  const queue      = [targetUrl];
  const origin     = new URL(targetUrl).origin;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT, userAgent: USER_AGENT });

    while (queue.length > 0 && result.totalVisited < MAX_PAGES) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      const page = await context.newPage();
      let httpStatus = null;

      try {
        logger.info(`  Crawling: ${url}`);

        // Navigate
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout:   PAGE_TIMEOUT,
        });
        httpStatus = response?.status() ?? null;

        // Wait a beat for JS redirects to settle
        await page.waitForTimeout(500).catch(() => {});

        result.totalVisited++;

        // ── Classify ──────────────────────────────────────────────────────────
        const { isAuth, reason } = await detectAuthBarrier({
          page,
          httpStatus,
          originalUrl: url,
        });

        const entry = {
          url,
          finalUrl:  page.url(),
          httpCode:  httpStatus,
          timestamp: new Date().toISOString(),
          screenshotIndex: null,
        };

        if (isAuth) {
          // Auth-required page — capture evidence screenshot
          const ssIndex = result.screenshots.length;
          const ss = await captureScreenshot(
            page,
            `crawl-auth-${ssIndex}`,
            `Auth Required — ${new URL(url).pathname || '/'}`,
            'auth'
          );
          if (ss) {
            result.screenshots.push(ss);
            entry.screenshotIndex = ssIndex;
          }
          result.authPages.push({ ...entry, status: 'auth_required', reason });
          logger.info(`  🔐 Auth required: ${url} — ${reason}`);

        } else if (httpStatus && httpStatus >= 400) {
          // HTTP error (non-auth)
          result.errorPages.push({
            ...entry,
            status: 'error',
            reason: `HTTP ${httpStatus}`,
          });
          logger.info(`  ⚠ Error ${httpStatus}: ${url}`);

        } else {
          // Public page — discover more links
          result.publicPages.push({ ...entry, status: 'public', reason: '' });
          logger.info(`  ✓ Public: ${url}`);

          // Discover and enqueue new same-origin links
          const links = await discoverLinks(page, origin);
          for (const link of links) {
            if (!visited.has(link) && !queue.includes(link)) {
              queue.push(link);
            }
          }
        }

      } catch (navErr) {
        result.totalVisited++;
        result.errorPages.push({
          url,
          finalUrl:  url,
          httpCode:  null,
          status:    'error',
          reason:    navErr.message.slice(0, 120),
          timestamp: new Date().toISOString(),
          screenshotIndex: null,
        });
        logger.warn(`  ✗ Navigation failed: ${url} — ${navErr.message.slice(0, 80)}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // Record whether we hit the page cap
    result.limited = queue.length > 0;
    result.totalDiscovered = visited.size + queue.length;

  } catch (fatalErr) {
    logger.error(`Crawler fatal error: ${fatalErr.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  logger.info(
    `  Crawl complete — ` +
    `public: ${result.publicPages.length}, ` +
    `auth: ${result.authPages.length}, ` +
    `errors: ${result.errorPages.length}`
  );

  return result;
}

module.exports = { crawlSite };
