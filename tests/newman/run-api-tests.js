/**
 * Newman runner for the WebTestIQ API test collection.
 *
 * Usage:
 *   node run-api-tests.js [baseUrl]
 *
 * Examples:
 *   node run-api-tests.js
 *   node run-api-tests.js http://localhost:5001
 *
 * Prerequisites:
 *   npm install -g newman   (or npx newman)
 *   Backend running on baseUrl
 */
const newman   = require('newman');
const path     = require('path');
const fs       = require('fs');

const BASE_URL     = process.argv[2] || 'http://localhost:5001';
const COLLECTION   = path.join(__dirname, 'webtestiq-api-collection.json');
const RESULTS_DIR  = path.join(__dirname, 'results');
const RESULTS_FILE = path.join(RESULTS_DIR, `api-test-results-${Date.now()}.json`);

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

console.log(`\n🔌 Running API tests against: ${BASE_URL}\n`);

newman.run(
  {
    collection:      require(COLLECTION),
    envVar:          [{ key: 'baseUrl', value: BASE_URL }],
    reporters:       ['cli'],   // JSON reporter removed — response bodies contain large base64 that overflows JSON.stringify
    timeoutRequest:  15_000,
    insecure:        true,
  },
  (err, summary) => {
    if (err) {
      console.error('Newman run error:', err.message);
      process.exit(1);
    }

    const stats = summary.run.stats;
    const failed = stats.assertions.failed;

    console.log('\n──────────────────────────────────────────');
    console.log(`  Requests   : ${stats.requests.total}`);
    console.log(`  Assertions : ${stats.assertions.total}`);
    console.log(`  Passed     : ${stats.assertions.total - failed}`);
    console.log(`  Failed     : ${failed}`);
    console.log(`  Report     : ${RESULTS_FILE}`);
    console.log('──────────────────────────────────────────\n');

    if (failed > 0) {
      console.log('❌ Some API tests failed. Review the output above.');
      process.exit(1);
    } else {
      console.log('✅ All API tests passed.');
    }
  }
);
