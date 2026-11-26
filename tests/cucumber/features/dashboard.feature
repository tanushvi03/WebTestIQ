Feature: Dashboard
  As an authenticated WebTestIQ user
  I want to view the dashboard
  So that I can see testing statistics and navigate the platform

  Background:
    Given I am logged in as demo user

  Scenario: Dashboard renders with expected sections
    When I navigate to the dashboard
    Then I should see the dashboard heading "Dashboard"
    And I should see 4 stat cards
    And I should see stat card labels for "Total Runs", "Tests Passed", "Tests Failed", "Avg Score"
    And I should see 3 tip cards

  Scenario: Dashboard shows the pass/fail trend chart when data exists
    When I navigate to the dashboard
    Then I should see a chart card with the heading "Pass / Fail Trend"
    But I may see the empty state with text "No test runs yet" if no tests have been run

  Scenario: "New Test" button navigates to test page
    When I navigate to the dashboard
    And I click the "New Test" button
    Then I should be on the test page

  Scenario: Sidebar shows all navigation items
    When I navigate to the dashboard
    Then the sidebar should show navigation items for "Dashboard", "New Test", "History", "Reports"

  Scenario: Sidebar Reports link navigates to reports page
    When I navigate to the dashboard
    And I click the sidebar link for "Reports"
    Then I should be on the reports page

  Scenario: Sidebar toggle collapses and expands
    When I navigate to the dashboard
    And I click the sidebar toggle
    Then the sidebar labels should be hidden
    When I click the sidebar toggle again
    Then the sidebar labels should be visible
