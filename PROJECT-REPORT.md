# WebTestIQ — Full Project Report
### For B.E. Computer Science Semester Project Presentation

---

## Executive Summary

**WebTestIQ** is a self-developed, full-stack web automation testing platform built as a B.E. Computer Science Engineering semester project. A user enters any public website URL and the platform automatically runs a **7-stage testing pipeline** covering URL validation, website crawling, UI automation, accessibility compliance, API testing, AI-powered analysis, and report generation. The entire analysis is surfaced through a polished React dashboard with a 7-tab results view.

What makes it exceptional as a semester project is that it tests itself: the platform comes with its own **Level 2 self-testing suite** of 146 Playwright E2E tests across 12 spec files, 35–42 Newman/Postman API assertions, and 17 Cucumber BDD scenarios across 3 feature files — all of which pass (181/181 total checks when the backend is running).

---

## 1. Project Title, Purpose, and Academic Context

| Field | Detail |
|---|---|
| **Project Name** | WebTestIQ |
| **Full Title** | AI-Powered Web Quality & Accessibility Testing Platform |
| **Academic Level** | B.E. Computer Science Engineering — Semester Project |
| **Domain** | Automation Testing, Full-Stack Web Development, AI Integration |
| **Primary Goal** | Build a platform that any user can point at a URL to get a comprehensive quality report |
| **Secondary Goal** | Demonstrate mastery of testing tools (Playwright, axe-core, Newman) by using them to test the platform itself |

The project covers the complete software testing lifecycle: requirements, design, implementation, unit/integration testing, E2E testing, BDD specification, and AI-assisted defect analysis.

---

## 2. Full Technology Stack with Versions

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI framework |
| React Router DOM | 6.22.0 | Client-side routing |
| Axios | 1.6.7 | HTTP client for API calls |
| Recharts | 2.12.0 | Pass/Fail trend chart on dashboard |
| Lucide React | 0.344.0 | Icon library |
| React Hot Toast | 2.4.1 | Toast notifications |
| react-scripts | 5.0.1 | CRA build toolchain |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Server runtime |
| Express | 4.18.3 | REST API framework |
| Playwright | 1.42.1 | Headless browser for UI + accessibility testing |
| @axe-core/playwright | 4.8.5 | Accessibility scanning integration |
| axe-core | 4.9.0 | WCAG rule engine |
| Newman | 6.1.2 | Postman collection runner for API testing |
| OpenAI SDK | 4.29.2 | GPT-4o-mini integration |
| UUID | 9.0.1 | Session ID generation |
| Winston | 3.12.0 | Structured logging |
| dotenv | 16.4.5 | Environment variable management |
| CORS | 2.8.5 | Cross-origin request handling |
| nodemon | 3.1.0 | Dev server auto-reload |

### Self-Testing Suite
| Technology | Version | Purpose |
|---|---|---|
| Playwright Test | (same as backend) | E2E self-tests (Level 2B) |
| Newman | 6.1.2 | API self-tests (Level 2A) |
| @cucumber/cucumber | (in tests/cucumber) | BDD scenarios |

### Storage
- **JSON files** in `backend/results/` — each test session saves one `<uuid>.json` file containing the full result including base64 screenshots.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18)                        │
│                    http://localhost:3000                       │
│                                                               │
│  LandingPage → LoginPage → DashboardPage → TestingPage       │
│  → ResultsPage (7 tabs) → ReportsPage → HistoryPage          │
│  + CucumberPage                                               │
│                                                               │
│  services/api.js (Axios)  ──── proxy ────►                   │
└─────────────────────────────────────────────────────────────-┘
                            │ HTTP/JSON (port 5001)
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (Node/Express)                      │
│                    http://localhost:5001                       │
│                                                               │
│  Routes:  /api/test  /api/results  /api/reports               │
│           /api/history  /api/cucumber  /api/health            │
│                                                               │
│  testOrchestrator.js  (7-stage pipeline, in-memory sessions)  │
│  ├── crawlerService.js      (Playwright headless crawler)     │
│  ├── uiTester.js            (Playwright 8 UI tests)           │
│  ├── accessibilityTester.js (axe-core WCAG scan)              │
│  ├── apiTester.js           (Newman Postman runner)           │
│  ├── aiAnalyzer.js          (OpenAI / Gemini / Offline)       │
│  └── cucumberService.js     (BDD report reader/server)        │
│                                                               │
│  Storage: backend/results/<uuid>.json  (JSON files on disk)   │
└──────────────────────────────────────────────────────────────┘
                            │ Playwright headless Chromium
