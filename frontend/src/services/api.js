import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300_000, // 5 min — tests can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ─── Test Session ────────────────────────────────────────────────────────────

/**
 * Start a new test session against a target URL.
 * @param {string} url
 * @param {object} options  e.g. { runUi, runAccessibility, runApi }
 */
export const startTest = (url, options = {}) =>
  api.post('/test/start', { url, options }).then((r) => r.data);

/**
 * Poll the status of a running test session.
 * @param {string} sessionId
 */
export const getTestStatus = (sessionId) =>
  api.get(`/test/status/${sessionId}`).then((r) => r.data);

/**
 * Fetch full results for a completed session.
 * @param {string} sessionId
 */
export const getResults = (sessionId) =>
  api.get(`/results/${sessionId}`).then((r) => r.data);

// ─── Reports ─────────────────────────────────────────────────────────────────

/** List all stored test reports */
export const listReports = () =>
  api.get('/reports').then((r) => r.data);

/** Get a single report by sessionId */
export const getReport = (sessionId) =>
  api.get(`/reports/${sessionId}`).then((r) => r.data);

// ─── History ─────────────────────────────────────────────────────────────────

/** List test history (summary of all past sessions) */
export const getHistory = () =>
  api.get('/history').then((r) => r.data);

// ─── Cucumber BDD Reports ────────────────────────────────────────────────────

/** List all Cucumber runs */
export const listCucumberRuns = () =>
  api.get('/cucumber/runs').then((r) => r.data);

/** Get detailed results for a single Cucumber run */
export const getCucumberRun = (runId) =>
  api.get(`/cucumber/runs/${runId}`).then((r) => r.data);

/** Build the HTML report URL for a given run */
export const getCucumberReportUrl = (runId) =>
  `/api/cucumber/runs/${runId}/report`;

/** Build the download URL for a given run and format */
export const getCucumberDownloadUrl = (runId, format = 'json') =>
  `/api/cucumber/runs/${runId}/download?format=${format}`;

/** Build the screenshot URL for a failed scenario */
export const getCucumberScreenshotUrl = (runId, filename) =>
  `/api/cucumber/runs/${runId}/screenshot/${filename}`;

export default api;
