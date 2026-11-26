import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReports, getReport } from '../services/api';
import './ReportsPage.css';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [preview, setPreview]         = useState(null);   // expanded report
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    listReports()
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const openPreview = async (sessionId) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const full = await getReport(sessionId);
      setPreview(full);
    } catch {
      // fall back — navigate to full results page
      navigate(`/results/${sessionId}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="reports-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-secondary page-sub">All generated test reports</p>
        </div>
        <button className="btn-primary-sm" onClick={() => navigate('/test')}>
          + New Test
        </button>
      </div>

      <div className="reports-layout">
        {/* ── Report List ── */}
        <div className="reports-list-col">
          {loading ? (
            <div className="empty-state card"><span className="spinner" /> Loading…</div>
          ) : reports.length === 0 ? (
            <div className="empty-state card">
              <p style={{ marginBottom: '1rem' }}>No reports yet.</p>
              <button className="btn-primary-sm" onClick={() => navigate('/test')}>
                Run your first test
              </button>
            </div>
          ) : (
            <div className="reports-grid">
              {reports.map((r) => {
                // Use pre-computed score from API
                const score = r.summary?.score
                  ?? (r.summary?.total
                    ? Math.round(((r.summary.passed || 0) / r.summary.total) * 100)
                    : null);
                const isActive = preview?.sessionId === r.sessionId;
                return (
                  <div
                    className={`report-card card ${isActive ? 'report-card-active' : ''}`}
                    key={r.sessionId}
                  >
                    <div className="report-top">
                      <span
                        className={`score-dot ${score == null ? 'grey' : score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red'}`}
                        aria-hidden="true"
                      />
                      <span className="report-url" title={r.url}>{r.url}</span>
                    </div>
                    <div className="report-meta">
                      <span className="text-muted">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </span>
                      {score != null && (
                        <span className={`badge ${score >= 80 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                          {score}%
                        </span>
                      )}
                    </div>
                    <div className="report-stats">
                      <span className="text-success">✓ {r.summary?.passed ?? 0} passed</span>
                      <span className="text-danger">✗ {r.summary?.failed ?? 0} failed</span>
                      {r.accessibility?.violations?.length != null && (
                        <span className="text-warning">⚠ {r.accessibility.violations.length} a11y</span>
                      )}
                    </div>
                    <div className="report-actions">
                      <button
                        className="btn-link"
                        onClick={() => openPreview(r.sessionId)}
                        aria-expanded={isActive}
                      >
                        {isActive ? 'Hide preview' : 'Quick preview'}
                      </button>
                      <button
                        className="btn-link"
                        onClick={() => navigate(`/results/${r.sessionId}`)}
                      >
                        Full report →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Quick Preview Panel ── */}
        {(previewLoading || preview) && (
          <div className="preview-panel card fade-in">
            {previewLoading ? (
              <div className="preview-loading">
                <span className="spinner" /> Loading preview…
              </div>
            ) : (
              <>
                <div className="preview-header">
                  <div>
                    <h2 className="preview-title">Quick Preview</h2>
                    <p className="text-muted preview-url">{preview.url}</p>
                  </div>
                  <button className="btn-ghost-sm" onClick={() => setPreview(null)} aria-label="Close preview">✕</button>
                </div>

                {/* Score */}
                <div className={`preview-score score-chip-${(preview.summary?.score ?? 0) >= 80 ? 'good' : (preview.summary?.score ?? 0) >= 50 ? 'ok' : 'bad'}`}>
                  <span className="preview-score-val">{preview.summary?.score ?? 0}%</span>
                  <span className="preview-score-lbl">Quality Score</span>
                </div>

                {/* Stats row */}
                <div className="preview-stats">
                  <div className="pstat"><span className="pstat-v text-success">{preview.summary?.passed ?? 0}</span><span className="pstat-l">Passed</span></div>
                  <div className="pstat"><span className="pstat-v text-danger">{preview.summary?.failed ?? 0}</span><span className="pstat-l">Failed</span></div>
                  <div className="pstat"><span className="pstat-v text-warning">{preview.accessibility?.violations?.length ?? 0}</span><span className="pstat-l">A11y</span></div>
                </div>

                {/* AI summary */}
                {preview.aiAnalysis?.summary && (
                  <div className="preview-ai">
                    <p className="preview-ai-label">🤖 AI Summary</p>
                    <p className="preview-ai-text">{preview.aiAnalysis.summary}</p>
                  </div>
                )}

                {/* Top violations */}
                {preview.accessibility?.violations?.length > 0 && (
                  <div className="preview-violations">
                    <p className="preview-section-label">Top Accessibility Issues</p>
                    {preview.accessibility.violations.slice(0, 3).map((v, i) => (
                      <div key={i} className="preview-violation">
                        <span className={`badge badge-${v.impact === 'critical' || v.impact === 'serious' ? 'danger' : 'warning'}`}>
                          {v.impact}
                        </span>
                        <span className="pv-desc">{v.description}</span>
                      </div>
                    ))}
                    {preview.accessibility.violations.length > 3 && (
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        +{preview.accessibility.violations.length - 3} more — view full report
                      </p>
                    )}
                  </div>
                )}

                <button
                  className="btn-primary-sm"
                  style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate(`/results/${preview.sessionId}`)}
                >
                  Open Full Report →
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