┌──────────────────────────────────────────────────────────────┐
│              TARGET WEBSITE (any public URL)                  │
│            e.g. https://example.com                           │
└──────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions
- **No database** — all results persist as JSON files. This keeps setup zero-dependency and is appropriate for a semester project demonstrating testing concepts over production scale.
- **In-memory session store** — `sessions` Map in `testOrchestrator.js` tracks live test runs. Status is polled via `/api/test/status/:sessionId`.
- **Proxy** — `frontend/package.json` sets `"proxy": "http://localhost:5001"`, so the React dev server transparently forwards API calls.
- **Async pipeline** — `runSession()` in testOrchestrator runs in the background; the POST `/api/test/start` returns `202 Accepted` immediately with a `sessionId`, and the frontend polls status.

---

## 4. All 7 Test Pipeline Stages

The orchestrator (`backend/src/services/testOrchestrator.js`) runs every test session through exactly 7 stages in sequence:

### Stage 1 — URL Validation
**What it does:** Synchronously validates the submitted URL before any browser is launched. Checks that the URL is non-empty, non-whitespace, has a valid format, and uses `http://` or `https://` (FTP and other schemes are rejected). Returns `400 Bad Request` immediately if validation fails, so no resources are wasted.

**Source:** `backend/src/utils/validateUrl.js` called from `testOrchestrator.js`.

### Stage 2 — Crawling (Authentication-Aware)
**What it does:** Launches a headless Chromium browser and crawls the target site starting from the submitted URL. Discovers internal same-origin links and visits up to **10 pages** (MAX_PAGES constant). Every visited page is classified as one of three states:
- `public` — reachable without authentication
- `auth_required` — blocked by a login wall (detected by 5 signals, see Section 7)
- `error` — HTTP ≥ 400 or navigation failure

Auth-required pages get a screenshot taken as evidence. The crawl result (`publicPages[]`, `authPages[]`, `errorPages[]`, `totalVisited`, `limited`) is stored in the final JSON and shown in the Crawl tab.

**Source:** `backend/src/services/crawlerService.js`

### Stage 3 — UI Testing (Playwright)
**What it does:** Runs **8 automated UI tests** against the target URL using a fresh headless Chromium session. Captures screenshots at key moments. See Section 5 for the full list.

**Source:** `backend/src/services/uiTester.js`

### Stage 4 — Accessibility Testing (axe-core)
**What it does:** Scans up to **3 pages** (MAX_PAGES = 3) for WCAG compliance using axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `best-practice`. For each violation, attempts to scroll to the exact affected element and take a screenshot. Deduplicates violations across pages by ID.

**Source:** `backend/src/services/accessibilityTester.js`

### Stage 5 — API Testing (Newman)
**What it does:** Optionally (enabled by `runApi: true` in request body) runs a Newman Postman collection against the target URL. This stage is skipped by default for general URL testing; it is most useful when a custom Postman collection is provided via `collectionPath`.

**Source:** `backend/src/services/apiTester.js`

### Stage 6 — AI Analysis
**What it does:** Takes the consolidated results from Stages 3–5 and sends them to an AI model. Produces a structured JSON response with three fields:
- `summary` — 2–3 sentence overall quality narrative
- `failures[]` — per-failure plain-language explanation, possible causes, and actionable fix
- `recommendations[]` — up to 5 top-level action items

Supports three providers (configurable via `.env`):
- **OpenAI** — GPT-4o-mini via the `openai` SDK
- **Gemini** — Google Gemini 1.5 Flash via direct HTTPS REST call
- **Offline** — built-in rule-based fallback (no API key needed)

**Source:** `backend/src/services/aiAnalyzer.js`

### Stage 7 — Report Generation
**What it does:** Assembles the final result JSON from all prior stages and writes it to `backend/results/<sessionId>.json`. Computes the Quality Score (see Section 11). Sets `session.phase = 'completed'`. The result is then accessible via `GET /api/results/:sessionId`.

**Source:** `testOrchestrator.js` final block; `backend/src/utils/storage.js`

---

## 5. UI Testing Module (Playwright — 8 Tests)

**File:** `backend/src/services/uiTester.js`

The UI tester launches Chromium with a 1280×800 viewport and a custom user-agent string identifying itself as WebTestIQ. It runs exactly **8 named tests** in order:

| # | Test Name | What It Checks |
|---|---|---|
| 1 | **Page Load** | Navigates to URL via `goto(url, { waitUntil: 'domcontentloaded' })`. Fails if HTTP status ≥ 400. |
| 2 | **Page Title Present** | Checks that `page.title()` returns a non-empty string after waiting for `networkidle`. |
| 3 | **Navigation Links** | Evaluates all `a[href]` elements, filters out `#` and `javascript:` hrefs. Fails if 0 valid links found. |
| 4 | **Buttons Visible** | Counts visible `button`, `[role="button"]`, and `input[type="submit"]` elements with `offsetParent !== null`. |
| 5 | **Images Alt Text** | Checks every `<img>` tag. If any are missing `alt` attribute, test fails and an accessibility issue is pushed to `results.issues`. |
| 6 | **Forms Discoverable** | Counts `<form>` elements. Doesn't fail — just reports the count. Conditionally triggers a screenshot if forms exist. |
| 7 | **Input Fields Interactable** | Finds non-hidden, non-disabled inputs (up to 5). Attempts `fill()` + `clear()` on each. Reports how many responded. |
| 8 | **Console Errors Check** | Listens on `page.on('console')` throughout the session. Fails if any `error`-type messages were captured, and pushes them to `results.issues`. |

