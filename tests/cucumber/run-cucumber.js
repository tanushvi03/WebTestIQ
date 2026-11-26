#!/usr/bin/env node
/**
 * WebTestIQ — Cucumber BDD Runner
 *
 * 1. Generates a unique run ID
 * 2. Runs Cucumber with JSON formatter
 * 3. Parses the JSON, computes scenario/step statistics
 * 4. Generates HTML report via multiple-cucumber-html-reporter
 * 5. Writes run metadata (summary.json) to reports/<runId>/
 *
 * Usage:
 *   node run-cucumber.js             (headless)
 *   HEADED=true node run-cucumber.js  (visible browser)
 */

'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT       = __dirname;
const REPORTS    = path.join(ROOT, 'reports');
const RAW_JSON   = path.join(REPORTS, 'cucumber-output.json');

// ── Generate unique run ID ───────────────────────────────────────────────────
function generateRunId() {
  const now   = new Date();
  const pad   = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand  = Math.random().toString(36).slice(2, 6);
  return `cucumber-${stamp}-${rand}`;
}

const RUN_ID = generateRunId();
const RUN_DIR = path.join(REPORTS, RUN_ID);

// ── Parse Cucumber JSON output and compute statistics ────────────────────────
function parseCucumberJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) return null;

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let totalScenarios = 0, passed = 0, failed = 0, skipped = 0;
  let totalSteps = 0, passedSteps = 0, failedSteps = 0, skippedSteps = 0;
  const features = [];

  for (const feature of raw) {
    const fName = feature.name || 'Unnamed Feature';
    const fUri  = feature.uri || '';
    const fTags = feature.tags || [];
    const scenarios = [];
    let fPassed = 0, fFailed = 0, fSkipped = 0;

    for (const el of (feature.elements || [])) {
      if (el.type !== 'scenario' && el.type !== 'scenario-outline') continue;

      let sStatus = 'passed';
      let sDuration = 0;
      const steps = [];

      for (const step of (el.steps || [])) {
        const st   = step.result?.status || 'undefined';
        const dur  = step.result?.duration || 0;
        sDuration += dur;
        totalSteps++;

        if (st === 'passed')        passedSteps++;
        else if (st === 'failed')  { failedSteps++; sStatus = 'failed'; }
        else if (st === 'skipped')  { skippedSteps++; if (sStatus !== 'failed') sStatus = 'skipped'; }
        else                        { if (sStatus !== 'failed') sStatus = 'undefined'; }

        steps.push({
          name:   step.name || '',
          keyword: step.keyword || '',
          status:  st,
          duration: dur,
          error:   step.result?.error_message || null,
        });
      }

      totalScenarios++;
      if (sStatus === 'passed')        { passed++;     fPassed++; }
      else if (sStatus === 'failed')   { failed++;      fFailed++; }
      else                              { skipped++;    fSkipped++; }

      scenarios.push({
        name:     el.name || 'Unnamed Scenario',
        type:     el.type,
        tags:     el.tags || [],
        status:   sStatus,
        duration: sDuration,
        steps,
      });
    }

    features.push({
      name:      fName,
      uri:       fUri,
      tags:      fTags,
      scenarios,
      passed:    fPassed,
      failed:    fFailed,
      skipped:   fSkipped,
    });
  }

  return {
    runId:           RUN_ID,
    timestamp:       new Date().toISOString(),
    totalScenarios,
    passed,
    failed,
    skipped,
    totalSteps,
    passedSteps,
    failedSteps,
    skippedSteps,
    features,
  };
}

