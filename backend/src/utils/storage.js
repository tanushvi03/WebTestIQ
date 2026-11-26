/**
 * Simple JSON file storage for test session results.
 * All results are stored in backend/results/<sessionId>.json
 */
const fs   = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(
  __dirname, '../../',
  process.env.RESULTS_DIR || 'results'
);

// Ensure the results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function resultPath(sessionId) {
  return path.join(RESULTS_DIR, `${sessionId}.json`);
}

/** Save (create/overwrite) a session result */
function saveResult(sessionId, data) {
  fs.writeFileSync(resultPath(sessionId), JSON.stringify(data, null, 2), 'utf8');
}

/** Load a single session result. Returns null if not found. */
function loadResult(sessionId) {
  const p = resultPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** List all saved session results (summary only) */
function listResults() {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
        return {
          sessionId:      data.sessionId,
          url:            data.url,
          status:         data.status,
          createdAt:      data.createdAt,
          summary:        data.summary,
          accessibility:  data.accessibility
            ? { violations: data.accessibility.violations }
            : null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { saveResult, loadResult, listResults };