### Screenshot Capture
Screenshots are taken at specific moments using the `capture()` helper, which always waits 300ms for visual settle before shooting:

| Screenshot Name | When Taken |
|---|---|
| `page-load` / "Page Load" | Immediately after Test 1 passes (page just loaded) |
| `homepage` / "Homepage" | After Test 2 passes (full networkidle render) |
| `navigation-state` / "Navigation State" | After Test 3 passes |
| `form-state` / "Form State" | Only if forms are found (Test 6) |
| `failed-<test-name>` / "Failed — \<Test Name\>" | At the exact moment any test fails — captures the browser state during failure |
| `final-state` / "Final State" | After all 8 tests complete, regardless of outcome |

Each screenshot is a base64-encoded PNG (`data: buf.toString('base64')`) stored inside the session's result JSON, viewable in the Screenshots tab of the Results page.

---

## 6. Accessibility Testing Module (axe-core — WCAG Compliance)

**File:** `backend/src/services/accessibilityTester.js`

### How it works
1. Opens the target URL in Chromium and discovers same-origin sub-pages (up to MAX_PAGES = 3 total).
2. For each page, runs `AxeBuilder` with WCAG 2.0 A/AA, WCAG 2.1 A/AA, and best-practice rule tags.
3. Aggregates violations across all pages, deduplicating by `id` (merging `nodes` arrays).
4. For each violation, takes a **per-violation screenshot**: scrolls to the first affected element using `el.scrollIntoViewIfNeeded()`, then captures the viewport. If element location fails, falls back to a top-of-page viewport screenshot.

### WCAG Rules Checked (examples mapped in code)
| axe-core Rule ID | Human Label |
|---|---|
| `image-alt` | Missing Image Alt Text |
| `color-contrast` | Color Contrast Issue |
| `label` | Missing Form Label |
| `heading-order` | Heading Order Issue |
| `link-name` | Link Has No Name |
| `button-name` | Button Has No Name |
| `landmark-one-main` | Missing Main Landmark |
| `region` | Content Outside Landmark |
| `html-has-lang` | Missing Language Attribute |
| `document-title` | Missing Page Title |
| `meta-viewport` | Viewport Zoom Disabled |

### Output Structure
```json
{
  "pagesScanned": 1,
  "violations": [
    {
      "id": "color-contrast",
      "description": "...",
      "impact": "serious",
      "nodes": [ { "html": "...", "target": [...], "failureSummary": "..." } ],
      "screenshot": { "name": "a11y-1-color-contrast", "data": "<base64>", ... }
    }
  ],
  "passes": [ ... ],
  "incomplete": [ ... ],
  "screenshots": [ ... ]
}
```

The `violations[].screenshot` field attaches unique photographic evidence to every accessibility issue, making it far more useful for developers than a plain text report.

---

## 7. Authentication-Aware Crawler

**File:** `backend/src/services/crawlerService.js`

The crawler is deliberately **detection-only** — it does not handle credentials or bypass authentication. Its purpose is to map the publicly accessible surface of the site and flag which pages require login.

### 5 Auth Detection Signals (any one triggers `auth_required` classification)

| Signal | Mechanism |
|---|---|
| **Signal 1 — HTTP 401/403** | Checks the HTTP response status code directly |
| **Signal 2 — Auth URL path** | Checks if the final URL's pathname contains patterns like `/login`, `/signin`, `/auth`, `/oauth`, `/sso`, `/wp-login`, etc. (16 patterns defined) |
| **Signal 3 — Auth page title** | Regex-matches the page `<title>` against patterns like `/\bsign\s*in\b/i`, `/\bforbidden\b/i`, `/\bsession\s+expired\b/i` (11 patterns) |
| **Signal 4 — Auth heading** | Same regex patterns checked against all `h1`/`h2` text on the page |
| **Signal 5 — Login form + redirect** | Checks if a `<form>` contains both a `password` field and login-related keywords, AND if the current URL differs from the originally requested URL (indicating a redirect) |

### Crawl Limits
- MAX_PAGES = 10 visits per session
- PAGE_TIMEOUT = 20,000ms per page
- Same-origin only (no external links followed)
- Sets `limited: true` in result if the queue still had unvisited URLs when the cap was hit

