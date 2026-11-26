import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  CartesianGrid,
} from 'recharts';
import { Activity, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { getHistory } from '../services/api';
import './DashboardPage.css';

const STAT_CARDS = (stats) => [
  {
    label: 'Total Runs',
    value: stats.total,
    color: 'info',
    Icon: Activity,
    tooltip: 'Total number of test sessions run',
  },
  {
    label: 'Tests Passed',
    value: stats.passed,
    color: 'success',
    Icon: CheckCircle,
    tooltip: 'Total individual tests that passed',
  },
  {
    label: 'Tests Failed',
    value: stats.failed,
    color: 'danger',
    Icon: XCircle,
    tooltip: 'Total individual tests that failed',
  },
  {
    label: 'Avg Score',
    value: stats.avgScore != null ? `${stats.avgScore}%` : '—',
    color: 'accent',
    Icon: TrendingUp,
    tooltip: 'Average quality score across all runs',
  },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontSize: '0.8rem', marginTop: '2px' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = history.reduce(
    (acc, h) => ({
      total:    acc.total    + 1,
      passed:   acc.passed   + (h.passed  || 0),
      failed:   acc.failed   + (h.failed  || 0),
      scoreSum: acc.scoreSum + (h.score   || 0),
    }),
    { total: 0, passed: 0, failed: 0, scoreSum: 0 }
  );
  stats.avgScore = stats.total ? Math.round(stats.scoreSum / stats.total) : null;

  const chartData = [...history]
    .slice(0, 8)
    .reverse()
    .map((h, i) => ({
      name:   (h.url?.replace(/^https?:\/\//, '').slice(0, 14) || `Run ${i + 1}`) + (h.url?.replace(/^https?:\/\//, '').length > 14 ? '…' : ''),
      Passed: h.passed  ?? 0,
      Failed: h.failed  ?? 0,
    }));

  return (
    <div className="dashboard fade-in">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Overview of all automated test runs</p>
        </div>
        <button
          className="btn-primary-sm"
          onClick={() => navigate('/test')}
          id="start-new-test-btn"
        >
          ▶ New Test
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        {STAT_CARDS(stats).map(({ label, value, color, Icon, tooltip }, idx) => (
          <div
            className={`stat-card stat-${color} fade-in stagger-${idx + 1}`}
            key={label}
            title={tooltip}
          >
            <div className="stat-icon-wrap">
              <Icon size={20} className="stat-icon" strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="stat-info-block">
              <span className="stat-value">{loading ? '—' : value}</span>
              <span className="stat-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      {!loading && chartData.length > 0 && (
        <div className="chart-card fade-in" style={{ marginTop: '1.25rem' }}>
          <div className="section-header">
            <h2 className="section-title">Pass / Fail Trend</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last {chartData.length} runs
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} barCategoryGap="32%" barGap={3}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  paddingTop: '0.6rem',
                }}
              />
              <Bar dataKey="Passed" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#52c47a" fillOpacity={0.82} />
                ))}
              </Bar>
              <Bar dataKey="Failed" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#e06060" fillOpacity={0.82} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent Runs ── */}
      <div className="card fade-in" style={{ marginTop: '1.25rem', padding: 0, overflow: 'hidden' }}>
        <div className="section-header" style={{ padding: '1.1rem 1.4rem 0' }}>
          <h2 className="section-title">Recent Test Runs</h2>
          <button className="btn-link" onClick={() => navigate('/history')}>View all →</button>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" aria-label="Loading" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>No test runs yet.</p>
            <button className="btn-primary-sm" onClick={() => navigate('/test')}>
              Run your first test
            </button>
          </div>
        ) : (
          <div className="runs-table-wrapper" style={{ padding: '0.25rem 0' }}>
            <table className="runs-table" role="table" aria-label="Recent test runs">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Date</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((run) => (
                  <tr key={run.sessionId}>
                    <td className="url-cell" title={run.url}>{run.url}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {run.createdAt ? new Date(run.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-success">{run.passed ?? '—'}</td>
                    <td className="text-danger">{run.failed ?? '—'}</td>
                    <td>
                      {run.score != null
                        ? <span className={`badge ${run.score >= 80 ? 'badge-success' : run.score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                            {run.score}%
                          </span>
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-link" onClick={() => navigate(`/results/${run.sessionId}`)}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick Tips ── */}
      <div className="tips-grid fade-in" style={{ marginTop: '1.25rem' }}>
        <div className="tip-card">
          <h3>Level 1 — Test any website</h3>
          <p>Enter a public URL. The platform runs UI, accessibility, and API tests automatically.</p>
        </div>
        <div className="tip-card">
          <h3>Level 2 — Platform self-tests</h3>
          <p>Run the Playwright suite in <code>tests/playwright/</code> to validate this platform itself.</p>
        </div>
        <div className="tip-card">
          <h3>AI Analysis</h3>
          <p>After a test run, AI summarises failures and suggests targeted fixes in plain language.</p>
        </div>
      </div>
    </div>
  );
}
