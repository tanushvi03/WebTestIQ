const express  = require('express');
const router   = express.Router();
const { startTest, getStatus } = require('../services/testOrchestrator');
const validateUrl = require('../utils/validateUrl');

/**
 * POST /api/test/start
 * Body: { url: string, options?: { runUi, runAccessibility, runApi } }
 */
router.post('/start', (req, res) => {
  const { url, options = {} } = req.body;

  const check = validateUrl(url);
  if (!check.valid) {
    return res.status(400).json({ error: check.message });
  }

  const result = startTest(check.url, options);
  return res.status(202).json(result);
});

/**
 * GET /api/test/status/:sessionId
 */
router.get('/status/:sessionId', (req, res) => {
  const status = getStatus(req.params.sessionId);
  if (!status) return res.status(404).json({ error: 'Session not found' });
  return res.json(status);
});

module.exports = router;
