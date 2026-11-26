/**
 * Cucumber Reports API Routes
 *
 * GET  /api/cucumber/runs                          — list all runs
 * GET  /api/cucumber/runs/:runId                   — detailed run results
 * GET  /api/cucumber/runs/:runId/report            — serve HTML report
 * GET  /api/cucumber/runs/:runId/download          — download JSON or HTML artifact
 * GET  /api/cucumber/runs/:runId/screenshot/:file  — serve failure screenshot
 * POST /api/cucumber/run                           — trigger a new Cucumber run
 */
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const { spawnSync } = require('child_process');
const fs       = require('fs');
const {
  listRuns,
  getRun,
  getHtmlReportPath,
  getJsonReportPath,
  getScreenshotPath,
  CUCUMBER_REPORTS_DIR,
} = require('../services/cucumberService');
const logger   = require('../utils/logger');

// ── Trigger a new Cucumber run ───────────────────────────────────────────────
router.post('/run', (req, res) => {
  // __dirname = backend/src/routes  → go up 4 levels to project root
  const cucumberDir = path.resolve(__dirname, '..', '..', '..', 'tests', 'cucumber');
  const runScript   = path.join(cucumberDir, 'run-cucumber.js');

  if (!fs.existsSync(runScript)) {
    return res.status(500).json({ error: 'Cucumber runner script not found' });
  }

  logger.info('Cucumber: starting run via API trigger');

  const result = spawnSync('node', [runScript], {
    cwd:     cucumberDir,
    stdio:   'pipe',
    timeout: 300_000,
    env:     { ...process.env },
  });

  if (result.error) {
    logger.error(`Cucumber run error: ${result.error.message}`);
    return res.status(500).json({ error: `Failed to run Cucumber: ${result.error.message}` });
  }

  // Find the most recent run by reading the reports dir
  const runs = listRuns();
  const latestRun = runs[0];

  if (!latestRun) {
    const stderr = result.stderr?.toString() || '';
    return res.status(500).json({
      error: 'Cucumber run completed but no report was generated',
      detail: stderr.slice(0, 500),
    });
  }

  logger.info(`Cucumber run complete: ${latestRun.runId}, passed=${latestRun.passed}, failed=${latestRun.failed}`);
  return res.json({
    runId:          latestRun.runId,
    totalScenarios: latestRun.totalScenarios,
    passed:         latestRun.passed,
    failed:         latestRun.failed,
    skipped:        latestRun.skipped,
    status:         latestRun.status,
  });
});

// ── List all runs ────────────────────────────────────────────────────────────
router.get('/runs', (_req, res) => {
  try {
    const runs = listRuns();
    return res.json(runs);
  } catch (e) {
    logger.error(`Cucumber list runs error: ${e.message}`);
    return res.status(500).json({ error: 'Failed to list cucumber runs' });
  }
});

// ── Get a single run's details ───────────────────────────────────────────────
router.get('/runs/:runId', (req, res) => {
  const { runId } = req.params;
  const run = getRun(runId);
  if (!run) return res.status(404).json({ error: 'Cucumber run not found' });
  return res.json(run);
});

// ── Serve the HTML report ─────────────────────────────────────────────────────
router.get('/runs/:runId/report', (req, res) => {
  const htmlPath = getHtmlReportPath(req.params.runId);
  if (!htmlPath) return res.status(404).json({ error: 'HTML report not found for this run' });

  // Serve the single index.html file (the reporter generates a self-contained file)
  return res.sendFile(htmlPath);
});

// ── Download JSON artifact ────────────────────────────────────────────────────
router.get('/runs/:runId/download', (req, res) => {
  const { runId } = req.params;
  const format = (req.query.format || 'json').toLowerCase();

  if (format === 'json') {
    const jsonPath = getJsonReportPath(runId);
    if (!jsonPath) return res.status(404).json({ error: 'JSON report not found for this run' });
    return res.download(jsonPath, `${runId}.json`);
  }

  if (format === 'html') {
    const htmlPath = getHtmlReportPath(runId);
    if (!htmlPath) return res.status(404).json({ error: 'HTML report not found for this run' });
    return res.download(htmlPath, `${runId}.html`);
  }

  return res.status(400).json({ error: `Unsupported format: ${format}. Use json or html.` });
});

// ── Serve a failure screenshot ───────────────────────────────────────────────
router.get('/runs/:runId/screenshot/:file', (req, res) => {
  const { runId, file } = req.params;
  const ssPath = getScreenshotPath(runId, file);
  if (!ssPath) return res.status(404).json({ error: 'Screenshot not found' });
  return res.sendFile(ssPath);
});

module.exports = router;