// ── Generate HTML report ──────────────────────────────────────────────────────
function generateHtmlReport(jsonPath, runDir) {
  let htmlReporter;
  try {
    htmlReporter = require('multiple-cucumber-html-reporter');
  } catch {
    console.warn('  multiple-cucumber-html-reporter not installed — skipping HTML');
    return null;
  }

  // The reporter expects a directory of .json files, not a single file path.
  // Copy the JSON into a temp directory inside the run dir.
  const tmpJsonDir = path.join(runDir, 'json-input');
  fs.mkdirSync(tmpJsonDir, { recursive: true });
  fs.copyFileSync(jsonPath, path.join(tmpJsonDir, 'cucumber.json'));

  const htmlPath = path.join(runDir, 'html-report');
  try {
    htmlReporter.generate({
      jsonDir:    tmpJsonDir,
      reportPath: htmlPath,
      metadata: {
        browser: { name: 'Chromium', version: 'headless' },
        platform: { name: os.type(), version: os.release() },
        device: 'WebTestIQ CI',
      },
      customData: {
        title: 'WebTestIQ BDD Run',
        data: [
          { title: 'Run ID', value: RUN_ID },
          { title: 'Generated', value: new Date().toISOString() },
        ],
      },
    });
    // Clean up the temp JSON directory
    try { fs.rmSync(tmpJsonDir, { recursive: true }); } catch { /* */ }
    return htmlPath;
  } catch (e) {
    console.error(`  HTML report generation failed: ${e.message}`);
    try { fs.rmSync(tmpJsonDir, { recursive: true }); } catch { /* */ }
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  // Ensure reports dir exists
  fs.mkdirSync(REPORTS, { recursive: true });

  // Set env for hooks (screenshot directory)
  process.env.CUCUMBER_RUN_ID = RUN_ID;

  console.log('══════════════════════════════════════════════');
  console.log('  WebTestIQ — Cucumber BDD Runner');
  console.log('══════════════════════════════════════════════');
  console.log(`  Run ID  : ${RUN_ID}`);
  console.log(`  Headless: ${process.env.HEADED === 'true' ? 'No' : 'Yes'}`);
  console.log('');

  // ── Run Cucumber CLI ─────────────────────────────────────────────────────
  const cucumberBin = path.join(ROOT, 'node_modules', '.bin', 'cucumber-js');
  const cmd = `"${cucumberBin}"`;

  console.log('Running Cucumber…\n');
  const result = spawnSync(cmd, [], {
    shell:  true,
    stdio:  'inherit',
    cwd:    ROOT,
    env:    { ...process.env },
  });

  const exitCode = result.status;

  console.log(`\nCucumber exit code: ${exitCode}`);

  // ── Parse JSON output ─────────────────────────────────────────────────────
  if (!fs.existsSync(RAW_JSON)) {
    console.error('  ERROR: Cucumber JSON output not found. Report generation skipped.');
    process.exit(exitCode || 1);
  }

  let summary;
  try {
    summary = parseCucumberJson(RAW_JSON);
  } catch (e) {
    console.error(`  ERROR: Failed to parse Cucumber JSON output: ${e.message}`);
    process.exit(exitCode || 1);
  }
  if (!summary) {
    console.error('  ERROR: Cucumber JSON output was empty or invalid.');
    process.exit(exitCode || 1);
  }

  // ── Create run-specific directory ────────────────────────────────────────
  fs.mkdirSync(RUN_DIR, { recursive: true });

  // Move the raw JSON into the run directory (atomic write)
  const finalJsonPath = path.join(RUN_DIR, 'cucumber.json');
  fs.writeFileSync(finalJsonPath, fs.readFileSync(RAW_JSON, 'utf8'));

  // Write summary metadata
  const summaryPath = path.join(RUN_DIR, 'summary.json');
  const tmpPath     = summaryPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.renameSync(tmpPath, summaryPath);  // atomic rename

  // ── Generate HTML report ──────────────────────────────────────────────────
  const htmlPath = generateHtmlReport(RAW_JSON, RUN_DIR);

  // Clean up the temporary raw JSON
  fs.unlinkSync(RAW_JSON);

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log('');
  console.log('──────────────────────────────────────────────');
  console.log('  Cucumber Run Summary');
  console.log('──────────────────────────────────────────────');
  console.log(`  Run ID     : ${RUN_ID}`);
  console.log(`  Scenarios  : ${summary.totalScenarios}`);
  console.log(`  Passed     : ${summary.passed}`);
  console.log(`  Failed     : ${summary.failed}`);
  console.log(`  Skipped    : ${summary.skipped}`);
  console.log(`  Steps      : ${summary.totalSteps} total (${summary.passedSteps} passed, ${summary.failedSteps} failed)`);
  console.log(`  Report dir : ${RUN_DIR}`);
  console.log(`  JSON       : ${finalJsonPath}`);
  console.log(`  Summary    : ${summaryPath}`);
  if (htmlPath) console.log(`  HTML       : ${htmlPath}`);
  console.log('──────────────────────────────────────────────');

  // Exit with Cucumber's exit code so CI/CD sees failures
  process.exit(exitCode);
}

main();
