/**
 * API Testing Service — runs a Newman (Postman) collection.
 *
 * How it works:
 *  1. If a collectionPath is provided → run that collection against the target URL.
 *  2. Otherwise → run a built-in "smoke" collection that probes common REST endpoints
 *     on the target host (GET /, GET /api, GET /api/health, GET /api/status, etc.)
 *
 * Returns a normalised results object compatible with the frontend ResultsPage.
 */
const newman  = require('newman');
const path    = require('path');
const logger  = require('../utils/logger');

/** Small built-in smoke collection for arbitrary target URLs */
function buildSmokeCollection(targetUrl) {
  const base = new URL(targetUrl).origin;
  const endpoints = ['/', '/api', '/api/health', '/api/status', '/api/version', '/health'];

  return {
    info: {
      name:   'WebTestIQ Smoke Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: endpoints.map((ep) => ({
      name: `GET ${ep}`,
      request: {
        method: 'GET',
        url:    `${base}${ep}`,
      },
    })),
  };
}

/**
 * Run API tests using Newman.
 *
 * @param {string} targetUrl
 * @param {string|null} collectionPath  Path to a Postman .json collection file (optional)
 * @returns {Promise<object>}
 */
function runApiTests(targetUrl, collectionPath = null) {
  return new Promise((resolve) => {
    const collection = collectionPath
      ? require(path.resolve(collectionPath))
      : buildSmokeCollection(targetUrl);

    const summary = {
      passed:   0,
      failed:   0,
      duration: 0,
      tests:    [],
      failures: [],
    };

    newman.run(
      {
        collection,
        reporters:       ['cli'],
        timeoutRequest:  15_000,
        timeoutScript:   5_000,
        insecure:        true,
      },
      (err, newmanSummary) => {
        if (err) {
          logger.error(`Newman run error: ${err.message}`);
          resolve({ ...summary, error: err.message });
          return;
        }

        const run = newmanSummary?.run;
        summary.duration = run?.timings?.completed
          ? run.timings.completed - run.timings.started
          : 0;

        // Build per-execution test list
        (run?.executions || []).forEach((exec) => {
          const name     = exec.item?.name || 'Unknown';
          const status   = exec.response?.status;
          const code     = exec.response?.code;
          const passed   = !exec.requestError && code < 500;

          if (passed) summary.passed++;
          else        summary.failed++;

          summary.tests.push({
            name,
            passed,
            status: code,
            statusText: status,
            duration: exec.response?.responseTime,
          });

          if (!passed) {
            summary.failures.push({
              name,
              error: exec.requestError?.message || `HTTP ${code}`,
            });
          }
        });

        logger.info(`  API — ${summary.passed} passed, ${summary.failed} failed`);
        resolve(summary);
      }
    );
  });
}

module.exports = { runApiTests };
