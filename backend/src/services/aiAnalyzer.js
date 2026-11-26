/**
 * AI Analysis Service
 *
 * Accepts the consolidated test results and returns a structured analysis:
 *  - summary        : plain-language overall quality summary
 *  - failures[]     : per-failure explanation, possible causes, suggestion
 *  - recommendations: top-level action items
 *
 * Supports:
 *  - AI_PROVIDER=openai  → uses OpenAI Chat Completions (GPT-4o-mini by default)
 *  - AI_PROVIDER=gemini  → uses Google Gemini via REST
 *  - AI_PROVIDER=none    → returns a rule-based offline analysis (no API key needed)
 */
const logger = require('../utils/logger');

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(results) {
  const { url, ui, accessibility, api: apiResults } = results;

  const uiFailed       = (ui?.tests    || []).filter((t) => !t.passed);
  const a11yViolations = accessibility?.violations || [];
  const apiFailed      = apiResults?.failures || [];

  const failureBlock = [
    ...uiFailed.map((t) => `[UI]     ${t.name}: ${t.error}`),
    ...a11yViolations.map((v) => `[A11Y]   ${v.id} (${v.impact}): ${v.description}`),
    ...apiFailed.map((f) => `[API]    ${f.name}: ${f.error}`),
  ].join('\n');

  return `You are a senior QA engineer reviewing automated test results for: ${url}

FAILED TESTS:
${failureBlock || 'None'}

UI:  ${ui?.passed ?? 0} passed, ${ui?.failed ?? 0} failed
A11Y: ${a11yViolations.length} violations (${a11yViolations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length} critical/serious)
API:  ${apiResults?.passed ?? 0} passed, ${apiResults?.failed ?? 0} failed

Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "<2-3 sentence overall quality summary>",
  "failures": [
    {
      "test": "<test name>",
      "explanation": "<plain-language explanation>",
      "possibleCauses": ["<cause 1>", "<cause 2>"],
      "suggestion": "<actionable fix>"
    }
  ],
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
}

Only include up to 5 failures. Be concise and practical.`;
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function analyzeWithOpenAI(results) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model:       'gpt-4o-mini',
    messages:    [{ role: 'user', content: buildPrompt(results) }],
    temperature: 0.3,
    max_tokens:  1200,
  });

  const text = response.choices[0]?.message?.content?.trim();
  return { ...JSON.parse(text), model: 'GPT-4o-mini' };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function analyzeWithGemini(results) {
  const https = require('https');

  const prompt   = buildPrompt(results);
  const apiKey   = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
  });

  const text = await new Promise((resolve, reject) => {
    const req = https.request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve(raw));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const parsed = JSON.parse(text);
  const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error('Gemini returned empty response');

  // Strip markdown code fences if present
  const json = content.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  return { ...JSON.parse(json), model: 'Gemini 1.5 Flash' };
}

// ─── Offline rule-based fallback ──────────────────────────────────────────────

function analyzeOffline(results) {
  const { ui, accessibility, api: apiResults } = results;

  const uiFailed       = (ui?.tests    || []).filter((t) => !t.passed);
  const a11yViolations = accessibility?.violations || [];
  const apiFailed      = apiResults?.failures || [];

  const totalPassed = (ui?.passed ?? 0) + (apiResults?.passed ?? 0);
  const totalFailed = uiFailed.length + apiFailed.length;
  const totalTests  = totalPassed + totalFailed;
  const score       = totalTests ? Math.round((totalPassed / totalTests) * 100) : 100;

  const summaryParts = [];
  if (score >= 80) summaryParts.push('The website is in good overall health.');
  else if (score >= 50) summaryParts.push('The website has moderate issues that need attention.');
  else summaryParts.push('The website has significant quality issues requiring immediate attention.');

  if (a11yViolations.length > 0) {
    const serious = a11yViolations.filter((v) => ['critical', 'serious'].includes(v.impact)).length;
    summaryParts.push(
      `Accessibility scan found ${a11yViolations.length} violation(s)${serious ? `, including ${serious} critical/serious` : ''}.`
    );
  }
  if (apiFailed.length > 0) summaryParts.push(`${apiFailed.length} API endpoint(s) returned errors.`);

  const failures = [
    ...uiFailed.slice(0, 3).map((t) => ({
      test:            t.name,
      explanation:     `The automated UI test "${t.name}" failed: ${t.error}`,
      possibleCauses:  [
        'Element selector may have changed',
        'Page may not have fully loaded before interaction',
        'Element might be hidden or disabled',
      ],
      suggestion: 'Check the element\'s visibility and selector. Add an explicit wait before the interaction.',
    })),
    ...a11yViolations.slice(0, 2).map((v) => ({
      test:            `Accessibility: ${v.id}`,
      explanation:     v.description,
      possibleCauses:  [`WCAG tags: ${(v.tags || []).filter((t) => t.startsWith('wcag')).join(', ') || 'see axe-core docs'}`],
      suggestion:      `Review affected elements and apply fixes. See: ${v.helpUrl || 'https://dequeuniversity.com/rules/axe/'}`,
    })),
  ].slice(0, 5);

  const recommendations = [];
  if (uiFailed.length  > 0) recommendations.push('Fix UI test failures by reviewing selectors and adding appropriate wait conditions.');
  if (a11yViolations.length > 0) recommendations.push('Address accessibility violations starting with critical and serious impact items.');
  if (apiFailed.length > 0) recommendations.push('Investigate failing API endpoints for server-side errors or authentication issues.');
  if (score < 80) recommendations.push('Consider adding more targeted test cases for discovered failures.');
  recommendations.push('Re-run tests after fixes to confirm issues are resolved.');

  return {
    summary:         summaryParts.join(' '),
    failures,
    recommendations: recommendations.slice(0, 5),
    model:           'Offline (rule-based)',
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

async function analyzeResults(results) {
  const provider = (process.env.AI_PROVIDER || 'none').toLowerCase();
  logger.info(`  AI provider: ${provider}`);

  try {
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return await analyzeWithOpenAI(results);
    }
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return await analyzeWithGemini(results);
    }
  } catch (err) {
    logger.error(`AI analysis failed (${provider}): ${err.message}. Falling back to offline analysis.`);
  }

  return analyzeOffline(results);
}

module.exports = { analyzeResults };
