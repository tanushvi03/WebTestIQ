const express = require('express');
const router  = express.Router();
const { loadResult } = require('../utils/storage');

/**
 * GET /api/results/:sessionId
 */
router.get('/:sessionId', (req, res) => {
  const data = loadResult(req.params.sessionId);
  if (!data) return res.status(404).json({ error: 'Result not found' });
  return res.json(data);
});

module.exports = router;
