/**
 * Cucumber Custom World — manages a single Playwright browser + page instance
 * per scenario.  Provides shared state (page, baseUrl, consoleErrors) to
 * every step definition via `this.page`, `this.baseUrl`, etc.
 *
 * The browser is launched in BeforeAll and closed in AfterAll to avoid
 * re-launching Chromium for every scenario (faster).  A fresh context + page
 * is created per scenario in the Before hook, ensuring isolation.
 */
const { setWorldConstructor, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADLESS = process.env.HEADED !== 'true';

let browser;

class WebTestIQWorld {
  constructor(options) {
    this.baseUrl      = BASE_URL;
    this.page         = null;
    this.context      = null;
    this.consoleErrors = [];
  }

  async initPage() {
    this.context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    this.page = await this.context.newPage();

    // Track console errors for assertion
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  async cleanup() {
    if (this.page)    await this.page.close().catch(() => {});
    if (this.context) await this.context.close().catch(() => {});
  }
}

setWorldConstructor(WebTestIQWorld);

BeforeAll(async () => {
  browser = await chromium.launch({ headless: HEADLESS });
});

AfterAll(async () => {
  if (browser) await browser.close();
});

// Export for hooks.js
module.exports = { WebTestIQWorld, getBrowser: () => browser };