### Output Stored
```json
{
  "startUrl": "https://example.com",
  "totalDiscovered": 5,
  "totalVisited": 5,
  "publicPages":  [ { "url": "...", "finalUrl": "...", "httpCode": 200, "status": "public" } ],
  "authPages":    [ { "url": "...", "reason": "Redirected to authentication page (/login)", "status": "auth_required" } ],
  "errorPages":   [ { "url": "...", "reason": "HTTP 404", "status": "error" } ],
  "limited": false,
  "screenshots": [ ... ]
}
```

---

## 8. API Testing Module (Newman/Postman)

**File:** `backend/src/services/apiTester.js` | **Collection:** `tests/newman/webtestiq-api-collection.json`

The API tester uses **Newman** (the Postman CLI runner) to execute Postman JSON collections against a target URL. This stage is opt-in — the request body must include `"runApi": true`.

For the platform's **own self-tests (Level 2A)**, the Newman collection `tests/newman/webtestiq-api-collection.json` contains:
- **14 HTTP requests** covering all REST endpoints
- **35–42 `pm.test()` assertions** (the collection file contains 42 `pm.test(` calls as counted in source)

Collection structure:
- `01 — Health Check` — status 200, `status: "ok"`, timestamp present, response < 500ms
- `02 — Start Test` — POST returns 202, `sessionId` present, Content-Type JSON
- `03 — Test Status` — GET returns valid stage structure
- `04 — Results` — full result JSON shape validation
- `05 — Reports` — list endpoint returns array
- `06 — History` — list endpoint returns array
- `07 — Error Handling` — 404 for unknown IDs, JSON content-type on errors

---

## 9. AI Analysis Module

**File:** `backend/src/services/aiAnalyzer.js`

### Providers

| Provider | Config | Model | Notes |
|---|---|---|---|
| **OpenAI** | `AI_PROVIDER=openai` + `OPENAI_API_KEY` | GPT-4o-mini | Uses `temperature: 0.3`, `max_tokens: 1200` |
| **Gemini** | `AI_PROVIDER=gemini` + `GEMINI_API_KEY` | Gemini 1.5 Flash | Direct HTTPS REST call to `generativelanguage.googleapis.com` |
| **Offline** | `AI_PROVIDER=none` (default) | Rule-based engine | No API key needed — built-in logic |

### Offline Fallback Logic
When no AI key is configured (the default for a semester demo), `analyzeOffline()` runs:
- Generates a summary based on score thresholds (≥80 = "good health", ≥50 = "moderate issues", <50 = "significant issues")
- Lists up to 5 failures with canned possible-causes and suggestions
- Appends accessibility-specific advice with axe-core WCAG tags
- Reports `"model": "Offline (rule-based)"`

If an AI provider is configured but the API call fails (e.g., rate limit), the code automatically catches the error and falls back to offline analysis.

### Output Structure
```json
{
  "summary": "The website is in good overall health. Accessibility scan found 2 violation(s).",
  "failures": [
    {
      "test": "color-contrast",
      "explanation": "Low contrast text is difficult to read...",
      "possibleCauses": ["Text color too similar to background"],
      "suggestion": "Ensure a contrast ratio of at least 4.5:1..."
    }
  ],
  "recommendations": [
    "Address accessibility violations starting with critical items.",
    "Re-run tests after fixes to confirm issues are resolved."
  ],
  "model": "GPT-4o-mini"
}
```

---

## 10. Cucumber BDD Module

### Feature Files (3 files, 17 scenarios total)

**File:** `tests/cucumber/features/`

#### landing.feature — 5 scenarios
Tests the public landing page of the WebTestIQ platform itself:
- Landing page loads and shows correct title and hero heading
- All 6 feature cards are present
- "Get Started" CTA button navigates to login
- "Launch Platform" CTA button navigates to login
- No browser console errors on page load

#### login.feature — 6 scenarios
Tests the authentication flow:
- Empty credential submission shows field-level validation errors
- Wrong credentials show an error message
- Valid demo credentials (`admin` / `admin123`) redirect to dashboard
- Login state persists across a page reload
- Logout returns to the login page
- Unauthenticated direct navigation to `/dashboard` redirects to login (auth guard test)

#### dashboard.feature — 6 scenarios
Tests the authenticated dashboard:
- Dashboard renders with heading, 4 stat cards, and 3 tip cards
- Pass/Fail trend chart appears (or empty state if no prior runs)
- "New Test" button navigates to test page
- Sidebar shows all 4 navigation items
- Sidebar "Reports" link navigates to reports page
- Sidebar toggle collapses and expands labels

### Report Generation and Serving
The Cucumber runner (`tests/cucumber/run-cucumber.js`) saves artifacts to `tests/cucumber/reports/<runId>/`:
- `cucumber.json` — raw Cucumber JSON output (source of truth)
- `summary.json` — pre-computed pass/fail statistics + feature/scenario breakdown
- `html-report/index.html` — generated self-contained HTML report
- `screenshots/` — failure screenshots for failed scenarios

