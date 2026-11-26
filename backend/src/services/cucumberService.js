/**
 * Cucumber Report Service
 *
 * Lists, reads and validates Cucumber BDD run artifacts stored under
 * tests/cucumber/reports/<runId>/.
 *
 * Each run directory contains:
 *   cucumber.json   — raw Cucumber JSON output (source of truth)
 *   summary.json    — pre-computed statistics + feature/scenario breakdown
 *   html-report/    — generated HTML report (optional)
 *   screenshots/    — failure screenshots (optional)
 *
 * All file access is sandboxed to the cucumber reports directory.
 * Run IDs are validated as safe path segments to prevent traversal attacks.
 */
const fs   = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const CUCUMBER_REPORTS_DIR = path.resolve(
  __dirname, '../../..', 'tests', 'cucumber', 'reports'
);

// Regex for valid run IDs — prevents path traversal
const RUN_ID_RE = /^[a-zA-Z0-9._-]+$/;

/** Safely resolve a path inside the reports directory */
function safeResolve(runId) {
  if (!runId || !RUN_ID_RE.test(runId)) return null;
  const resolved = path.resolve(CUCUMBER_REPORTS_DIR, runId);
  // Ensure the resolved path is still inside the reports directory
  if (!resolved.startsWith(CUCUMBER_REPORTS_DIR + path.sep) &&
      resolved !== CUCUMBER_REPORTS_DIR) return null;
  return resolved;
}

/** Ensure the reports directory exists */
function ensureDir() {
  if (!fs.existsSync(CUCUMBER_REPORTS_DIR)) {
    fs.mkdirSync(CUCUMBER_REPORTS_DIR, { recursive: true });
  }
}

/**
 * List all cucumber runs (summary only).
 * Returns an array sorted by timestamp (newest first).
 */
function listRuns() {
  ensureDir();
  const entries = fs.readdirSync(CUCUMBER_REPORTS_DIR, { withFileTypes: true });

  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!RUN_ID_RE.test(entry.name)) continue;

    const runDir     = path.join(CUCUMBER_REPORTS_DIR, entry.name);
    const summaryPath = path.join(runDir, 'summary.json');

    if (fs.existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        runs.push({
          runId:           entry.name,
          timestamp:       summary.timestamp || null,
          totalScenarios:  summary.totalScenarios  ?? 0,
          passed:          summary.passed          ?? 0,
          failed:          summary.failed          ?? 0,
          skipped:         summary.skipped         ?? 0,
          totalSteps:      summary.totalSteps      ?? 0,
          features:        (summary.features || []).map(f => ({
            name:      f.name,
            passed:    f.passed,
            failed:    f.failed,
            skipped:   f.skipped,
            scenarioCount: f.scenarios?.length ?? 0,
          })),
          status: (summary.failed ?? 0) > 0 ? 'failed' : 'passed',
          hasHtml: fs.existsSync(path.join(runDir, 'html-report', 'index.html')),
        });
      } catch (e) {
        logger.warn(`Cucumber: corrupted summary.json in ${entry.name}: ${e.message}`);
        runs.push({ runId: entry.name, status: 'corrupted', totalScenarios: 0 });
      }
    } else {
      // No summary.json — incomplete or corrupted run
      runs.push({ runId: entry.name, status: 'incomplete', totalScenarios: 0 });
    }
  }

  runs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return runs;
}

/**
 * Get detailed results for a single run.
 */
function getRun(runId) {
  const runDir = safeResolve(runId);
  if (!runDir) return null;
  if (!fs.existsSync(runDir)) return null;

  const summaryPath = path.join(runDir, 'summary.json');
  if (!fs.existsSync(summaryPath)) return { runId, status: 'incomplete' };

  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    // Add screenshot paths for failed scenarios if available
    const ssDir = path.join(runDir, 'screenshots');
    if (fs.existsSync(ssDir) && summary.features) {
      const screenshots = fs.readdirSync(ssDir).filter(f => f.endsWith('.png'));
      for (const feature of summary.features) {
        for (const scenario of feature.scenarios) {
          if (scenario.status === 'failed') {
            const baseName = (scenario.name || '').toLowerCase()
              .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
            const match = screenshots.find(f => f.startsWith(baseName.slice(0, 20)));
            scenario.screenshot = match ? `${runId}/screenshots/${match}` : null;
          }
        }
      }
    }
    return summary;
  } catch (e) {
    logger.warn(`Cucumber: failed to read summary for ${runId}: ${e.message}`);
    return null;
  }
}

/**
 * Get the HTML report path for a run (or null if not generated).
 */
function getHtmlReportPath(runId) {
  const runDir = safeResolve(runId);
  if (!runDir) return null;
  const indexPath = path.join(runDir, 'html-report', 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  return indexPath;
}

/**
 * Get the JSON artifact path for a run (or null if not found).
 */
function getJsonReportPath(runId) {
  const runDir = safeResolve(runId);
  if (!runDir) return null;
  const jsonPath = path.join(runDir, 'cucumber.json');
  if (!fs.existsSync(jsonPath)) return null;
  return jsonPath;
}

/**
 * Get a screenshot file path for a run.
 */
function getScreenshotPath(runId, filename) {
  const runDir = safeResolve(runId);
  if (!runDir) return null;
  if (!filename || !/^[a-zA-Z0-9._-]+\.png$/.test(filename)) return null;
  const ssPath = path.join(runDir, 'screenshots', filename);
  if (!ssPath.startsWith(path.join(runDir, 'screenshots'))) return null;
  if (!fs.existsSync(ssPath)) return null;
  return ssPath;
}

module.exports = {
  listRuns,
  getRun,
  getHtmlReportPath,
  getJsonReportPath,
  getScreenshotPath,
  CUCUMBER_REPORTS_DIR,
};
