import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory } from '../services/api';
import './HistoryPage.css';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    getHistory()
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = history.filter((h) =>
    filter === 'all'    ? true
    : filter === 'passed' ? (h.failed === 0)
    : h.failed > 0
  );

  return (
    <div className="history-page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Test History</h1>
          <p className="text-secondary page-sub">All past test sessions ({history.length} total)</p>
        </div>
        <button className="btn-primary-sm" onClick={() => navigate('/test')}>+ New Test</button>
      </div>

      <div className="filter-bar">
        {['all', 'passed', 'failed'].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state card"><span className="spinner" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          No test runs match this filter.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="history-table" role="table" aria-label="Test history">
            <thead>
              <tr>
                <th>URL</th>
                <th>Date &amp; Time</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>A11y Violations</th>
                <th>Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((run) => {
                // Prefer the API-provided score, fall back to local calculation
                const score = run.score != null
                  ? run.score
                  : (run.passed != null && run.failed != null)
                    ? Math.round((run.passed / Math.max(run.passed + run.failed, 1)) * 100)
                    : null;
                return (
                  <tr key={run.sessionId}>
                    <td className="url-cell" title={run.url}>{run.url}</td>
                    <td className="text-secondary">
                      {run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="text-success">{run.passed ?? '—'}</td>
                    <td className="text-danger">{run.failed ?? '—'}</td>
                    <td className="text-warning">{run.a11yViolations ?? '—'}</td>
                    <td>
                      {score != null
                        ? <span className={`badge ${score >= 80 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}`}>{score}%</span>
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-link"
                        onClick={() => navigate(`/results/${run.sessionId}`)}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