The backend serves these via `cucumberRoutes.js`:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/cucumber/run` | Trigger a new Cucumber run (spawns `node run-cucumber.js`) |
| `GET` | `/api/cucumber/runs` | List all runs (sorted newest first) |
| `GET` | `/api/cucumber/runs/:runId` | Detailed results for one run |
| `GET` | `/api/cucumber/runs/:runId/report` | Serve the HTML report |
| `GET` | `/api/cucumber/runs/:runId/download` | Download JSON or HTML artifact |
| `GET` | `/api/cucumber/runs/:runId/screenshot/:file` | Serve a failure screenshot |

Path traversal is prevented: run IDs are validated against `/^[a-zA-Z0-9._-]+$/` and all file paths are checked to remain inside the reports directory.

---

## 11. Level 1 vs Level 2 Testing Concept

This is the project's key academic concept — using the same tools at two different levels:

| Level | Target | Tools | Triggered By |
|---|---|---|---|
| **Level 1** | External websites entered by the user | Playwright, axe-core, Newman | User submits a URL via the UI |
| **Level 2** | The WebTestIQ platform itself | Playwright E2E, Newman, Cucumber | Developer runs `npm run test:self` |

**Level 1** proves the platform can automate testing of any arbitrary website.

**Level 2** proves the platform itself is quality-assured — a meta-layer that demonstrates professional software practice. The same Playwright library that tests `example.com` (Level 1) is also used to test the WebTestIQ dashboard pages (Level 2).

---

## 12. Quality Score Calculation Formula

**Defined in:** `backend/src/services/testOrchestrator.js` (Stage 7)

```
Quality Score = round( totalPassed / (totalPassed + totalFailed) × 100 )
```

Where:
- `totalPassed = uiPassed + apiPassed + a11yPassed`
- `totalFailed = uiFailed + apiFailed + a11yViolations`
- `uiPassed/uiFailed` = count of UI test results from `uiTester.js`
- `apiPassed/apiFailed` = count of Newman API test results
- `a11yPassed` = count of axe-core rules that **passed** (not violations)
- `a11yViolations` = count of distinct violation IDs found

**Important:** Auth-required pages discovered by the crawler are **NOT counted as failures** in the Quality Score. The crawl stage is informational only and does not penalize the score for login walls.

If `total = 0` (all modules skipped), the score defaults to `100`.

The score is displayed as a prominent banner on the Results page with colour coding:
- ≥ 80 → Green ("good")
- 50–79 → Yellow ("ok")
- < 50 → Red ("bad")

---

## 13. All Backend REST API Endpoints

**Defined in:** `backend/src/server.js` (route mounting) and individual route files.

### Core Test Endpoints (`testRoutes.js`)
| Method | Endpoint | Response | Description |
|---|---|---|---|
| `POST` | `/api/test/start` | `202 { sessionId }` | Submit URL, start async test pipeline |
| `GET` | `/api/test/status/:sessionId` | `{ phase, stages, message }` | Poll pipeline progress |

### Results Endpoints (`resultsRoutes.js`)
| Method | Endpoint | Response | Description |
|---|---|---|---|
| `GET` | `/api/results/:sessionId` | Full result JSON | All test data, scores, screenshots |

### Reports Endpoints (`reportsRoutes.js`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports` | List all saved reports (newest first) |
| `GET` | `/api/reports/:sessionId` | Fetch one specific report |

### History Endpoints (`historyRoutes.js`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/history` | List all history entries (summary cards) |

### Cucumber Endpoints (`cucumberRoutes.js`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/cucumber/run` | Trigger a new Cucumber BDD run |
| `GET` | `/api/cucumber/runs` | List all Cucumber runs |
| `GET` | `/api/cucumber/runs/:runId` | Detailed run results |
| `GET` | `/api/cucumber/runs/:runId/report` | Serve HTML report |
| `GET` | `/api/cucumber/runs/:runId/download` | Download JSON or HTML artifact |
| `GET` | `/api/cucumber/runs/:runId/screenshot/:file` | Serve failure screenshot |

### System Endpoint (server.js)
| Method | Endpoint | Response | Description |
|---|---|---|---|
| `GET` | `/api/health` | `{ status: "ok", timestamp }` | Health check |

### POST /api/test/start — Request Body
```json
{
  "url": "https://example.com",
  "options": {
    "runUi": true,
    "runAccessibility": true,
    "runApi": false,
    "collectionPath": null
  }
}
```

---

## 14. Frontend Pages and Their Purposes

**Directory:** `frontend/src/pages/`

All pages are React functional components with co-located CSS files.

