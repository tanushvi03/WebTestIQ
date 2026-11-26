/**
 * Cucumber Hooks
 *
 * Before each scenario: create a fresh browser context + page
 * After each scenario:  close page + context, capture screenshot on failure
 *
 * Screenshots are saved to tests/cucumber/reports/<runId>/screenshots/
 */
const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');
const fs   = require('fs');
const path = require('path');
const { getBrowser } = require('./world');

const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');

Before(async function () {
  await this.initPage();
});

After(async function (scenario) {
  // Capture screenshot on failure
  if (scenario.result?.status === 'FAILED' && this.page) {
    try {
      const runId = process.env.CUCUMBER_RUN_ID || 'unknown';
      const ssDir = path.join(REPORTS_DIR, runId, 'screenshots');
      fs.mkdirSync(ssDir, { recursive: true });

      const sanitisedName = scenario.pickle.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
      const ssPath = path.join(ssDir, `${sanitisedName}.png`);

      await this.page.screenshot({ path: ssPath, fullPage: false });

      // Attach path to the world for the reporter
      this.failureScreenshot = ssPath;

      // Also attach base64 to scenario result if the formatter supports it
      if (typeof scenario.attach === 'function') {
        const buf = await this.page.screenshot({ fullPage: false });
        scenario.attach(buf.toString('base64'), 'image/png');
      }
    } catch (e) {
      // Screenshot failure must not hide the original scenario failure
      console.error(`  Screenshot capture failed: ${e.message}`);
    }
  }

  await this.cleanup();
});
