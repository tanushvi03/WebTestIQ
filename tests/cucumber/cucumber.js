/**
 * Cucumber.js configuration for WebTestIQ BDD tests.
 *
 * Run via:
 *   npm test              (uses run-cucumber.js orchestrator)
 *   npx cucumber-js       (direct CLI — does NOT generate run-id/reports)
 */
module.exports = {
  default: {
    paths:        ['features/**/*.feature'],
    require:      ['steps/**/*.js', 'support/**/*.js'],
    format:       ['@cucumber/pretty-formatter', 'json:reports/cucumber-output.json'],
    parallel:     0,
    retry:        0,
    timeout:      60_000,
    tags:         'not @skip',
  },
};
