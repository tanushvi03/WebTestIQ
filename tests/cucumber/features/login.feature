Feature: Login
  As a WebTestIQ user
  I want to log in to the platform
  So that I can access the testing dashboard

  Background:
    Given I am on the login page

  Scenario: Empty credentials show validation errors
    When I submit the login form without entering any credentials
    Then I should see a validation error for the username field
    And I should see a validation error for the password field

  Scenario: Invalid credentials show an error message
    When I enter username "wronguser" and password "wrongpass"
    And I submit the login form
    Then I should see an error message indicating invalid credentials

  Scenario: Valid demo credentials log in successfully
    When I enter username "admin" and password "admin123"
    And I submit the login form
    Then I should be redirected to the dashboard
    And I should see the dashboard heading "Dashboard"

  Scenario: Login state persists across page reload
    When I enter username "admin" and password "admin123"
    And I submit the login form
    Then I should be redirected to the dashboard
    When I reload the page
    Then I should still be on the dashboard

  Scenario: Logout returns to login page
    Given I am logged in as demo user
    When I click the logout button
    Then I should be redirected to the login page

  Scenario: Unauthenticated access to dashboard redirects to login
    When I navigate directly to the dashboard URL
    Then I should be redirected to the login page