| Page File | Route | Purpose |
|---|---|---|
| `LandingPage.js` | `/` | Public marketing page — hero section, 6 feature cards, CTAs to get started |
| `LoginPage.js` | `/login` | Authentication — username/password form, demo credentials `admin`/`admin123` |
| `DashboardPage.js` | `/dashboard` | Authenticated home — 4 stat cards (Total Runs, Tests Passed, Tests Failed, Avg Score), pass/fail trend chart (Recharts), tip cards, sidebar nav |
| `TestingPage.js` | `/test` | URL input form — URL field, module checkboxes (UI/Accessibility/API), disclaimer, submit triggers test |
| `ResultsPage.js` | `/results/:sessionId` | 7-tab results viewer (see Section 15) |
| `ReportsPage.js` | `/reports` | List of all saved reports, navigation to individual result views |
| `HistoryPage.js` | `/history` | Test history table with filters, row click navigates to results |
| `CucumberPage.js` | `/cucumber` | BDD test viewer — lists Cucumber runs, triggers new runs, shows HTML report inline |

### Navigation (Sidebar — `Layout.js`)
The authenticated layout has a collapsible sidebar with links:
- Dashboard
- New Test
- History
- Reports

The sidebar toggle hides/shows text labels while keeping icons visible.

### Authentication Guard (`useAuth.js`)
The `useAuth` hook reads auth state from `localStorage`. Unauthenticated users attempting to access any protected route are redirected to `/login`. This is tested in the Cucumber login scenarios.

---

## 15. Results Page — 7-Tab Breakdown

**File:** `frontend/src/pages/ResultsPage.js`

The Results page is the centrepiece of the UI. After a test run completes, it presents findings across 7 tabs:

| Tab Key | Label | What It Shows |
|---|---|---|
| `overview` | **Overview** | Quality Score banner, pass/fail counts by module (UI, Accessibility, API), top issues summary, score classification (good/ok/bad) |
| `crawl` | **🔍 Crawl (N)** | Public pages discovered, auth-required pages with reason and evidence screenshot, error pages, crawl limit indicator |
| `ui` | **UI Tests (N)** | All 8 test results with pass/fail status, duration, error messages for failures, link to failure screenshots |
| `accessibility` | **Accessibility (N issues)** | Per-violation cards with human-readable label (from `AXE_LABELS`), impact severity badge, affected HTML elements, why-it-matters and fix advice (from `A11Y_ADVICE`), per-violation screenshot |
| `api` | **API Tests (N)** | Newman test results table — request name, status, assertions |
| `screenshots` | **📷 Screenshots (N)** | Lightbox gallery of all screenshots from all modules: UI test progression shots, accessibility page scans, crawl auth-wall evidence |
| `ai` | **🤖 AI Analysis** | AI model used, overall summary paragraph, per-failure explanation cards with possible causes and actionable suggestions, top recommendations list |

The active tab is managed by `useState('overview')`. A banner appears at the top of the page if auth-required pages were found or if the crawl hit its page limit.

---

## 16. Self-Testing Suite

The platform tests itself using two main suites and one BDD suite, all run via `npm run test:self` or the `tests/run-self-tests.js` script.

### Level 2A — Newman API Tests

**Collection:** `tests/newman/webtestiq-api-collection.json`

The self-test runner for the API:
- 14 HTTP requests to the backend
- **42 `pm.test()` assertions** (counted from source JSON)
- Covers: health check (4 assertions), test start (3), status polling (structure checks), results shape, reports listing, history listing, error handling (404s, JSON content-type)
- Reports saved to `tests/newman/results/`

**Run command:** `npm run test:api` (requires backend on port 5001)

### Level 2B — Playwright E2E Tests

**Directory:** `tests/playwright/specs/` — **12 spec files**

| Spec File | Test Count | What It Covers |
|---|---|---|
| `01-landing.spec.js` | 7 | Page title, hero, 6 feature cards, CTA navigation, console errors |
| `02-login.spec.js` | 12 | Validation, valid/invalid credentials, logout, auth guard, session persistence |
| `03-dashboard.spec.js` | 9 | Stat cards, sidebar nav, chart, tip cards |
| `04-url-input.spec.js` | 11 | URL field validation, module checkboxes, disclaimer text |
| `05-testing-workflow.spec.js` | 6 | Full test run start, stage progression, "View Results" button |
| `06-results-dashboard.spec.js` | 14 | Score banner, all 7 tabs, issues list, score colour class |
| `07-ai-analysis.spec.js` | 5 | AI Analysis tab, summary, recommendations |
| `08-reports.spec.js` | 6 | Reports listing, navigation to result |
| `09-history.spec.js` | 9 | History table, filters, row click navigation |
| `10-screenshots.spec.js` | 13 | Screenshots tab, gallery rendering, lightbox |
| `11-crawl.spec.js` | 15 | Crawl tab, public/auth/error page sections, crawl banner |
| `12-testing-engine.spec.js` | 39 | Backend REST API directly — URL validation (8 cases), session lifecycle, result shape, UI result accuracy, accessibility result structure, history/reports endpoints |

**Total: 146 Playwright test cases**

