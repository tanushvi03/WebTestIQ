Feature: Landing Page
  As a visitor to WebTestIQ
  I want to see the landing page
  So that I can understand what the platform does

  Background:
    Given I open the WebTestIQ landing page

  Scenario: Landing page loads successfully
    Then I should see the page title contains "WebTestIQ"
    And I should see a hero heading containing "Test Any Website"

  Scenario: Landing page shows all six feature cards
    Then I should see 6 feature cards

  Scenario: Landing page has a "Get Started" call-to-action
    Then I should see a "Get Started" button
    When I click the "Get Started" button
    Then I should be redirected to the login page

  Scenario: Landing page has a "Launch Platform" CTA
    Then I should see a "Launch Platform" button
    When I click the "Launch Platform" button
    Then I should be redirected to the login page

  Scenario: Landing page should not have console errors
    Then the browser console should not have errors
