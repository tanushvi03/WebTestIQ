import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listCucumberRuns,
  getCucumberRun,
  getCucumberDownloadUrl,
  getCucumberScreenshotUrl,
} from '../services/api';
import axios from 'axios';
import './CucumberPage.css';

const STATUS_ICON = {
  passed:    { icon: '✓', cls: 'cq-status-pass',  badge: 'badge-success' },
  failed:    { icon: '✗', cls: 'cq-status-fail',  badge: 'badge-danger'  },
  skipped:   { icon: '○', cls: 'cq-status-skip',  badge: 'badge-warning' },
  undefined: { icon: '?', cls: 'cq-status-undef', badge: 'badge-info'    },
};

/**
 * Download a file via axios (goes through the React proxy) and trigger a
 * browser save dialog using a Blob URL. This avoids the "Cannot GET" error
 * that happens when anchor[download] hits a proxied path directly.
 */
async function downloadViaProxy(url, filename) {
  const resp = await axios.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export default function CucumberPage() {
  const navigate = useNavigate();
  const [runs, setRuns]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedRun, setSelectedRun]     = useState(null);
  const [runDetail, setRunDetail]         = useState(null);
  const [runLoading, setRunLoading]       = useState(false);
  const [expandedScenarios, setExpanded]  = useState({});
  const [bddRunning, setBddRunning]       = useState(false);
  const [bddStatus, setBddStatus]         = useState(null);   // { text, type: 'info'|'success'|'error' }
  const [downloading, setDownloading]     = useState(false);
  const [htmlOpening, setHtmlOpening]     = useState(false);
  const detailRef = useRef(null);

  // ── Fetch runs list ─────────────────────────────────────────────────────────
  const fetchRuns = () => {
    setLoading(true);
    setError(null);
    listCucumberRuns()
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => { setRuns([]); setError('Failed to load Cucumber reports.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRuns(); }, []);

  // ── Fetch detailed run ──────────────────────────────────────────────────────
  const openRun = (runId) => {
    setSelectedRun(runId);
    setRunDetail(null);
    setRunLoading(true);
    setExpanded({});
    getCucumberRun(runId)
      .then(setRunDetail)
      .catch(() => setRunDetail(null))
      .finally(() => {
        setRunLoading(false);
        setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
  };

  // ── Run BDD tests via backend trigger ───────────────────────────────────────
  const runBddTests = async () => {
    setBddRunning(true);
    setBddStatus({ text: 'Starting Cucumber BDD test run…', type: 'info' });
    try {
      const resp = await axios.post('/api/cucumber/run', {}, { timeout: 300_000 });
      const d = resp.data;
      setBddStatus({
        text: `Run complete: ${d.passed}/${d.totalScenarios} scenarios passed (Run ID: ${d.runId})`,
        type: d.failed > 0 ? 'error' : 'success',
      });
      // Refresh the runs list so the new run appears
      fetchRuns();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Unknown error';
      setBddStatus({ text: `Run failed: ${msg}`, type: 'error' });
    } finally {
      setBddRunning(false);
    }
  };

  // ── Download JSON via proxy ─────────────────────────────────────────────────
  const handleDownload = async (runId) => {
    setDownloading(true);
    try {
      await downloadViaProxy(getCucumberDownloadUrl(runId, 'json'), `${runId}.json`);
    } catch (e) {
      alert(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  // ── Open HTML report in new tab via proxy ───────────────────────────────────
  const handleOpenHtml = async (runId) => {
    setHtmlOpening(true);
    try {
      const resp = await axios.get(`/api/cucumber/runs/${runId}/report`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([resp.data], { type: 'text/html' }));
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      // Revoke after a short delay to allow the tab to open
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    } catch (e) {
      alert(`Could not open HTML report: ${e.message}`);
    } finally {
      setHtmlOpening(false);
    }
  };

  const toggleScenario = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const passPct = runDetail && runDetail.totalScenarios > 0
    ? Math.round((runDetail.passed / runDetail.totalScenarios) * 100)
    : 0;

  return (
    <div className="cq-page fade-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🥒 Cucumber BDD Reports</h1>
          <p className="text-secondary page-sub">
            Behaviour-Driven Development test execution results
          </p>
        </div>
        <div className="cq-header-actions">
          <button
            className="btn-primary-sm"
            onClick={runBddTests}
            disabled={bddRunning}
            title="Run all Cucumber BDD scenarios now"
          >
            {bddRunning
              ? <><span className="spinner" style={{ width: '0.9em', height: '0.9em' }} aria-hidden="true" /> Running…</>
              : '▶ Run BDD Tests'}
          </button>
          <button className="btn-ghost-sm" onClick={fetchRuns} disabled={loading}>
            ↻ Refresh
          </button>
          <button className="btn-ghost-sm" onClick={() => navigate('/reports')}>
            ← Reports
          </button>
        </div>
      </div>

      {/* BDD run status banner */}
      {bddStatus && (
        <div
          className={`cq-status-banner cq-banner-${bddStatus.type}`}
          role="status"
        >
          {bddStatus.type === 'info' && <span className="spinner" style={{ width: '0.9em', height: '0.9em', marginRight: '0.4rem' }} />}
          {bddStatus.text}
          <button
            className="cq-banner-close"
            onClick={() => setBddStatus(null)}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {error && (
        <div className="cq-error-banner" role="alert">{error}</div>
      )}

      {/* ── Runs table ── */}
      {loading ? (
        <div className="empty-state card"><span className="spinner" /> Loading Cucumber runs…</div>
      ) : runs.length === 0 ? (
        <div className="empty-state card">
          <span style={{ fontSize: '2rem' }}>🥒</span>
          <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>No Cucumber BDD runs found.</p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
            Click <strong>▶ Run BDD Tests</strong> above to execute the BDD test suite.
          </p>
          <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
            Or run manually: <code>npm run test:cucumber</code>
          </p>
        </div>
      ) : (
        <div className="cq-runs-table card" style={{ padding: 0, overflow: 'hidden' }}>
          <table role="table" aria-label="Cucumber runs">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Date</th>
                <th>Scenarios</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isSelected = selectedRun === run.runId;
                return (
                  <tr
                    key={run.runId}
                    className={isSelected ? 'cq-row-active' : ''}
                    onClick={() => openRun(run.runId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="cq-run-id" title={run.runId}>{run.runId}</td>
                    <td className="text-secondary">
                      {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                    </td>
                    <td>{run.totalScenarios ?? '—'}</td>
                    <td className="text-success">{run.passed ?? 0}</td>
                    <td className="text-danger">{run.failed ?? 0}</td>
                    <td className="text-warning">{run.skipped ?? 0}</td>
                    <td>
                      <span className={`badge ${
                        run.status === 'passed'  ? 'badge-success' :
                        run.status === 'failed'  ? 'badge-danger'  : 'badge-warning'
                      }`}>
                        {run.status || 'unknown'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn-link" onClick={() => openRun(run.runId)}>
                        Details →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Run detail panel ── */}
      {selectedRun && (
        <div className="cq-detail-section" ref={detailRef}>
          {runLoading ? (
            <div className="empty-state card"><span className="spinner" /> Loading run details…</div>
          ) : !runDetail ? (
            <div className="empty-state card">
              <p>Run details not available or corrupted.</p>
              <button className="btn-link" onClick={() => setSelectedRun(null)}>Close</button>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="cq-summary-cards">
                <div className="cq-summary-card card">
                  <span className="cq-sc-val">{runDetail.totalScenarios ?? 0}</span>
                  <span className="cq-sc-lbl">Total Scenarios</span>
                </div>
                <div className="cq-summary-card card cq-sc-pass">
                  <span className="cq-sc-val text-success">{runDetail.passed ?? 0}</span>
                  <span className="cq-sc-lbl">Passed</span>
                </div>
                <div className="cq-summary-card card cq-sc-fail">
                  <span className="cq-sc-val text-danger">{runDetail.failed ?? 0}</span>
                  <span className="cq-sc-lbl">Failed</span>
                </div>
                <div className="cq-summary-card card cq-sc-skip">
                  <span className="cq-sc-val text-warning">{runDetail.skipped ?? 0}</span>
                  <span className="cq-sc-lbl">Skipped</span>
                </div>
                <div className="cq-summary-card card">
                  <span className={`cq-sc-val ${passPct >= 80 ? 'text-success' : passPct >= 50 ? 'text-warning' : 'text-danger'}`}>
                    {passPct}%
                  </span>
                  <span className="cq-sc-lbl">Pass Rate</span>
                </div>
              </div>

              {/* Actions row */}
              <div className="cq-detail-actions">
                <button
                  className="btn-ghost-sm"
                  onClick={() => handleOpenHtml(selectedRun)}
                  disabled={htmlOpening}
                >
                  {htmlOpening ? '…Opening' : '📄 Open HTML Report'}
                </button>
                <button
                  className="btn-ghost-sm"
                  onClick={() => handleDownload(selectedRun)}
                  disabled={downloading}
                >
                  {downloading ? '…Downloading' : '↓ Download JSON'}
                </button>
                <button className="btn-link" onClick={() => setSelectedRun(null)}>
                  Close detail
                </button>
              </div>

              {/* Feature-by-feature breakdown */}
              <div className="cq-features">
                {(runDetail.features || []).map((feature, fi) => (
                  <div className="cq-feature card" key={fi}>
                    <div className="cq-feature-header">
                      <span className="cq-feature-icon">📋</span>
                      <span className="cq-feature-name">{feature.name}</span>
                      <span className="cq-feature-stats">
                        <span className="text-success">{feature.passed} passed</span>
                        {feature.failed  > 0 && <span className="text-danger">{feature.failed} failed</span>}
                        {feature.skipped > 0 && <span className="text-warning">{feature.skipped} skipped</span>}
                      </span>
                    </div>

                    <div className="cq-scenarios">
                      {(feature.scenarios || []).map((scenario, si) => {
                        const key     = `${fi}-${si}`;
                        const isExp   = expandedScenarios[key];
                        const stInfo  = STATUS_ICON[scenario.status] || STATUS_ICON.undefined;
                        return (
                          <div className={`cq-scenario ${stInfo.cls}`} key={si}>
                            <button
                              className="cq-scenario-header"
                              onClick={() => toggleScenario(key)}
                              aria-expanded={isExp}
                            >
                              <span className={`cq-step-icon ${stInfo.cls}`}>{stInfo.icon}</span>
                              <span className="cq-scenario-name">{scenario.name}</span>
                              <span className="cq-scenario-type text-muted">{scenario.type}</span>
                              <span className="cq-scenario-dur text-muted">
                                {scenario.duration
                                  ? `${(scenario.duration / 1_000_000).toFixed(0)}ms` : ''}
                              </span>
                              <span className="cq-expand-toggle">{isExp ? '▲' : '▼'}</span>
                            </button>

                            {isExp && (
                              <div className="cq-steps">
                                {(scenario.steps || []).map((step, ti) => {
                                  const sInfo = STATUS_ICON[step.status] || STATUS_ICON.undefined;
                                  return (
                                    <div className="cq-step" key={ti}>
                                      <span className={`cq-step-icon ${sInfo.cls}`}>{sInfo.icon}</span>
                                      <span className="cq-step-keyword text-muted">{step.keyword}</span>
                                      <span className="cq-step-name">{step.name}</span>
                                      <span className="cq-step-dur text-muted">
                                        {step.duration
                                          ? `${(step.duration / 1_000_000).toFixed(0)}ms` : ''}
                                      </span>
                                      {step.error && (
                                        <pre className="cq-step-error">{step.error}</pre>
                                      )}
                                    </div>
                                  );
                                })}

                                {scenario.screenshot && (
                                  <div className="cq-fail-ss">
                                    <span className="cq-ss-label">Failure Screenshot:</span>
                                    <img
                                      src={getCucumberScreenshotUrl(
                                        selectedRun,
                                        scenario.screenshot.split('/').pop()
                                      )}
                                      alt={`Failure: ${scenario.name}`}
                                      className="cq-ss-thumb"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
