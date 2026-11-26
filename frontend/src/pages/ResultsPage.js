import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getResults } from '../services/api';
import './ResultsPage.css';

const SEV_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3, info: 4 };

// ── Human-readable labels for raw axe-core rule IDs ──────────────────────────
const AXE_LABELS = {
  'image-alt':            'Images Missing Alternative Text',
  'color-contrast':       'Insufficient Color Contrast',
  'label':                'Form Inputs Missing Labels',
  'link-name':            'Links Have No Accessible Name',
  'button-name':          'Buttons Have No Accessible Name',
  'heading-order':        'Incorrect Heading Structure',
  'landmark-one-main':    'Page Missing Main Landmark',
  'region':               'Content Outside Landmark Regions',
  'aria-required-attr':   'Missing Required ARIA Attributes',
  'aria-valid-attr-value':'Invalid ARIA Attribute Value',
  'duplicate-id':         'Duplicate Element IDs Found',
  'html-has-lang':        'Page Missing Language Attribute',
  'document-title':       'Page Missing Title',
  'skip-link':            'Missing Skip Navigation Link',
  'frame-title':          'Frames Missing Title',
  'list':                 'Incorrect List Structure',
  'listitem':             'List Item Outside List Context',
  'meta-viewport':        'Viewport Zoom Disabled',
  'scrollable-region-focusable': 'Scrollable Region Not Focusable',
  'tabindex':             'Excessive Tab Index Values',
};

// Map axe-core rule ID → why-it-matters + recommendation
const A11Y_ADVICE = {
  'image-alt': {
    why: 'Screen readers cannot describe images without alternative text, making visual content inaccessible to blind users.',
    fix: 'Add a meaningful alt attribute to every informational image. Use alt="" for decorative images.',
  },
  'color-contrast': {
    why: 'Low contrast text is difficult to read for users with low vision or colour blindness.',
    fix: 'Ensure a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text.',
  },
  'label': {
    why: 'Form inputs without labels are confusing for screen reader users and voice control users.',
    fix: 'Associate every input with a <label> element using htmlFor/id or an aria-label attribute.',
  },
  'link-name': {
    why: 'Links with no text or accessible name cannot be understood by screen reader users.',
    fix: 'Ensure every link has visible text, an aria-label, or an aria-labelledby reference.',
  },
  'button-name': {
    why: 'Buttons with no accessible name cannot be understood or activated by screen reader users.',
    fix: 'Add visible text content or an aria-label to every button.',
  },
};

