Module 10 Activity: Testing and Debugging for Security
Learning Objectives
By the end of this lab, students should be able to:
1. Conduct unit and integration testing to verify that backend modules function securely.
2. Identify and fix security vulnerabilities revealed through debugging or penetration-style testing.

Part A — Secure Testing Matrix
Students complete the table.
Open the latest version of your project.
1. Select 3 module (e.g., login, API endpoint, or data input form).
2. Identify 3 possible security risks per module.
3. Write them in the table below before testing.

Fill in the Missing Entries
Module/Function Possible Vulnerability Type of Test (Manual or

Tool) Expected Behavior if Fixed

Login API Weak password
validation

Manual form test + unit
test

Rejects short passwords < 8
chars

1.
2.
3.

Questions
1. How can an attacker exploit it?

2. Provide a secure fix.

Part B — Unit Testing for Secure Functions
Task 1: Password Validation
Vulnerable Code
def validate_password(password):
return len(password) > 3
Questions
1. What is the security issue?
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
2. Write a unit test that exposes the flaw.
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
3. Fix the function.
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
Unit Test
def test_short_password():
assert validate_password("1234") == False
(Current code will FAIL the test.)
Fixed Code (Write the correct code here)
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________

Expected Secure Behavior
1.
2.
Task 2: SQL Injection Check
Vulnerable Code
def find_user(username):
query = "SELECT * FROM users WHERE username = '" + username + "'"
return db.execute(query)
Manual Test Input
' OR '1'='1
If login succeeds → vulnerable.

Questions
1. What vulnerability exists?
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
2. What type of test should detect it?
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
3. Fix the code (Parameterized Query)
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
Expected Behavior
1.
2.

Reflection Questions
1. Why is unit testing alone not enough for security?
2. Which vulnerability is most critical in this lab? Why?
3. How do OWASP and NIST improve testing quality?

Think Back
What was the most critical vulnerability you found, and how did you fix it?

Think About
If you were an attacker, what would be the first thing you'd test in your own app? If you can answer
that, you're already thinking like a cybersecurity analyst.