const express = require('express');
const router  = express.Router();
const { listResults } = require('../utils/storage');

/**
 * GET /api/history
 * Returns summary of all past sessions (same data as /api/reports but
 * with extra fields the History page needs).
 */
router.get('/', (_req, res) => {
  const all = listResults().map((r) => ({
    sessionId:      r.sessionId,
    url:            r.url,
    status:         r.status,
    createdAt:      r.createdAt,
    passed:         r.summary?.passed  ?? 0,
    failed:         r.summary?.failed  ?? 0,
    score:          r.summary?.score   ?? null,
    a11yViolations: r.accessibility?.violations?.length ?? 0,
  }));
  return res.json(all);
});

module.exports = router;