function getA11yLabel(id) {
  return AXE_LABELS[id] || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function getA11yAdvice(id) {
  return A11Y_ADVICE[id] || {
    why: 'This accessibility rule helps ensure the page is usable by people with disabilities.',
    fix: 'Review the affected elements and apply the recommended fix from the WCAG guidelines.',
  };
}

// Suppress raw technical strings as main descriptions
function isRawTechnical(str) {
  if (!str) return false;
  const s = str.trim();
  // CSS selectors, "browser console", pure rule IDs
  return (
    s.startsWith('img[') ||
    s === 'browser console' ||
    /^\w[\w-]*$/.test(s) ||       // single word like an axe rule id
    s.includes(':not(') ||
    s.includes('[alt=')
  );
}

// Expandable "Technical Details" section
function TechDetails({ children, label = 'Technical Details' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tech-details">
      <button
        className="tech-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        {label} {open ? '▲' : '▼'}
      </button>
      {open && <div className="tech-body">{children}</div>}
    </div>
  );
}

// ── Category summary cards ────────────────────────────────────────────────────
function CategoryCards({ ui, accessibility, apiResults, totalA11yIssues, crawl }) {
  const cats = [];

  // Crawl card — always first when crawl data exists
  if (crawl) {
    const pub   = crawl.publicPages?.length  ?? 0;
    const auth  = crawl.authPages?.length    ?? 0;
    const err   = crawl.errorPages?.length   ?? 0;
    const total = pub + auth + err;
    cats.push({
      label:   'Crawl',
      icon:    '🔍',
      crawl:   true,
      pub, auth, err, total,
      limited: crawl.limited,
      color:   auth > 0 ? 'warn' : 'good',
    });
  } else {
    cats.push({ label: 'Crawl', notRun: true, icon: '🔍' });
  }

  if (ui) {
    // UI passed/failed = only the actual Playwright test cases (not issues[])
    cats.push({
      label: 'UI Tests',
      passed: ui.passed ?? 0,
      total:  (ui.passed ?? 0) + (ui.failed ?? 0),
      color:  (ui.failed ?? 0) > 0 ? 'warn' : 'good',
      icon:   '🖥️',
    });
  } else {
    cats.push({ label: 'UI Tests', notRun: true, icon: '🖥️' });
  }

  if (accessibility) {
    const vCount = totalA11yIssues;          // unified violation count
    const pCount = accessibility.passes?.length ?? 0;
    cats.push({
      label:  'Accessibility',
      passed: pCount,
      total:  pCount + vCount,
      color:  vCount > 0 ? 'warn' : 'good',
      icon:   '♿',
      note:   vCount > 0 ? `${vCount} violation${vCount > 1 ? 's' : ''}` : 'No violations',
    });
  } else if (ui?.issues?.some(i => i.source === 'accessibility')) {
    // Axe wasn't run but Playwright found a11y issues
    const vCount = ui.issues.filter(i => i.source === 'accessibility').length;
    cats.push({
      label: 'Accessibility',
      passed: 0,
      total:  vCount,
      color:  'warn',
      icon:   '♿',
      note:   `${vCount} issue${vCount > 1 ? 's' : ''} found`,
    });
  } else {
    cats.push({ label: 'Accessibility', notRun: true, icon: '♿' });
  }

  if (apiResults) {
    cats.push({
      label: 'API Tests',
      passed: apiResults.passed ?? 0,
      total:  (apiResults.passed ?? 0) + (apiResults.failed ?? 0),
      color:  (apiResults.failed ?? 0) > 0 ? 'warn' : 'good',
      icon:   '🔌',
    });
  } else {
    cats.push({ label: 'API Tests', notRun: true, icon: '🔌' });
  }

  return (
    <div className="category-cards">
      {cats.map(c => (
        <div className={`cat-card cat-${c.notRun ? 'notrun' : c.color}`} key={c.label}>
          <span className="cat-icon" aria-hidden="true">{c.icon}</span>
          <div className="cat-info">
            <span className="cat-label">{c.label}</span>
            {c.notRun ? (
              <span className="cat-status notrun">Not Run</span>
            ) : c.crawl ? (
              <>
                <span className="cat-status">
                  <span className="cat-pass">{c.pub}</span>
                  <span className="cat-unit"> public</span>
                </span>
                {c.auth > 0 && (
                  <span className="cat-note">🔐 {c.auth} auth-required</span>
                )}
                {c.err > 0 && (
                  <span className="cat-note" style={{ color: 'var(--danger)' }}>
                    ⚠ {c.err} error{c.err > 1 ? 's' : ''}
                  </span>
                )}
                {c.limited && (
                  <span className="cat-note" style={{ color: 'var(--text-muted)' }}>
                    (page limit reached)
                  </span>
                )}
              </>
            ) : (
              <span className="cat-status">
                <span className="cat-pass">{c.passed}</span>
                <span className="cat-sep">/</span>
                <span className="cat-total">{c.total}</span>
                <span className="cat-unit"> passed</span>
              </span>
            )}
            {!c.crawl && c.note && !c.notRun && (
              <span className="cat-note">{c.note}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Issue card (compact, hides raw technical info) ───────────────────────────
function IssueCard({ issue, screenshot, onViewScreenshot }) {
  const isA11y = issue.type === 'Accessibility';
  const advice = isA11y ? getA11yAdvice(issue.id) : null;

  // Clean description — never show raw selectors as primary text
  const displayDesc = (isRawTechnical(issue.description) && issue.id)
    ? getA11yLabel(issue.id)
    : (issue.description || getA11yLabel(issue.id || 'Unknown Issue'));

  const sevClass =
    issue.severity === 'critical' || issue.severity === 'serious' ? 'sev-high' :
    issue.severity === 'moderate' ? 'sev-med' : 'sev-low';

  return (
    <div className={`issue-compact ${sevClass}`}>
      <div className="issue-compact-header">
        <div className="issue-compact-badges">
          <span className={`badge badge-${issue.type === 'UI' ? 'accent' : issue.type === 'Runtime' ? 'info' : issue.type === 'API' ? 'info' : 'warning'}`}>
            {issue.type}
          </span>
          <span className={`badge ${sevClass === 'sev-high' ? 'badge-danger' : sevClass === 'sev-med' ? 'badge-warning' : 'badge-info'}`}>
            {issue.severity || 'info'}
          </span>
        </div>
        {issue.nodes > 0 && (
          <span className="issue-affected">{issue.nodes} element{issue.nodes > 1 ? 's' : ''} affected</span>
        )}
      </div>

      <p className="issue-compact-title">{displayDesc}</p>

      {advice && (
        <div className="issue-advice">
          <div className="advice-row">
            <span className="advice-lbl">Why it matters:</span>
            <span className="advice-val">{advice.why}</span>
          </div>
          <div className="advice-row">
            <span className="advice-lbl">Recommendation:</span>
            <span className="advice-val">{advice.fix}</span>
          </div>
        </div>
      )}

      {issue.detail && !isRawTechnical(issue.detail) && (
        <p className="issue-detail-text">{issue.detail}</p>
      )}

      {/* Accessibility page screenshot */}
      {screenshot && (
        <div className="issue-screenshot">
          <span className="issue-ss-label">Screenshot:</span>
          <button
            className="ss-inline-btn"
            onClick={() => onViewScreenshot && onViewScreenshot(screenshot)}
            aria-label="View page screenshot"
          >
            <img
              className="ss-inline-thumb"
              src={`data:${screenshot.mime || 'image/png'};base64,${screenshot.data}`}
              alt={`Page: ${screenshot.pageUrl || ''}`}
            />
            <span className="ss-inline-hint">Click to enlarge</span>
          </button>
        </div>
      )}
      {issue.type === 'Accessibility' && !screenshot && (
        <p className="text-muted" style={{ fontSize: '0.78rem' }}>
          Screenshot unavailable for this finding.
        </p>
      )}

      {/* Technical details collapsed by default */}
      {(issue.selector || issue.id || issue.detail || issue.nodes || issue.consoleErrors?.length > 0) && (
        <TechDetails>
          {issue.id       && <div className="tech-row"><span className="tech-key">Rule:</span><code>{issue.id}</code></div>}
          {/* For runtime/console issues, show each error entry instead of a raw selector */}
          {issue.type === 'Runtime' && issue.consoleErrors?.length > 0
            ? issue.consoleErrors.map((e, i) => {
                const msg = typeof e === 'string' ? e : e?.text;
                return (
                  <div className="tech-row console-error-entry" key={i}>
                    <span className="tech-key">{i + 1}.</span>
                    <div className="console-error-body">
                      <span className="console-error-type">Error</span>
                      <span className="console-error-msg">
                        {msg || 'Console error detected, but the browser did not provide additional error details.'}
                      </span>
                      {typeof e === 'object' && e?.url && (
                        <span className="console-error-loc">
                          {e.url}{e.line != null ? `:${e.line}` : ''}{e.column != null ? `:${e.column}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            : issue.selector && (
                <div className="tech-row"><span className="tech-key">Source:</span><code>{issue.selector}</code></div>
              )
          }
          {issue.detail   && <div className="tech-row"><span className="tech-key">Detail:</span><span>{issue.detail}</span></div>}
          {issue.nodes    && <div className="tech-row"><span className="tech-key">Elements:</span><span>{issue.nodes} affected</span></div>}
          {issue.helpUrl  && (
            <div className="tech-row">
              <a href={issue.helpUrl} target="_blank" rel="noreferrer" className="help-link">
                WCAG Reference →
              </a>
            </div>
          )}
        </TechDetails>
      )}
    </div>
  );
}

// ── UI test row ───────────────────────────────────────────────────────────────
function UITestRow({ t, failScreenshot, onViewScreenshot }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ui-test-row ${t.passed ? 'pass' : 'fail'}`}>
      <span className={`ui-status-icon ${t.passed ? 'text-success' : 'text-danger'}`}>
        {t.passed ? '✓' : '✗'}
      </span>
      <span className="ui-test-name">{t.name}</span>
      {t.duration && <span className="ui-test-dur text-muted">{(t.duration / 1000).toFixed(1)}s</span>}
      {!t.passed && (
        <button className="tech-toggle ui-expand-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          Details {open ? '▲' : '▼'}
        </button>
      )}
      {!t.passed && open && (
        <div className="ui-fail-detail">
          {t.error && (
            <div className="fail-row">
              <span className="fail-lbl">Error:</span>
              <span className="fail-val">{t.error}</span>
            </div>
          )}
          {t.detail && !isRawTechnical(t.detail) && (
            <div className="fail-row">
              <span className="fail-lbl">Detail:</span>
              <span className="fail-val">{t.detail}</span>
            </div>
          )}
          {/* Inline failure screenshot */}
          {failScreenshot ? (
            <div className="fail-screenshot">
              <span className="fail-lbl" style={{ marginBottom: '0.4rem' }}>Failure Screenshot:</span>
              <button
                className="ss-inline-btn"
                onClick={() => onViewScreenshot && onViewScreenshot(failScreenshot)}
                aria-label="View failure screenshot"
              >
                <img
                  className="ss-inline-thumb"
                  src={`data:${failScreenshot.mime || 'image/png'};base64,${failScreenshot.data}`}
                  alt={`Failure: ${t.name}`}
                />
                <span className="ss-inline-hint">Click to enlarge</span>
              </button>
            </div>
          ) : (
            <div className="fail-row">
              <span className="fail-lbl">Screenshot:</span>
              <span className="fail-val text-muted">Screenshot unavailable for this finding.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Accessibility tab ─────────────────────────────────────────────────────────
// extraIssues = ui-derived a11y findings (source:'accessibility') that are
// not duplicated in axe-core violations
function A11yTab({ accessibility, extraIssues = [], onViewScreenshot }) {
  // If neither axe ran nor any playwright a11y issues exist → not run
  if (!accessibility && extraIssues.length === 0) {
    return (
      <div className="not-run-msg">
        <span className="not-run-icon">♿</span>
        <p>Accessibility testing was not run for this session.</p>
      </div>
    );
  }

  const axeViolations = accessibility?.violations || [];

  // Normalise extraIssues into the same shape as axe violations for IssueCard
  const extraNormalised = extraIssues.map(i => ({
    type:        'Accessibility',
    id:          i.id,
    description: i.description,
    severity:    i.severity,
    nodes:       i.nodes ?? 0,
    selector:    i.selector,
    helpUrl:     i.helpUrl,
  }));

  // Merged list for display — axe violations first, then extra
  const allViolations = [...axeViolations, ...extraNormalised];

  // Severity counts across the full merged list
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  allViolations.forEach(v => {
    const imp = v.impact ?? v.severity;
    if (imp && counts[imp] !== undefined) counts[imp]++;
  });

  return (
    <div className="fade-in">
      {/* Severity breakdown chips */}
      <div className="a11y-severity-row">
        {Object.entries(counts).map(([level, count]) => (
          <div className={`sev-chip sev-chip-${level}`} key={level}>
            <span className="sev-chip-count">{count}</span>
            <span className="sev-chip-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
          </div>
        ))}
        {accessibility && (
          <div className="sev-chip sev-chip-pass">
            <span className="sev-chip-count">{accessibility.passes?.length ?? 0}</span>
            <span className="sev-chip-label">Passed</span>
          </div>
        )}
      </div>

      {allViolations.length === 0 ? (
        <div className="success-msg">🎉 No accessibility violations found!</div>
      ) : (
        <div className="issues-compact-list">
          {/* Axe violations */}
          {axeViolations
            .slice()
            .sort((a, b) => (SEV_ORDER[a.impact] ?? 9) - (SEV_ORDER[b.impact] ?? 9))
            .map((v, i) => {
              // Use the per-violation screenshot captured by the backend for this specific rule
              const ss = v.screenshot || null;
              return (
                <IssueCard
                  key={`axe-${i}`}
                  issue={{
                    type:        'Accessibility',
                    id:          v.id,
                    description: v.description,
                    severity:    v.impact,
                    nodes:       v.nodes?.length ?? 0,
                    helpUrl:     v.helpUrl,
                    screenshot:  v.screenshot || null,
                  }}
                  screenshot={ss}
                  onViewScreenshot={onViewScreenshot}
                />
              );
            })}
          {/* Playwright-detected a11y issues not covered by axe */}
          {extraNormalised
            .slice()
            .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
            .map((issue, i) => (
              <IssueCard key={`extra-${i}`} issue={issue} onViewScreenshot={onViewScreenshot} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('overview');
  const [lightbox, setLightbox] = useState(null); // { data, mime, label, pageUrl, status, timestamp }

  useEffect(() => {
    getResults(sessionId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div className="results-page fade-in rp-center">
      <span className="spinner" aria-label="Loading results" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!data) return (
    <div className="results-page fade-in">
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>Results not found</h2>
        <p className="text-secondary" style={{ margin: '0.75rem 0 1.5rem' }}>
          Session <code>{sessionId}</code> may still be running or the ID is invalid.
        </p>
        <button className="btn-primary-sm" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  const { url, summary, ui, accessibility, api: apiResults, aiAnalysis, crawl, createdAt } = data;

  // ── Derive numbers from actual data, never fake ───────────────────────────
  const totalPassed = summary?.passed ?? 0;
  const totalFailed = summary?.failed ?? 0;
  const total       = totalPassed + totalFailed;
  const score       = summary?.score ?? (total ? Math.round((totalPassed / total) * 100) : 0);

  // ── Build the unified issues list ────────────────────────────────────────
  // ui.issues[] can contain items with source:'accessibility' (e.g. alt-text
  // found by Playwright) or source:'ui' (e.g. console errors).
  // accessibility.violations[] contains axe-core findings.
  // We merge both accessibility sources so each violation appears once.

  // Collect axe violation IDs to avoid duplicating them if Playwright also
  // caught the same kind of issue.
  const axeViolationIds = new Set(
    (accessibility?.violations || []).map(v => v.id)
  );

  // UI issues that are genuinely UI (source:'ui') — runtime/browser issues get their own type
  const uiOnlyIssues = (ui?.issues || [])
    .filter(i => i.source !== 'accessibility')
    .map(i => ({ ...i, type: i.source === 'runtime' ? 'Runtime' : 'UI' }));

  // Accessibility issues from ui.issues[] (source:'accessibility') that are
  // NOT already covered by the axe scanner results
  const uiDerivedA11yIssues = (ui?.issues || [])
    .filter(i => i.source === 'accessibility' && !axeViolationIds.has(i.id))
    .map(i => ({ ...i, type: 'Accessibility' }));

  // Full axe-core violations — carry the per-violation screenshot through
  const axeIssues = (accessibility?.violations || []).map(v => ({
    type:        'Accessibility',
    id:          v.id,
    description: v.description,
    severity:    v.impact,
    nodes:       v.nodes?.length ?? 0,
    helpUrl:     v.helpUrl,
    screenshot:  v.screenshot || null,   // per-violation, not shared
  }));

  // API failures
  const apiIssues = (apiResults?.failures || []).map(f => ({
    type:        'API',
    description: f.name,
    severity:    'serious',
    detail:      f.error,
  }));

  const allIssues = [
    ...uiOnlyIssues,
    ...uiDerivedA11yIssues,
    ...axeIssues,
    ...apiIssues,
  ].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));

  // ── Compute unified a11y issue count (used in score row, category card, tab label)
  // = axe violations + Playwright-caught a11y issues not already in axe results
  const totalA11yIssues =
    (accessibility?.violations?.length ?? 0) + uiDerivedA11yIssues.length;

  // ── Merge all screenshots (UI + accessibility pages) ─────────────────────
  // Normalise legacy entries (old results had name:'page-screenshot' with no label)
  const LEGACY_LABELS = {
    'page-screenshot':    'Page Screenshot',
    'initial-load':       'Page Load',
    'post-navigation':    'Navigation State',
    'final':              'Final State',
    'final-state':        'Final State',
    'homepage':           'Homepage',
    'navigation-state':   'Navigation State',
    'form-state':         'Form State',
  };

  function normaliseSS(ss) {
    const label = ss.label || LEGACY_LABELS[ss.name] || ss.name || 'Screenshot';
    const status = ss.status || 'info';
    return { ...ss, label, status };
  }

  const allScreenshots = [
    ...(ui?.screenshots || []).map(normaliseSS),
    ...(accessibility?.screenshots || []).map(normaliseSS),
    ...(crawl?.screenshots || []).map(s => normaliseSS({ ...s, status: s.status || 'auth' })),
  ];

  // ── Crawl summary helpers ─────────────────────────────────────────────────
  const hasAuthPages  = (crawl?.authPages?.length  ?? 0) > 0;
  const crawlLimited  = crawl?.limited ?? false;
  const showCrawlBanner = hasAuthPages || crawlLimited;

  const tabs = [
    { key: 'overview',      label: 'Overview' },
    { key: 'crawl',         label: `🔍 Crawl${crawl ? ` (${crawl.totalVisited ?? 0})` : ''}` },
    { key: 'ui',            label: `UI Tests${ui ? ` (${(ui.passed ?? 0) + (ui.failed ?? 0)})` : ''}` },
    { key: 'accessibility', label: `Accessibility${(accessibility || uiDerivedA11yIssues.length > 0) ? ` (${totalA11yIssues} issue${totalA11yIssues !== 1 ? 's' : ''})` : ''}` },
    { key: 'api',           label: `API Tests${apiResults ? ` (${(apiResults.passed ?? 0) + (apiResults.failed ?? 0)})` : ''}` },
    { key: 'screenshots',   label: `📷 Screenshots${allScreenshots.length > 0 ? ` (${allScreenshots.length})` : ''}` },
    { key: 'ai',            label: '🤖 AI Analysis' },
  ];

  const scoreClass = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad';

  return (
    <div className="results-page fade-in">
      {/* ── Page Header ── */}
      <div className="rp-header">
        <div className="rp-header-left">
          <h1 className="page-title">Test Results</h1>
          <div className="rp-meta">
            <span className="rp-url" title={url}>🌐 {url}</span>
            {createdAt && (
              <span className="rp-date text-muted">
                {new Date(createdAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-ghost-sm" onClick={() => navigate('/test')}>+ New Test</button>
          <button className="btn-ghost-sm" onClick={() => navigate('/reports')}>Reports →</button>
        </div>
      </div>

      {/* ── Auth / Crawl Banner ── */}
      {showCrawlBanner && (
        <div className="crawl-banner fade-in" role="alert">
          <span className="crawl-banner-icon">🔐</span>
          <div className="crawl-banner-body">
            <strong>
              {hasAuthPages
                ? 'Limited crawl — some pages require authentication'
                : 'Crawl limit reached — not all pages were visited'}
            </strong>
            <p>
              {hasAuthPages
                ? `${crawl.authPages.length} page${crawl.authPages.length > 1 ? 's' : ''} could not be accessed because ${crawl.authPages.length > 1 ? 'they require' : 'it requires'} authentication. WebTestIQ tested the ${crawl.publicPages.length} publicly accessible page${crawl.publicPages.length !== 1 ? 's' : ''}.`
                : `The crawl visited ${crawl.totalVisited} pages and stopped at the page limit. Additional pages may exist.`}
            </p>
          </div>
        </div>
      )}

      {/* ── Score + Stats row ── */}
      <div className={`rp-score-row card score-${scoreClass}`}>
        <div className="rp-score-block">
          <span className={`rp-score-val score-color-${scoreClass}`}>{score}%</span>
          <span className="rp-score-lbl">Quality Score</span>
        </div>
        <div className="rp-score-divider" aria-hidden="true" />
        <div className="rp-stats">
          <div className="rp-stat">
            <span className="rp-stat-val">{total}</span>
            <span className="rp-stat-lbl">Total</span>
          </div>
          <div className="rp-stat">
            <span className="rp-stat-val text-success">{totalPassed}</span>
            <span className="rp-stat-lbl">Passed</span>
          </div>
          <div className="rp-stat">
            <span className="rp-stat-val text-danger">{totalFailed}</span>
            <span className="rp-stat-lbl">Failed</span>
          </div>
          {totalA11yIssues > 0 && (
            <div className="rp-stat">
              <span className="rp-stat-val text-warning">{totalA11yIssues}</span>
              <span className="rp-stat-lbl">A11y Issues</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" role="tablist" aria-label="Result sections">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="tab-content">

        {/* ── CRAWL ── */}
        {tab === 'crawl' && (
          <div className="fade-in">
            {!crawl ? (
              <div className="not-run-msg">
                <span className="not-run-icon">🔍</span>
                <p>Crawl data is not available for this session.</p>
                <p className="not-run-hint">Re-run the test to get crawl results.</p>
              </div>
            ) : (
              <>
                {/* ── Summary chips ── */}
                <div className="crawl-summary-row">
                  <div className="crawl-chip crawl-chip-pub">
                    <span className="crawl-chip-val">{crawl.publicPages?.length ?? 0}</span>
                    <span className="crawl-chip-lbl">Public Pages</span>
                  </div>
                  <div className="crawl-chip crawl-chip-auth">
                    <span className="crawl-chip-val">{crawl.authPages?.length ?? 0}</span>
                    <span className="crawl-chip-lbl">Auth Required</span>
                  </div>
                  <div className="crawl-chip crawl-chip-err">
                    <span className="crawl-chip-val">{crawl.errorPages?.length ?? 0}</span>
                    <span className="crawl-chip-lbl">Errors</span>
                  </div>
                  <div className="crawl-chip crawl-chip-total">
                    <span className="crawl-chip-val">{crawl.totalVisited ?? 0}</span>
                    <span className="crawl-chip-lbl">Visited</span>
                  </div>
                </div>

                {crawl.limited && (
                  <div className="crawl-limit-note">
                    ℹ Crawl stopped at the page limit ({crawl.totalVisited} pages visited).
                    Additional pages may exist on this site.
                  </div>
                )}

                {/* ── Public pages ── */}
                {(crawl.publicPages?.length ?? 0) > 0 && (
                  <div className="crawl-section">
                    <div className="crawl-section-hdr crawl-hdr-pub">
                      ✓ Public Pages ({crawl.publicPages.length})
                    </div>
                    <div className="crawl-page-list card">
                      {crawl.publicPages.map((p, i) => (
                        <div className="crawl-page-row crawl-row-pub" key={i}>
                          <span className="crawl-row-icon text-success">✓</span>
                          <div className="crawl-row-info">
                            <span className="crawl-row-url">{p.finalUrl || p.url}</span>
                            {p.httpCode && (
                              <span className="badge badge-success crawl-code">{p.httpCode}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Auth-required pages ── */}
                {(crawl.authPages?.length ?? 0) > 0 && (
                  <div className="crawl-section">
                    <div className="crawl-section-hdr crawl-hdr-auth">
                      🔐 Authentication Required ({crawl.authPages.length})
                    </div>
                    <p className="crawl-auth-note text-muted">
                      These pages could not be tested. They require an authenticated session.
                      This is not necessarily a defect — it is expected behaviour for protected content.
                    </p>
                    <div className="crawl-page-list card">
                      {crawl.authPages.map((p, i) => {
                        const ss = p.screenshotIndex != null
                          ? (crawl.screenshots || [])[p.screenshotIndex]
                          : null;
                        return (
                          <div className="crawl-page-row crawl-row-auth" key={i}>
                            <span className="crawl-row-icon">🔐</span>
                            <div className="crawl-row-info">
                              <span className="crawl-row-url">{p.url}</span>
                              {p.reason && (
                                <span className="crawl-row-reason text-muted">{p.reason}</span>
                              )}
                              <span className="badge badge-warning">Authentication Required</span>
                            </div>
                            {ss && (
                              <button
                                className="crawl-ss-btn"
                                onClick={() => setLightbox(ss)}
                                title="View evidence screenshot"
                                aria-label="View authentication barrier screenshot"
                              >
                                <img
                                  className="crawl-ss-thumb"
                                  src={`data:${ss.mime || 'image/png'};base64,${ss.data}`}
                                  alt="Auth barrier evidence"
                                />
                                <span className="crawl-ss-hint">View</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Error pages ── */}
                {(crawl.errorPages?.length ?? 0) > 0 && (
                  <div className="crawl-section">
                    <div className="crawl-section-hdr crawl-hdr-err">
                      ⚠ Errors ({crawl.errorPages.length})
                    </div>
                    <div className="crawl-page-list card">
                      {crawl.errorPages.map((p, i) => (
                        <div className="crawl-page-row crawl-row-err" key={i}>
                          <span className="crawl-row-icon text-danger">✗</span>
                          <div className="crawl-row-info">
                            <span className="crawl-row-url">{p.url}</span>
                            {p.reason && (
                              <span className="crawl-row-reason text-muted">{p.reason}</span>
                            )}
                            {p.httpCode && (
                              <span className="badge badge-danger crawl-code">{p.httpCode}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="fade-in">
            <CategoryCards ui={ui} accessibility={accessibility} apiResults={apiResults} totalA11yIssues={totalA11yIssues} crawl={crawl} />

            {allIssues.length === 0 ? (
              <div className="success-msg" style={{ marginTop: '1.25rem' }}>
                🎉 No issues detected across all test categories.
              </div>
            ) : (
              <>
                <div className="section-label">
                  All Issues <span className="section-label-count">({allIssues.length})</span>
                </div>
                <div className="issues-compact-list">
                  {allIssues.map((issue, i) => {
                    // Use the per-violation screenshot stored directly on the issue object.
                    // For axe violations this is issue.screenshot (set by the backend).
                    // ui-derived a11y issues don't have one — show unavailable.
                    const ss = issue.screenshot || null;
                    return (
                      <IssueCard key={i} issue={issue} screenshot={ss} onViewScreenshot={setLightbox} />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── UI TESTS ── */}
        {tab === 'ui' && (
          <div className="fade-in">
            {!ui ? (
              <div className="not-run-msg">
                <span className="not-run-icon">🖥️</span>
                <p>UI testing was not run for this session.</p>
              </div>
            ) : (
              <>
                <div className="ui-stats-row">
                  <span className="badge badge-success">✓ Passed: {ui.passed ?? 0}</span>
                  <span className="badge badge-danger">✗ Failed: {ui.failed ?? 0}</span>
                  {ui.screenshots?.length > 0 && (
                    <span className="badge badge-info">📷 {ui.screenshots.length} screenshot{ui.screenshots.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="ui-test-list card">
                  {(ui.tests || []).map((t, i) => {
                    // Build the failure screenshot key — try both new and legacy naming
                    const cleanName = (t.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                    const failSS = !t.passed
                      ? (ui.screenshots || []).find(
                          s => s.name === `failed-${cleanName}` ||
                               s.name === `fail-${cleanName}`    // legacy fallback
                        )
                      : null;
                    return (
                      <UITestRow
                        key={i}
                        t={t}
                        failScreenshot={failSS}
                        onViewScreenshot={setLightbox}
                      />
                    );
                  })}
                </div>
                {ui.consoleErrors?.length > 0 && (
                  <TechDetails label={`Console Errors (${ui.consoleErrors.length})`}>
                    {ui.consoleErrors.map((e, i) => (
                      <div className="tech-row" key={i}><code>{e}</code></div>
                    ))}
                  </TechDetails>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ACCESSIBILITY ── */}
        {tab === 'accessibility' && (
          <A11yTab accessibility={accessibility} extraIssues={uiDerivedA11yIssues} onViewScreenshot={setLightbox} />
        )}

        {/* ── API TESTS ── */}
        {tab === 'api' && (
          <div className="fade-in">
            {!apiResults ? (
              <div className="not-run-msg">
                <span className="not-run-icon">🔌</span>
                <p>API Testing was not run — no API configuration was provided for this session.</p>
                <p className="not-run-hint">
                  To run API tests, enable the API Testing module when starting a new test.
                </p>
              </div>
            ) : (
              <>
                <div className="ui-stats-row">
                  <span className="badge badge-success">Passed: {apiResults.passed ?? 0}</span>
                  <span className="badge badge-danger">Failed: {apiResults.failed ?? 0}</span>
                  {apiResults.duration != null && (
                    <span className="badge badge-info">Duration: {apiResults.duration}ms</span>
                  )}
                </div>
                <div className="api-table-wrap card">
                  <table className="api-table" role="table" aria-label="API test results">
                    <thead>
                      <tr>
                        <th>Endpoint</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(apiResults.tests || []).map((t, i) => (
                        <tr key={i} className={t.passed ? '' : 'api-row-fail'}>
                          <td className="api-name">{t.name}</td>
                          <td>
                            {t.status != null
                              ? <span className={`badge ${t.status < 400 ? 'badge-success' : 'badge-danger'}`}>{t.status}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-muted api-dur">
                            {t.duration != null ? `${t.duration}ms` : '—'}
                          </td>
                          <td>
                            <span className={t.passed ? 'text-success' : 'text-danger'}>
                              {t.passed ? '✓ Pass' : '✗ Fail'}
                            </span>
                            {!t.passed && t.error && (
                              <span className="api-error text-muted"> — {t.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI ANALYSIS ── */}
        {tab === 'ai' && (
          <div className="fade-in">
            {!aiAnalysis ? (
              <div className="not-run-msg">
                <span className="not-run-icon">🤖</span>
                <p>AI analysis is not available for this session.</p>
              </div>
            ) : (
              <div className="ai-panel-new">
                {/* Header */}
                <div className="ai-panel-header">
                  <div className="ai-panel-title-row">
                    <span className="ai-big-icon" aria-hidden="true">🤖</span>
                    <div>
                      <h2 className="ai-panel-title">AI Test Analysis</h2>
                      <p className="ai-panel-model">
                        Powered by {aiAnalysis.model || 'AI'} · Analysis is advisory
                      </p>
                    </div>
                  </div>
                </div>

                {/* Overall Summary */}
                {aiAnalysis.summary && (
                  <div className="ai-summary-block">
                    <div className="ai-block-label">Overall Summary</div>
                    <p className="ai-summary-text">{aiAnalysis.summary}</p>
                  </div>
                )}

                {/* Priority Issues */}
                {aiAnalysis.failures?.length > 0 && (
                  <div className="ai-failures-block">
                    <div className="ai-block-label">Priority Issues</div>
                    {aiAnalysis.failures.map((f, i) => {
                      const priority = i === 0 ? 'high' : i === 1 ? 'high' : 'medium';
                      return (
                        <div className={`ai-failure-card priority-${priority}`} key={i}>
                          <div className="ai-failure-header">
                            <span className={`priority-dot dot-${priority}`} aria-hidden="true" />
                            <span className="ai-failure-name">{f.test}</span>
                            <span className={`badge ${priority === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                              {priority === 'high' ? '🔴 High' : '🟡 Medium'}
                            </span>
                          </div>
                          <p className="ai-failure-explanation">{f.explanation}</p>
                          {f.possibleCauses?.length > 0 && (
                            <div className="ai-causes">
                              <span className="ai-causes-lbl">Possible causes:</span>
                              <ul>
                                {f.possibleCauses.map((c, j) => <li key={j}>{c}</li>)}
                              </ul>
                            </div>
                          )}
                          {f.suggestion && (
                            <div className="ai-suggestion">
                              <span className="ai-sug-icon">💡</span>
                              <span>{f.suggestion}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recommendations */}
                {aiAnalysis.recommendations?.length > 0 && (
                  <div className="ai-recs-block">
                    <div className="ai-block-label">Recommendations</div>
                    <ol className="ai-recs-list">
                      {aiAnalysis.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SCREENSHOTS ── */}
        {tab === 'screenshots' && (
          <div className="fade-in">
            {allScreenshots.length === 0 ? (
              <div className="not-run-msg">
                <span className="not-run-icon">📷</span>
                <p>No screenshots were captured for this session.</p>
                <p className="not-run-hint">
                  Screenshots are captured automatically during UI and accessibility testing.
                </p>
              </div>
            ) : (
              <>
                <div className="section-label" style={{ marginBottom: '1rem' }}>
                  {allScreenshots.length} screenshot{allScreenshots.length !== 1 ? 's' : ''} captured
                </div>
                <div className="ss-grid">
                  {allScreenshots.map((ss, i) => {
                    const src = `data:${ss.mime || 'image/png'};base64,${ss.data}`;
                    const statusCls =
                      ss.status === 'passed'       ? 'ss-status-pass' :
                      ss.status === 'failed'        ? 'ss-status-fail' :
                      ss.status === 'accessibility' ? 'ss-status-a11y' : 'ss-status-info';
                    const statusLabel =
                      ss.status === 'passed'       ? '✓ Passed' :
                      ss.status === 'failed'        ? '✗ Failed' :
                      ss.status === 'accessibility' ? '♿ Accessibility' : 'ℹ Info';
                    return (
                      <div className="ss-card" key={i}>
                        <button
                          className="ss-thumb-btn"
                          onClick={() => setLightbox(ss)}
                          aria-label={`View screenshot: ${ss.label || ss.name}`}
                        >
                          <img
                            className="ss-thumb"
                            src={src}
                            alt={ss.label || ss.name}
                            loading="lazy"
                          />
                          <span className="ss-thumb-overlay">🔍 View</span>
                        </button>
                        <div className="ss-meta">
                          <div className={`ss-status-badge ${statusCls}`}>{statusLabel}</div>
                          <p className="ss-label">{ss.label || ss.name}</p>
                          {ss.pageUrl && (
                            <p className="ss-url text-muted" title={ss.pageUrl}>
                              {ss.pageUrl.replace(/^https?:\/\//, '').slice(0, 50)}
                              {ss.pageUrl.replace(/^https?:\/\//, '').length > 50 ? '…' : ''}
                            </p>
                          )}
                          {ss.timestamp && (
                            <p className="ss-time text-muted">
                              {new Date(ss.timestamp).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── LIGHTBOX MODAL ── */}
      {lightbox && (
        <div
          className="lb-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot full view"
          onClick={() => setLightbox(null)}
        >
          <div className="lb-box" onClick={(e) => e.stopPropagation()}>
            <div className="lb-header">
              <div className="lb-header-info">
                <span className="lb-title">{lightbox.label || lightbox.name}</span>
                {lightbox.pageUrl && (
                  <span className="lb-url text-muted">{lightbox.pageUrl}</span>
                )}
                {lightbox.timestamp && (
                  <span className="lb-time text-muted">
                    Captured: {new Date(lightbox.timestamp).toLocaleString()}
                  </span>
                )}
                {lightbox.status && (
                  <span className={`badge ${
                    lightbox.status === 'passed'       ? 'badge-success' :
                    lightbox.status === 'failed'        ? 'badge-danger'  :
                    lightbox.status === 'accessibility' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {lightbox.status}
                  </span>
                )}
              </div>
              <div className="lb-actions">
                <a
                  href={`data:${lightbox.mime || 'image/png'};base64,${lightbox.data}`}
                  download={`${lightbox.name || 'screenshot'}.png`}
                  className="btn-ghost-sm"
                >
                  ↓ Download
                </a>
                <button
                  className="lb-close"
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="lb-img-wrap">
              <img
                className="lb-img"
                src={`data:${lightbox.mime || 'image/png'};base64,${lightbox.data}`}
                alt={lightbox.label || lightbox.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