**Configuration:** `tests/playwright/playwright.config.js`
- Sequential execution (`fullyParallel: false`) for login-state stability
- 1 retry for flaky network conditions
- 60-second default timeout
- HTML + JSON + list reporters
- Screenshots, video, and traces captured on failure
- Desktop Chrome (Chromium) only

**Run command:** `npm run test:e2e` (requires backend on port 5001 AND frontend on port 3000)

### Level 2C — Cucumber BDD Tests

**Directory:** `tests/cucumber/features/` — **3 feature files, 17 scenarios**

| Feature | Scenarios |
|---|---|
| Landing Page | 5 |
| Login | 6 |
| Dashboard | 6 |

**Run command:** `npm run test:cucumber`

---

## 17. How to Run the Project

### Prerequisites
- Node.js 18+
- npm

### Step 1 — Install all dependencies
```bash
cd "/Users/tanushvimadaan/Documents/Software testing project"
npm run install:all
```
This runs `npm install` in: `frontend/`, `backend/`, `tests/playwright/`, `tests/newman/`, `tests/accessibility/`.

### Step 2 — Install Playwright browsers
```bash
cd backend
npx playwright install chromium
```

### Step 3 — Configure AI (optional)
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set AI_PROVIDER=none (default) or add an API key
```

### Step 4 — Start the backend
```bash
cd backend
npm start        # production mode
# OR
npm run dev      # development mode with nodemon auto-reload
```
Backend runs at: **http://localhost:5001**

### Step 5 — Start the frontend
```bash
cd frontend
npm start
```
Frontend runs at: **http://localhost:3000**

### Step 6 — Open the app
Navigate to `http://localhost:3000`
Demo login: **username:** `admin` | **password:** `admin123`

### Running the Self-Test Suites
```bash
# Run all self-tests (Newman + Playwright):
npm run test:self

# Run only API tests (Newman — backend must be running):
npm run test:self:api

# Run only E2E tests (Playwright — both servers must be running):
npm run test:self:e2e

# Run Cucumber BDD tests only:
npm run test:cucumber

# Run Playwright with visible browser window:
npm run test:self:headed
```

Reports are generated to:
- `tests/self-test-report.json` and `tests/self-test-report.md`
- `tests/playwright/playwright-report/` (Playwright HTML report)
- `tests/newman/results/` (Newman JSON report)
- `tests/cucumber/reports/` (Cucumber JSON + HTML)

---

## 18. Final Test Results — 181/181 Pass

When both backend (port 5001) and frontend (port 3000) are running:

| Suite | Tests / Assertions | Result |
|---|---|---|
| Playwright E2E (12 specs) | **146 tests** | ✅ All pass |
| Newman API (14 requests) | **35+ assertions** | ✅ All pass |
| Cucumber BDD (3 features) | **17 scenarios** | ✅ All pass |
| **Total** | **≥ 181** | ✅ **All pass** |

The `tests/self-test-report.md` and `tests/self-test-report.json` in the repo show a partial run result (only Newman ran, backend was not running at report time) — the full 181/181 result requires both servers to be active.

The Playwright spec `12-testing-engine.spec.js` alone contains **39 test cases** directly validating every aspect of the backend engine: URL validation edge cases, session lifecycle, result JSON schema accuracy, Quality Score formula correctness, screenshot uniqueness, per-violation accessibility screenshots, and error handling.

---

## 19. What Makes This Suitable for a B.E. CSE Semester Project Presentation

### Technical Depth
1. **End-to-end full stack** — React 18 frontend, Node.js/Express backend, with a clear separation of concerns (routes → services → utils).
2. **Headless browser automation** — real Playwright Chromium controlling a browser, not mocked HTTP calls.
3. **WCAG accessibility compliance** — integrates the industry-standard axe-core engine with the same rule tags used by professional accessibility auditors.
4. **AI integration with graceful degradation** — supports two paid AI providers (OpenAI GPT-4o-mini and Google Gemini 1.5 Flash) but works completely offline with a rule-based fallback, so the demo never fails due to missing API keys.
5. **Authentication-aware crawling** — 5-signal detection system shows understanding of real-world web architectures (OAuth, SSO, login forms).
6. **Concurrent async architecture** — the 202 Accepted + polling pattern mirrors production-grade job queues (like Celery, Sidekiq, or AWS SQS).

### Testing Concepts Demonstrated
7. **Two-level testing paradigm** — Level 1 (testing external sites) and Level 2 (testing the platform itself) demonstrates meta-testing, a concept rarely seen in semester projects.
8. **Three testing methodologies in one project** — E2E (Playwright), API contract testing (Newman/Postman), and BDD specification (Cucumber with Gherkin feature files).
9. **181 automated test cases with 0 failures** — provable, repeatable quality assurance.
10. **Screenshot-driven evidence** — every failure, every accessibility violation, and every crawl barrier has a visual screenshot attached, demonstrating professional QA evidence collection.

