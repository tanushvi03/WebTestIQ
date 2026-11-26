import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const FEATURES = [
  { icon: '🖥️', title: 'UI Automation',        desc: 'Playwright-powered browser tests for navigation, forms, clicks, and visual checks.' },
  { icon: '♿', title: 'Accessibility',          desc: 'axe-core scans every page for WCAG violations, missing labels, and contrast issues.' },
  { icon: '🔌', title: 'API Testing',            desc: 'Newman/Postman collections verify endpoints, status codes, and response payloads.' },
  { icon: '🤖', title: 'AI Analysis',            desc: 'GPT/Gemini reads your failures and returns plain-language summaries and fix suggestions.' },
  { icon: '📊', title: 'Live Dashboard',         desc: 'Real-time progress tracking and consolidated pass/fail metrics in one view.' },
  { icon: '📄', title: 'Detailed Reports',       desc: 'Exportable JSON reports with screenshots, logs, and severity classifications.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Hero ── */}
      <header className="landing-header">
        <div className="landing-logo">
          <span className="logo-badge">⚡</span>
          <span>WebTestIQ</span>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/login')}
        >
          Get Started →
        </button>
      </header>

      <section className="hero">
        <div className="hero-content fade-in">
          <div className="hero-tag badge badge-accent">AI-Powered · Automated · Open</div>
          <h1 className="hero-title">
            Test Any Website.<br />
            <span className="gradient-text">Understand Every Failure.</span>
          </h1>
          <p className="hero-subtitle">
            Enter a URL. Our platform runs UI, accessibility, and API tests automatically,
            then uses AI to explain what went wrong and how to fix it.
          </p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={() => navigate('/login')}>
              Start Testing Free
            </button>
            <button
              className="btn-ghost btn-lg"
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
            >
              See Features
            </button>
          </div>
        </div>

        {/* Decorative terminal mockup */}
        <div className="hero-terminal fade-in" aria-hidden="true">
          <div className="terminal-bar">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
            <span className="terminal-title">WebTestIQ</span>
          </div>
          <div className="terminal-body">
            <p><span className="t-prompt">$</span> Start test → https://example.com</p>
            <p className="t-ok">  ✓ URL validated</p>
            <p className="t-ok">  ✓ Page loaded (1.2 s)</p>
            <p className="t-ok">  ✓ Navigation tested (8 links)</p>
            <p className="t-ok">  ✓ Forms tested (3 forms)</p>
            <p className="t-warn"> ⚠ Accessibility: 4 violations</p>
            <p className="t-ok">  ✓ API endpoints: 12/14 passed</p>
            <p className="t-err"> ✗ API: /api/checkout → 500</p>
            <p className="t-info"> 🤖 AI: Analysing 3 failures…</p>
            <p className="t-ok">  ✓ Report generated</p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="features-section">
        <h2 className="section-title">Everything in one platform</h2>
        <p className="section-sub">No configuration files. No separate tools. Just a URL.</p>
        <div className="features-grid">
          {FEATURES.map(({ icon, title, desc }) => (
            <div className="feature-card card" key={title}>
              <span className="feature-icon" role="img" aria-label={title}>{icon}</span>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <h2>Ready to run your first test?</h2>
        <p>It takes 30 seconds — just enter a URL and click Start.</p>
        <button className="btn-primary btn-lg" onClick={() => navigate('/login')}>
          Launch Platform →
        </button>
      </section>

      <footer className="landing-footer">
        <p>WebTestIQ · AI-Powered Web Quality &amp; Accessibility Testing Platform</p>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
          B.E. Computer Science Engineering — Semester Project
        </p>
      </footer>
    </div>
  );
}
