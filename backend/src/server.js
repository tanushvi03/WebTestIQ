require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const logger       = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const testRoutes     = require('./routes/testRoutes');
const resultsRoutes  = require('./routes/resultsRoutes');
const reportsRoutes  = require('./routes/reportsRoutes');
const historyRoutes  = require('./routes/historyRoutes');
const cucumberRoutes = require('./routes/cucumberRoutes');

const app  = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/test',     testRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/cucumber', cucumberRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── JSON 404 for all unmatched /api/* routes ──────────────────────────────────
// Express 4 sends its own HTML 404 before middleware if no route matched.
// Override the default handler by attaching an error-first fallback:
app.use((req, res, _next) => {
  // This fires for ALL unmatched routes — return JSON for /api paths
  if (req.path.startsWith('/api/') || req.path === '/api') {
    return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  }
  // Non-API 404 (only reached in dev; production static serves the React app)
  res.status(404).send('Not found');
});

// ── Serve React build in production ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../../frontend/build');
  app.use(express.static(buildPath));
  app.get('*', (_req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`WebTestIQ backend running on http://localhost:${PORT}`);
  logger.info(`AI provider: ${process.env.AI_PROVIDER || 'none'}`);
});

module.exports = app;
