const express = require('express');
const router  = express.Router();
const { listResults, loadResult } = require('../utils/storage');

/**
 * GET /api/reports
 * Returns summary list of all saved reports.
 */
router.get('/', (_req, res) => {
  const reports = listResults();
  return res.json(reports);
});

/**
 * GET /api/reports/:sessionId
 * Returns full report for one session.
 */
router.get('/:sessionId', (req, res) => {
  const data = loadResult(req.params.sessionId);
  if (!data) return res.status(404).json({ error: 'Report not found' });
  return res.json(data);
});

module.exports = router;
