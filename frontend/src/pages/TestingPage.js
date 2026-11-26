import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startTest, getTestStatus } from '../services/api';
import toast from 'react-hot-toast';
import './TestingPage.css';

const STAGES = [
  { key: 'url_validation',    label: 'URL Validation'       },
  { key: 'crawling',          label: 'Crawling'             },
  { key: 'ui_testing',        label: 'UI Testing'           },
  { key: 'accessibility',     label: 'Accessibility Scan'   },
  { key: 'api_testing',       label: 'API Testing'          },
  { key: 'ai_analysis',       label: 'AI Analysis'          },
  { key: 'report_generation', label: 'Report Generation'    },
];

function validateUrl(val) {
  if (!val.trim()) return 'URL is required.';
  try {
    const u = new URL(val.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return 'URL must start with http:// or https://';
    return null;
  } catch {
    return 'Enter a valid URL (e.g. https://example.com)';
  }
}

export default function TestingPage() {
  const navigate = useNavigate();

  const [url, setUrl]           = useState('');
  const [urlError, setUrlError] = useState('');
  const [options, setOptions]   = useState({
    runUi:            true,
    runAccessibility: true,
    runApi:           false,
  });

  const [phase, setPhase]         = useState('idle');   // idle | running | done | error
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus]       = useState(null);

  const pollRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleStart = async () => {
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError('');
    setPhase('running');
    setStatus(null);

    try {
      const data = await startTest(url.trim(), options);
      setSessionId(data.sessionId);

      // Poll every 2 s
      pollRef.current = setInterval(async () => {
        try {
          const s = await getTestStatus(data.sessionId);
          setStatus(s);
          if (s.phase === 'completed' || s.phase === 'error') {
            clearInterval(pollRef.current);
            setPhase(s.phase === 'completed' ? 'done' : 'error');
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (e) {
      toast.error('Failed to start test. Is the backend running?');
      setPhase('idle');
    }
  };

  const getStageStatus = (key) => {
    if (!status?.stages) return 'pending';
    return status.stages[key] || 'pending';
  };

  const stageIcon = (s) => {
    if (s === 'completed') return <span className="stage-icon ok" aria-label="Completed">✓</span>;
    if (s === 'running')   return <span className="stage-icon spin" aria-label="Running"><span className="spinner" /></span>;
    if (s === 'failed')    return <span className="stage-icon fail" aria-label="Failed">✗</span>;
    return <span className="stage-icon pending" aria-label="Pending">○</span>;
  };

  return (
    <div className="testing-page fade-in">
      <div className="page-header">
        <h1 className="page-title">New Test</h1>
        <p className="page-sub text-secondary">
          Enter a target website URL to start automated testing
        </p>
      </div>

      {/* ── Input Form ── */}
      {phase === 'idle' && (
        <div className="test-form card fade-in">
          <div className="field">
            <label htmlFor="target-url">Target Website URL</label>
            <div className="url-input-row">
              <input
                id="target-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError('');
                }}
                aria-describedby={urlError ? 'url-err' : undefined}
                aria-invalid={!!urlError}
                autoFocus
              />
              <button
                className="btn-start"
                onClick={handleStart}
                disabled={!url}
                id="start-testing-btn"
              >
                ▶ Start Testing
              </button>
            </div>
            {urlError && (
              <span id="url-err" className="field-error" role="alert">{urlError}</span>
            )}
          </div>

          <div className="options-section">
            <p className="options-label">Test modules</p>
            <div className="options-grid">
              {[
                { key: 'runUi',            icon: '🖥️', label: 'UI / Browser',     desc: 'Playwright' },
                { key: 'runAccessibility', icon: '♿', label: 'Accessibility',     desc: 'axe-core'   },
                { key: 'runApi',           icon: '🔌', label: 'API Testing',       desc: 'Newman'     },
              ].map(({ key, icon, label, desc }) => (
                <label
                  key={key}
                  className={`option-card ${options[key] ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                    aria-label={label}
                  />
                  <span className="option-icon">{icon}</span>
                  <span className="option-label">{label}</span>
                  <span className="option-desc text-muted">{desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="disclaimer">
            <strong>Note:</strong> The platform performs predefined automated tests. Results depend on
            the target site's structure. Custom selectors and business-logic tests can be added as
            needed.
          </div>
        </div>
      )}

      {/* ── Progress ── */}
      {(phase === 'running' || phase === 'done' || phase === 'error') && (
        <div className="progress-card card fade-in">
          <div className="progress-header">
            <div>
              <h2 className="progress-title">
                {phase === 'running' && <><span className="pulse-dot" aria-hidden="true" /> Testing in progress…</>}
                {phase === 'done'    && '✓ Testing complete'}
                {phase === 'error'   && '✗ Testing encountered errors'}
              </h2>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {url}
              </p>
            </div>
            {phase === 'done' && (
              <button
                className="btn-start"
                onClick={() => navigate(`/results/${sessionId}`)}
                id="view-results-btn"
              >
                View Results →
              </button>
            )}
          </div>

          <div className="stages-list" role="list" aria-label="Test stages">
            {STAGES.map(({ key, label }) => {
              const s = getStageStatus(key);
              return (
                <div className={`stage-item stage-${s}`} key={key} role="listitem">
                  {stageIcon(s)}
                  <span className="stage-label">{label}</span>
                  <span className={`stage-badge badge badge-${s === 'completed' ? 'success' : s === 'running' ? 'info' : s === 'failed' ? 'danger' : 'accent'}`}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>

          {status?.message && (
            <p className="status-message text-secondary">{status.message}</p>
          )}

          {phase === 'error' && (
            <button
              className="btn-link"
              style={{ marginTop: '1rem' }}
              onClick={() => { setPhase('idle'); setStatus(null); }}
            >
              ← Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
