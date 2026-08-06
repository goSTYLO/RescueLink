# IAS Module 10 Activity Answers

## Project Scope Used
- Module 1: Authentication (Login API / token auth)
- Module 2: Incident API (incident creation with uploads)
- Module 3: AI Service Integration (backend to AI microservice)

---

## Part A — Secure Testing Matrix

### Module 1 — Authentication (Login API / token auth)

| # | Possible Vulnerability | Type of Test (Manual or Tool) | Expected Behavior if Fixed |
|---|---|---|---|
| 1 | Weak password validation allows short/simple passwords | Manual  form test + unit test (`validatePassword`) | Rejects passwords under 8 chars and those missing uppercase/number/special char with 400 error |
| 2 | Missing/invalid JWT still grants access | Integration test (Supertest/Jest), manual API test with missing token | Returns 401 with `Missing authorization header` or `Invalid or expired token` |
| 3 | Token reuse after logout (no blacklist check) | Integration test + manual replay of old token after logout | Reused token is denied with 401 due to blacklist validation |

### Module 2 — Incident API (incident creation with uploads)

| # | Possible Vulnerability | Type of Test (Manual or Tool) | Expected Behavior if Fixed |
|---|---|---|---|
| 1 | Malicious file upload (dangerous extension/signature) | Integration test for upload middleware + manual upload test | Upload is blocked with 400 when extension/signature checks fail |
| 2 | Incident spam/abuse (no rate limiting) | Manual rapid-request test + automated load script | Excess requests are throttled (`Too many incident reports`) |
| 3 | Insecure direct object reference (viewing other user incident) | Integration test with different user tokens (ownership test) | Non-owner user cannot read other user records; only owner/dispatcher/admin can |

### Module 3 — AI Service Integration (backend to AI microservice)

| # | Possible Vulnerability | Type of Test (Manual or Tool) | Expected Behavior if Fixed |
|---|---|---|---|
| 1 | Unauthorized internal access to AI endpoints | Integration/API test with missing/invalid `x-ai-service-token` | Returns 401 Unauthorized for invalid/missing internal token |
| 2 | Missing auth header from backend to AI service | Unit test of AI client contract (`classifyText`) | Outgoing AI request contains `x-ai-service-token` when configured |
| 3 | Repeated downstream failures cause unsafe request flooding | Unit test for circuit breaker behavior | Circuit opens after threshold failures and rejects new calls until reset |

### Questions (Part A)

#### 1) How can an attacker exploit it?
- Weak password validation: attacker brute-forces weak accounts quickly.
- Missing JWT enforcement: attacker calls protected endpoints anonymously or with forged/expired tokens.
- Token replay: attacker reuses stolen token after victim logs out.
- Upload weakness: attacker uploads malicious payload disguised as media.
- No rate limit: attacker floods incident endpoints (resource exhaustion / alert noise).
- IDOR on incidents: attacker guesses numeric IDs and views other users’ reports.
- Missing AI internal token: attacker directly invokes AI microservice endpoints and abuses model resources.
- Missing backend auth header to AI: service-to-service trust breaks; AI endpoint may become reachable incorrectly in mixed configs.
- No circuit breaker: repeated AI failures trigger cascading latency and denial-of-service effects.

#### 2) Provide a secure fix.
- Enforce strong password policy in centralized validator; reject weak input before hashing/storing.
- Require JWT auth middleware on protected routes and verify signature + expiry.
- Implement token blacklist checks on every authenticated request after logout.
- Enforce upload allowlist, size limits, quick signature scan, and deep-scan workflow.
- Apply per-user/IP rate limiting for incident creation endpoints.
- Enforce ownership and role-based authorization middleware for record access.
- Validate `x-ai-service-token` in AI API and set internal token in environment.
- Inject auth headers from backend AI client (`buildAuthHeaders`) for every AI request.
- Add circuit-breaker guard and recovery window for unstable AI dependency.

---

## Part B — Unit Testing for Secure Functions

### Task 1: Password Validation

#### 1) What is the security issue?
The vulnerable logic only checks length greater than 3 (`len(password) > 3`), which allows extremely weak passwords like `1234`. This makes account compromise easier via brute force and credential stuffing.

#### 2) Write a unit test that exposes the flaw.
```javascript
describe('validatePassword (secure rules)', () => {
  it('rejects weak short password', () => {
    expect(() => validatePassword('1234')).toThrow();
  });

  it('rejects missing uppercase/number/special', () => {
    expect(() => validatePassword('password')).toThrow();
  });
});
```

#### 3) Fix the function.
```javascript
function validatePassword(password) {
  if (typeof password !== 'string') throw new Error('Password must be a string');

  const trimmed = password.trim();

  if (trimmed.length < 8) throw new Error('Password must be at least 8 characters long');
  if (trimmed.length > 128) throw new Error('Password must not exceed 128 characters');
  if (!/[A-Z]/.test(trimmed)) throw new Error('Password must contain at least one capital letter');
  if (!/[0-9]/.test(trimmed)) throw new Error('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=[\]{};\':"\\|,.<>/?`~]/.test(trimmed)) throw new Error('Password must contain at least one special character');

  return trimmed;
}
```

### Unit Test (worksheet item)
```javascript
it('test_short_password', () => {
  expect(() => validatePassword('1234')).toThrow();
});
```

### Fixed Code (worksheet item)
Use the same `validatePassword` function above.

### Expected Secure Behavior
1. Weak passwords (short/simple) are rejected with clear validation errors.
2. Only strong passwords proceed to hashing and account operations.

---

### Task 2: SQL Injection Check

#### 1) What vulnerability exists?
SQL Injection. Concatenating user input into SQL lets attackers alter query logic (example input: `' OR '1'='1`).

#### 2) What type of test should detect it?
- Security-focused integration test (tool-based) sending malicious payloads to login/search endpoints.
- Manual penetration-style input test using known SQLi payloads.

#### 3) Fix the code (Parameterized Query)
```javascript
async function findUser(username) {
  const query = 'SELECT * FROM users WHERE username = $1';
  const values = [username];
  return db.query(query, values);
}
```

### Expected Behavior
1. SQL payloads are treated as plain string input, not executable SQL syntax.
2. Only exact username matches are returned; injection attempts fail safely.

---

## Reflection Questions

### 1) Why is unit testing alone not enough for security?
Unit tests validate isolated logic, but many security failures happen at integration boundaries (auth headers, route middleware order, database calls, file uploads, and service-to-service trust). Security also needs integration, abuse-case, and configuration testing.

### 2) Which vulnerability is most critical in this lab? Why?
The most critical is broken authentication/authorization (JWT + role/ownership bypass), because it can expose or modify protected incident data and high-privilege actions even without exploiting deeper technical flaws.

### 3) How do OWASP and NIST improve testing quality?
OWASP provides practical vulnerability categories and test checklists (e.g., injection, auth, access control), while NIST gives structured risk and control guidance. Together they make testing systematic, repeatable, and aligned with recognized security standards.

---

## Think Back
The most critical vulnerability identified was access-control bypass risk on protected incident and admin actions. The fix is strict JWT validation, token blacklist checks, role-based authorization, and ownership checks on sensitive routes.

## Think About
As an attacker, the first test would be authentication and access-control edges: missing/expired token behavior, role escalation attempts, and ID-based record access (IDOR), because these often produce the highest-impact compromise quickly.