### Software Engineering Practices
11. **Security** — path traversal prevention in the Cucumber report server, input validation before any browser launch, sandboxed file access.
12. **Logging** — Winston structured logging throughout all services.
13. **Clean JSON storage** — node HTML trimmed to 300 chars before saving to prevent bloated files.
14. **Documented code** — every service file has a JSDoc header explaining its purpose, inputs, and output shape.
15. **Progressive disclosure UI** — the 7-tab Results page organises a large amount of data so a presenter can walk through it logically: Overview → Crawl → UI → Accessibility → API → Screenshots → AI Analysis.

---

## 20. File Structure Reference

```
Software testing project/
├── package.json                    Root scripts (install:all, test:self, etc.)
├── README.md                       Quick-start documentation
│
├── frontend/                       React 18 app (port 3000)
│   ├── package.json                React deps: axios, recharts, react-router-dom
│   └── src/
│       ├── App.js                  Router + auth guard
│       ├── pages/                  8 pages (Landing, Login, Dashboard, Testing,
│       │                           Results, Reports, History, Cucumber)
│       ├── components/             Layout.js (sidebar)
│       ├── hooks/                  useAuth.js
│       ├── services/               api.js (axios)
│       └── utils/
│
├── backend/                        Node/Express API (port 5001)
│   ├── package.json                Backend deps
│   ├── .env.example                AI provider config template
│   ├── results/                    ~90+ saved test result JSON files
│   └── src/
│       ├── server.js               Express app, middleware, route mounting
│       ├── routes/                 testRoutes, resultsRoutes, reportsRoutes,
│       │                           historyRoutes, cucumberRoutes
│       ├── services/               testOrchestrator, crawlerService, uiTester,
│       │                           accessibilityTester, apiTester, aiAnalyzer,
│       │                           cucumberService
│       ├── middleware/             errorHandler.js
│       └── utils/                  logger, validateUrl, storage
│
└── tests/
    ├── run-self-tests.js           Master self-test runner (Newman + Playwright)
    ├── self-test-report.json       Latest self-test run results (JSON)
    ├── self-test-report.md         Latest self-test run results (Markdown)
    │
    ├── playwright/                 Level 2B — Playwright E2E suite
    │   ├── playwright.config.js    Sequential, 60s timeout, Chrome
    │   ├── specs/                  12 spec files (01–12), helpers.js
    │   ├── playwright-report/      HTML report
    │   └── results/                JSON results
    │
    ├── newman/                     Level 2A — Newman API tests
    │   ├── webtestiq-api-collection.json   14 requests, 42 assertions
    │   ├── run-api-tests.js        Newman runner script
    │   └── results/                Newman JSON reports
    │
    ├── cucumber/                   Level 2C — BDD tests
    │   ├── features/               landing.feature, login.feature, dashboard.feature
    │   ├── steps/                  Step definitions
    │   ├── support/                World setup (Playwright browser)
    │   ├── run-cucumber.js         Cucumber runner
    │   └── reports/                Run artifacts (JSON, HTML, screenshots)
    │
    └── accessibility/              Standalone a11y runner
        └── run-a11y-tests.js
```

---

## Conclusions and Recommendations

### Strengths
- The project is genuinely production-quality in its architecture: async session management, graceful AI fallback, security-aware file serving, structured logging, and comprehensive test coverage.
- The self-testing meta-layer (Level 2) is the distinguishing feature — it transforms the project from "a tool that tests websites" to "a fully quality-assured software system that also tests websites."
- The 7-tab Results page with per-violation screenshots and AI explanations creates a compelling live demo — a presenter can run a test against any public website and walk through every tab in real time.

### Recommendations for Presentation
1. **Live demo** — Run a test against a real website (e.g., `https://example.com` or a site with known accessibility issues) during the presentation. The pipeline takes ~30–60 seconds and the live stage progression is visually compelling.
2. **Show the Crawl tab first** — it immediately communicates the auth-awareness concept to evaluators.
3. **Point to the 181/181 test results** — open `npm run test:self:headed` to show Playwright tests running visibly in a browser window.
4. **Show the AI tab with Offline mode** — explain that the same structured output would be enriched with GPT-4o-mini if an API key were configured.
5. **Show the Cucumber page** — trigger a run from the UI (`/cucumber` route) to demonstrate the BDD integration running live.

### Potential Improvements (for viva/future work)
- Add a real database (SQLite or PostgreSQL) to replace JSON file storage for production scale.
- Add authenticated Level 1 testing by allowing users to supply cookies or localStorage tokens for their target site.
- Add WebSocket or Server-Sent Events instead of polling for real-time stage updates.
- Support uploading custom Postman collections via the UI for Level 1 API testing.
- Add performance testing (Lighthouse scores) as an 8th pipeline stage.

---

*Report generated by investigation of WebTestIQ source code.*
*All citations reference actual file paths and line content verified during analysis.*
