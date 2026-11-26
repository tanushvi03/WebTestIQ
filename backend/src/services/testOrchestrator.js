/**
 * Test Orchestrator
 *
 * Pipeline:
 *   URL Validation → Crawl → UI Tests → Accessibility → API → AI Analysis → Report
 *
 * The crawl stage runs before UI/accessibility tests.  It classifies every
 * discovered page as public / auth_required / error.  Auth-required pages are
 * reported separately and do NOT count as UI test failures in the Quality Score.
 */

const { v4: uuidv4 }           = require('uuid');
const validateUrl               = require('../utils/validateUrl');
const { saveResult }            = require('../utils/storage');
const { crawlSite }             = require('./crawlerService');
const { runUiTests }            = require('./uiTester');
const { runAccessibilityTests } = require('./accessibilityTester');
const { runApiTests }           = require('./apiTester');
const { analyzeResults }        = require('./aiAnalyzer');
const logger                    = require('../utils/logger');

/** In-memory session store: sessionId → session object */
const sessions = new Map();

function createSession(url, options = {}) {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    url,
    options,
    phase:     'queued',
    message:   'Test queued',
    createdAt: new Date().toISOString(),
    stages: {
      url_validation:    'pending',
      crawling:          'pending',   // ← new stage
      ui_testing:        'pending',
      accessibility:     'pending',
      api_testing:       'pending',
      ai_analysis:       'pending',
      report_generation: 'pending',
    },
    result: null,
  };
  sessions.set(sessionId, session);
  return session;
}

function updateStage(session, stage, status, message) {
  session.stages[stage] = status;
  session.message       = message;
  logger.info(`[${session.sessionId.slice(0, 8)}] ${stage} → ${status}`);
}

async function runSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.phase = 'running';

  try {
    // ── Stage 1: URL Validation ───────────────────────────────────────────────
    updateStage(session, 'url_validation', 'running', 'Validating URL…');
    const urlCheck = validateUrl(session.url);
    if (!urlCheck.valid) {
      updateStage(session, 'url_validation', 'failed', urlCheck.message);
      session.phase = 'error';
      return;
    }
    updateStage(session, 'url_validation', 'completed', 'URL validated');

    const { runUi = true, runAccessibility = true, runApi = false } = session.options;

    // ── Stage 2: Crawl ────────────────────────────────────────────────────────
    updateStage(session, 'crawling', 'running', 'Crawling website…');
    logger.info(`Crawling: ${session.url}`);
    const crawlResults = await crawlSite(session.url);

    const crawlMsg =
      `Crawl: ${crawlResults.publicPages.length} public, ` +
      `${crawlResults.authPages.length} auth-required, ` +
      `${crawlResults.errorPages.length} errors`;
    updateStage(session, 'crawling', 'completed', crawlMsg);

    // ── Stage 3: UI Testing ───────────────────────────────────────────────────
    let uiResults = null;
    if (runUi) {
      updateStage(session, 'ui_testing', 'running', 'Running UI tests…');
      logger.info(`UI testing: ${session.url}`);
      uiResults = await runUiTests(session.url);
      updateStage(session, 'ui_testing', 'completed',
        `UI: ${uiResults.passed} passed, ${uiResults.failed} failed`);
    } else {
      updateStage(session, 'ui_testing', 'completed', 'Skipped');
    }

    // ── Stage 4: Accessibility ────────────────────────────────────────────────
    let a11yResults = null;
    if (runAccessibility) {
      updateStage(session, 'accessibility', 'running', 'Running accessibility scan…');
      logger.info(`Accessibility testing: ${session.url}`);
      a11yResults = await runAccessibilityTests(session.url);
      updateStage(session, 'accessibility', 'completed',
        `A11Y: ${a11yResults.violations.length} violation(s)`);
    } else {
      updateStage(session, 'accessibility', 'completed', 'Skipped');
    }

    // ── Stage 5: API Testing ──────────────────────────────────────────────────
    let apiResults = null;
    if (runApi) {
      updateStage(session, 'api_testing', 'running', 'Running API tests…');
      logger.info(`API testing: ${session.url}`);
      apiResults = await runApiTests(session.url, session.options.collectionPath || null);
      updateStage(session, 'api_testing', 'completed',
        `API: ${apiResults.passed} passed, ${apiResults.failed} failed`);
    } else {
      updateStage(session, 'api_testing', 'completed', 'Skipped');
    }

    // ── Stage 6: AI Analysis ──────────────────────────────────────────────────
    updateStage(session, 'ai_analysis', 'running', 'Running AI analysis…');
    const aiAnalysis = await analyzeResults({
      url:           session.url,
      ui:            uiResults,
      accessibility: a11yResults,
      api:           apiResults,
      crawl:         crawlResults,   // pass crawl context to AI analyser
    });
    updateStage(session, 'ai_analysis', 'completed', 'AI analysis complete');

    // ── Stage 7: Report Generation ────────────────────────────────────────────
    updateStage(session, 'report_generation', 'running', 'Generating report…');

    // Quality Score counts — auth-required pages are NOT counted as failures
    const uiPassed       = uiResults?.passed          ?? 0;
    const uiFailed       = uiResults?.failed          ?? 0;
    const apiPassed      = apiResults?.passed         ?? 0;
    const apiFailed      = apiResults?.failed         ?? 0;
    const a11yViolations = a11yResults?.violations?.length ?? 0;
    const a11yPassed     = a11yResults?.passes?.length     ?? 0;

    const totalPassed = uiPassed + apiPassed + a11yPassed;
    const totalFailed = uiFailed + apiFailed + a11yViolations;

    const finalResult = {
      sessionId:  session.sessionId,
      url:        session.url,
      status:     'completed',
      createdAt:  session.createdAt,
      summary: {
        passed: totalPassed,
        failed: totalFailed,
        total:  totalPassed + totalFailed,
        score:  (totalPassed + totalFailed)
          ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100)
          : 100,
      },
      crawl:         crawlResults,   // ← new top-level field
      ui:            uiResults,
      accessibility: a11yResults,
      api:           apiResults,
      aiAnalysis,
    };

    saveResult(session.sessionId, finalResult);
    session.result = finalResult;
    updateStage(session, 'report_generation', 'completed', 'Report saved');

    session.phase   = 'completed';
    session.message = 'All tests completed';

  } catch (err) {
    logger.error(`Orchestrator error: ${err.message}`);
    session.phase   = 'error';
    session.message = `Unexpected error: ${err.message}`;
  }
}

function startTest(url, options) {
  const session = createSession(url, options);
  runSession(session.sessionId).catch((e) =>
    logger.error(`runSession uncaught: ${e.message}`)
  );
  return { sessionId: session.sessionId };
}

function getStatus(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return {
    sessionId: s.sessionId,
    phase:     s.phase,
    message:   s.message,
    stages:    s.stages,
  };
}

module.exports = { startTest, getStatus };
