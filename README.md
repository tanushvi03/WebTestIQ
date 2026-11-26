# ⚡ WebTestIQ — AI-Powered Web Quality & Accessibility Testing Platform

> B.E. Computer Science Engineering — Semester Project  
> Automation Testing · React · Node.js · Playwright · axe-core · Newman · OpenAI/Gemini

---

## What is WebTestIQ?

WebTestIQ is a self-developed, full-stack automation testing platform.  
A user enters any website URL and the platform automatically runs **UI**, **accessibility**, and **API** tests, then uses AI to explain every failure in plain language.

The project demonstrates **two levels of automation testing**:

| Level | What is tested | Tools used |
|-------|---------------|------------|
| 1 | External target websites | Playwright · axe-core · Newman |
| 2 | This platform itself | Playwright E2E suite · Newman API collection |

---

## Project Structure

```
Software testing project/
├── frontend/               React 18 app (port 3000)
│   └── src/
│       ├── pages/          LandingPage · LoginPage · DashboardPage
│       │                   TestingPage · ResultsPage · ReportsPage · HistoryPage
│       ├── components/     Layout (sidebar)
│       ├── hooks/          useAuth.js
│       └── services/       api.js (axios)
│
├── backend/                Node/Express API (port 5001)
│   └── src/
│       ├── routes/         test · results · reports · history
│       ├── services/       testOrchestrator · uiTester · accessibilityTester
│       │                   apiTester · aiAnalyzer
│       └── utils/          logger · validateUrl · storage
│
└── tests/
    ├── playwright/         Level 2 — E2E test suite for our own platform
    │   └── specs/          01-landing · 02-login · 03-dashboard · 04-url-input
    │                       05-testing-workflow · 06-results · 07-ai · 08-reports · 09-history
    └── newman/             Level 2 — API test collection for our own backend
        └── webtestiq-api-collection.json   (31 assertions across 14 requests)
```

---

## Quick Start

### 1. Install dependencies

```bash
# From the project root
npm run install:all
```

Or individually:
```bash
cd frontend  && npm install --legacy-peer-deps
cd backend   && npm install
cd tests/playwright && npm install
cd tests/newman     && npm install
```

### 2. Install Playwright browser (Chromium)

```bash
cd backend
npx playwright install chromium
```

### 3. Configure AI (optional)

Copy `backend/.env.example` to `backend/.env` and fill in your key:

```env
# Use OpenAI GPT-4o-mini
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# OR use Google Gemini 1.5 Flash
AI_PROVIDER=gemini
GEMINI_API_KEY=...

# OR use the built-in offline rule-based analysis (no key needed)
AI_PROVIDER=none
```

### 4. Start the backend

```bash
cd backend
npm start        # production
npm run dev      # development (nodemon auto-reload)
```

Backend runs on **http://localhost:5001**

### 5. Start the frontend

```bash
cd frontend
npm start
```

Frontend runs on **http://localhost:3000**

### 6. Open the app

Navigate to **http://localhost:3000**

Demo login: `admin` / `admin123`

---

## Running Tests

### Level 2A — API Tests (Newman)

```bash
# Requires backend running on port 5001
npm run test:api
# or
node tests/newman/run-api-tests.js
```

Results are saved to `tests/newman/results/`.

```
14 requests · 31 assertions · all pass ✅
```

### Level 2B — E2E Tests (Playwright)

```bash
# Requires both backend (5001) AND frontend (3000) running
npm run test:e2e

# Run with browser window visible
npm run test:e2e:headed

# View HTML report after run
cd tests/playwright && npx playwright show-report
```

Test specs:

| File | What it covers |
|------|---------------|
| 01-landing.spec.js | Landing page, hero, feature cards, CTAs |
| 02-login.spec.js | Login validation, valid/invalid credentials, logout, auth guard |
| 03-dashboard.spec.js | Stat cards, sidebar nav, tip cards |
| 04-url-input.spec.js | URL validation, module checkboxes, disclaimer |
| 05-testing-workflow.spec.js | Full test run, stage progression, "View Results" |
| 06-results-dashboard.spec.js | Score banner, tabs, issues list |
| 07-ai-analysis.spec.js | AI Analysis tab, summary, recommendations |
| 08-reports.spec.js | Reports listing, navigation |
| 09-history.spec.js | History table, filters, row navigation |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/test/start` | Start a new test session |
| `GET`  | `/api/test/status/:sessionId` | Poll test progress |
| `GET`  | `/api/results/:sessionId` | Fetch full test results |
| `GET`  | `/api/reports` | List all saved reports |
| `GET`  | `/api/reports/:sessionId` | Get one report |
| `GET`  | `/api/history` | List all test history entries |

### POST /api/test/start — Request body

```json
{
  "url": "https://example.com",
  "options": {
    "runUi":            true,
    "runAccessibility": true,
    "runApi":           false
  }
}
```

### POST /api/test/start — Response (202 Accepted)

```json
{ "sessionId": "uuid-v4" }
```

---

## Complete Testing Workflow Demonstrated

```
BUILD PLATFORM
      ↓
INTEGRATE TOOLS  (Playwright · axe-core · Newman)
      ↓
    ┌─────────────────────┬─────────────────────┐
    ↓                     ↓
TEST OTHER WEBSITES   TEST OUR OWN PLATFORM
(Level 1)             (Level 2)
Playwright            Playwright E2E suite
axe-core              Newman API collection
Newman
    ↓                     ↓
    └─────────────────────┘
                 ↓
           TEST RESULTS
                 ↓
           AI ANALYSIS
                 ↓
       DASHBOARD + JSON REPORT
                 ↓
         BUG FIX → RETEST
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Recharts, Axios |
| Backend | Node.js 18+, Express 4 |
| UI Automation | Playwright (Chromium headless) |
| Accessibility | axe-core + @axe-core/playwright |
| API Testing | Newman (Postman collections) |
| AI Analysis | OpenAI GPT-4o-mini / Google Gemini 1.5 Flash / Offline fallback |
| Storage | JSON files (backend/results/) |
| Logging | Winston |

---

## Important Notes

- The platform runs **predefined, general-purpose tests**. A URL alone cannot encode every business rule of an arbitrary website.
- For advanced scenarios, provide custom Playwright scripts, Postman collections, or test configuration.
- AI output is **advisory** — treat suggestions as starting points, not guaranteed root causes.
- Screenshots are captured on UI test failures and included in the JSON result.

---

*WebTestIQ — B.E. CSE Semester Project*
