# RescueLink Security Checklist – Presentation & Testing Guide

Use this document to **present** and **test** each security item for your professor. For each item you can: (1) show where it is in the code, (2) run a quick test, or (3) both.

---

## Quick reference

| Category | Item | Where to show | How to test |
|----------|------|----------------|-------------|
| **Authentication** | Strong hashing | `Backend/src/utils/hash.js` | See section 1.1 |
| | Secure sessions | `Backend/src/middleware/auth.js`, `token_blacklist` | 1.2 |
| | MFA | Dispatcher OTP flow | 1.3 |
| | Token validation | Auth middleware | 1.4 |
| | Logout | `auth.js` controller + blacklist | 1.5 |
| | Rate limiting | `Backend/src/app.js` | 1.6 |
| **Input validation** | Server validation | `Backend/src/utils/validation.js` + controllers | 2.1 |
| | SQL/XSS/CSRF | Parameterized queries + `sanitizeInput` + Helmet | 2.2 |
| | Schema checks | Per-route validation (see API_DOCUMENTATION.md) | 2.3 |
| **Database** | Encrypted DB | Deployment/infra (documented) | 3.1 |
| | TLS | `Backend/src/config/db.js` | 3.2 |
| | Backups | `Backend/scripts/backup-db.js`, DEPLOYMENT.md | 3.3 |
| | Logs | `dispatcher_audit_logs`, request logging | 3.4 |

---

## 1. Authentication

### 1.1 Strong hashing

**What:** Passwords are hashed with bcrypt before storage; no plain-text passwords in the DB.

**Where to show:**
- **File:** `Backend/src/utils/hash.js`  
  Show `hashPassword` and `comparePassword` using `bcrypt`.
- **Usage:** `Backend/src/controllers/auth.js` – e.g. `comparePassword(password, user.password)` on login, and registration uses `hashPassword` before saving.

**How to test:**
1. Register a new user (e.g. via mobile app or `POST /api/auth/register`).
2. In the database, run: `SELECT password FROM users WHERE phone_number = '<that_phone>';`
3. **Expected:** Value is a bcrypt hash (starts with `$2a$` or `$2b$`), not the plain password.

**Demo line:** *“We use bcrypt with configurable salt rounds from the environment; you can see the hash utility here and it’s used on every login and registration.”*

---

### 1.2 Secure sessions

**What:** Sessions are JWT-based; tokens are verified on each request and can be invalidated via a blacklist.

**Where to show:**
- **File:** `Backend/src/middleware/auth.js`  
  Show: read `Authorization: Bearer <token>`, `jwt.verify(token, JWT_SECRET)`, then `TokenBlacklist.isBlacklisted(token)`.
- **File:** `Backend/src/models/tokenBlacklist.js` – tokens are stored and checked.

**How to test:**
1. Log in (e.g. `POST /api/auth/login` with phone + password). Copy the returned `token`.
2. Call a protected endpoint: `GET /api/auth/me` with header `Authorization: Bearer <token>` → **Expected:** 200 and user info.
3. Call with a wrong or expired token → **Expected:** 401 “Invalid or expired token”.

**Demo line:** *“Every protected route goes through this middleware: we verify the JWT and check the blacklist so logged-out tokens are rejected.”*

---

### 1.3 MFA (multi-factor authentication)

**What:** Dispatcher login can require email OTP when `DISPATCHER_MFA_ENABLED=true`.

**Where to show:**
- **File:** `Backend/src/controllers/auth.js`  
  Show `dispatcherLogin`: when MFA is enabled, it sends an OTP and returns `sessionToken` instead of a JWT; show `dispatcherVerifyOtp` that exchanges `sessionToken` + OTP for the JWT.
- **Table:** `dispatcher_login_otp` (see `Backend/migrations/add_dispatcher_login_otp.sql`).

**How to test:**
1. Set in `.env`: `DISPATCHER_MFA_ENABLED=true` and configure SMTP (or use a test inbox).
2. `POST /api/auth/dispatcher/login` with dispatcher email + password.
3. **Expected:** Response has `sessionToken` and “Verification code sent to your email” (no JWT yet).
4. `POST /api/auth/dispatcher/verify-otp` with `sessionToken` and the 6-digit OTP.
5. **Expected:** Response has JWT and user object.

**Demo line:** *“For dispatchers we support optional MFA: after password check we send a one-time code by email and only issue the JWT after OTP verification.”*

---

### 1.4 Token validation

**What:** Every request to a protected route validates the JWT (signature and expiry) and rejects invalid/expired tokens.

**Where to show:**
- Same as **1.2**: `Backend/src/middleware/auth.js` – `jwt.verify(token, JWT_SECRET)` and blacklist check.
- **File:** `Backend/src/config/jwt.js` – `JWT_SECRET` is required in production (no default).

**How to test:**
- Use an invalid token: `curl -H "Authorization: Bearer invalid" http://localhost:3000/api/auth/me` → **Expected:** 401.
- Omit header: `curl http://localhost:3000/api/incidents` → **Expected:** 401 “Missing authorization header”.

**Demo line:** *“The auth middleware validates the JWT on every protected request; in production we require a strong JWT secret and refuse to start without it.”*

---

### 1.5 Logout

**What:** Logout invalidates the session by adding the current JWT to the token blacklist; that token is then rejected by the auth middleware.

**Where to show:**
- **File:** `Backend/src/controllers/auth.js` – `exports.logout`: decode token, `TokenBlacklist.add(token, expiresAt)`.
- **File:** `Backend/src/middleware/auth.js` – after `jwt.verify`, `TokenBlacklist.isBlacklisted(token)` returns 401 if blacklisted.

**How to test:**
1. Log in and copy the JWT.
2. Call `POST /api/auth/logout` with `Authorization: Bearer <token>` → **Expected:** 200 “Logged out”.
3. Call `GET /api/auth/me` again with the same token → **Expected:** 401 “Invalid or expired token”.

**Demo line:** *“On logout we put the token in the blacklist; the middleware checks the blacklist before accepting any token, so that session is effectively ended.”*

---

### 1.6 Rate limiting

**What:** Auth endpoints are limited to 10 requests per 15 minutes per IP; general API is limited to 200 per 15 minutes per IP. Prevents brute-force and abuse.

**Where to show:**
- **File:** `Backend/src/app.js`  
  Show `authLimiter` (10/15 min), `apiLimiter` (200/15 min), and `app.use('/api/auth', authLimiter, authRoutes)` and `app.use('/api', apiLimiter)`.
- **Package:** `express-rate-limit` in `Backend/package.json`.

**How to test:**
1. From the same machine, send 11 login requests within 15 minutes (e.g. `POST /api/auth/login` with wrong password).
2. **Expected:** After the limit, response is **429** with message like “Too many attempts. Please try again later.”
3. Response headers should include `RateLimit-*` (e.g. `RateLimit-Remaining`).

**Demo line:** *“We use express-rate-limit: auth routes are limited to 10 attempts per 15 minutes per IP, and the rest of the API to 200 requests per 15 minutes to reduce brute-force and abuse.”*

---

## 2. Input validation

### 2.1 Full server validation

**What:** All API inputs are validated on the server using shared helpers (length, format, type). No reliance on client-only validation.

**Where to show:**
- **File:** `Backend/src/utils/validation.js`  
  Show `validateString`, `validatePhone`, `validateEmail`, `validatePassword`, `validateInteger`, `validateLatitude`, `validateLongitude`, `validateOptionalString`, `validatePagination`.
- **Controllers:** `Backend/src/controllers/auth.js`, `incident.js`, `dispatch.js`, `responder.js`, `notification.js` – each uses these helpers before using input.

**How to test:**
1. Send invalid data and expect **400** with a clear message, e.g.:
   - `POST /api/auth/register` with `password: "short"` → “Password must be at least 8 characters” (or similar).
   - `POST /api/auth/register` with invalid phone → “Invalid phone number format”.
   - Create incident with latitude 999 → “Latitude must be between -90 and 90”.

**Demo line:** *“Every route that accepts input uses our validation module: type, length, and format are checked server-side before we touch the database.”*

---

### 2.2 SQL / XSS / CSRF protection

**What:**  
- **SQL:** All queries use parameterized statements (`pool.query(sql, [params])`).  
- **XSS:** User-supplied strings are sanitized (`sanitizeInput` in validation) and security headers are set (Helmet).  
- **CSRF:** API uses Bearer tokens in headers (no cookie-based session), so CSRF risk is low; CORS is restricted in production.

**Where to show:**
- **SQL:** Any model, e.g. `Backend/src/models/user.js` or `incident.js` – show `pool.query('SELECT ... WHERE phone_number = $1', [phone])` (placeholders, no string concatenation).
- **XSS:** `Backend/src/utils/validation.js` – `sanitizeInput` (normalize line endings, strip control chars) and its use inside `validateString`.
- **Headers:** `Backend/src/app.js` – `helmet()` and `cors({ origin: process.env.FRONTEND_URL || true, credentials: true })`.

**How to test:**
- **SQL:** Try sending a value like `' OR '1'='1` in a login or search field; login should fail as “Invalid credentials” and no SQL error (parameterized query prevents injection).
- **Headers:** Call any API and inspect response headers (e.g. with browser DevTools or `curl -I`); you should see headers set by Helmet (e.g. `X-Content-Type-Options`, `X-Frame-Options`).

**Demo line:** *“We use parameterized queries everywhere for SQL, sanitize string input and use Helmet for security headers, and we rely on Bearer tokens and CORS for CSRF mitigation.”*

---

### 2.3 Schema checks

**What:** Request bodies and query parameters are validated per route; rules are documented in the API docs.

**Where to show:**
- **File:** `Backend/API_DOCUMENTATION.md` – “Validation Rules” and “Input Validation” sections list constraints (lengths, formats, etc.).
- **Code:** Same as 2.1 – each controller applies the appropriate `validate*` for that route’s schema (e.g. incident description max 2000, pagination limit capped at 100).

**How to test:**
- Send a request that violates a documented rule (e.g. `limit=1000` or `firstName` longer than 100 chars) and confirm **400** with a message that matches the documented rule.

**Demo line:** *“We don’t use a single schema library for everything, but every endpoint has explicit validation and the allowed types and lengths are documented in API_DOCUMENTATION.md.”*

---

## 3. Database security

### 3.1 Encrypted database

**What:** Data-at-rest encryption is a deployment/infrastructure concern (e.g. cloud provider or volume encryption), not something the app implements in code.

**Where to show:**
- **File:** `Backend/DEPLOYMENT.md` – section “Encryption at rest”: “Use your provider’s or host’s option for encrypted storage (e.g. managed PostgreSQL disk encryption). This is not configured in application code.”

**How to test:**
- **Presentation:** Explain that you use (or would use) a managed PostgreSQL with encryption at rest enabled, or an encrypted volume. No code demo required; the checklist is satisfied by documentation and deployment choices.

**Demo line:** *“Database encryption at rest is handled by our host or provider; we’ve documented that requirement in the deployment guide.”*

---

### 3.2 TLS (database connection)

**What:** The app can use TLS for the PostgreSQL connection in production or when `DATABASE_SSL=true`.

**Where to show:**
- **File:** `Backend/src/config/db.js`  
  Show: `useSsl = process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'` and `...(useSsl && { ssl: { rejectUnauthorized: true } })`.
- **File:** `Backend/DEPLOYMENT.md` – Database section: enable TLS via `DATABASE_SSL=true` or `sslmode=require` in `DATABASE_URL`.

**How to test:**
- **Code review:** Show the `db.js` logic.  
- **Live (optional):** With a DB that requires SSL, set `DATABASE_SSL=true` or `NODE_ENV=production` and confirm the app connects; without SSL the connection would fail if the server requires it.

**Demo line:** *“Our DB config turns on SSL when we’re in production or when DATABASE_SSL is set; the deployment guide explains how to configure it.”*

---

### 3.3 Backups

**What:** Backups are documented; an optional script runs `pg_dump` and writes timestamped dumps to `backups/`.

**Where to show:**
- **File:** `Backend/DEPLOYMENT.md` – “Backups” section (schedule, retention, restore, optional script).
- **File:** `Backend/scripts/backup-db.js` – reads `DATABASE_URL`, runs `pg_dump`, writes to `backups/backup-<timestamp>.sql`.
- **Script:** `npm run backup-db` in `Backend/package.json`.

**How to test:**
1. Set `DATABASE_URL` in `.env` and ensure `pg_dump` is on PATH.
2. Run from `Backend`: `npm run backup-db`.
3. **Expected:** A new file under `Backend/backups/` with a timestamp in the name.

**Demo line:** *“We document backup policy in the deployment guide and provide an optional script; in production we’d schedule it or use the provider’s backup feature.”*

---

### 3.4 Logs

**What:** Dispatcher actions are written to `dispatcher_audit_logs` (IP, user agent, action type); request logging redacts sensitive fields (passwords, tokens).

**Where to show:**
- **Audit table:** `Backend/schema.sql` or `migrations/add_dispatcher_audit_logs.sql` – `dispatcher_audit_logs` columns.
- **File:** `Backend/src/utils/auditLog.js` – `logDispatcherAction` / `logDispatcherActionByUser` writing to that table.
- **File:** `Backend/src/app.js` – request logging middleware and `redactBody` (e.g. `SENSITIVE_KEYS`: password, token, otp, etc.).

**How to test:**
1. Log in as a dispatcher and perform an action (e.g. logout or view audit log).
2. Query the DB: `SELECT * FROM dispatcher_audit_logs ORDER BY created_at DESC LIMIT 5;`
3. **Expected:** Rows with `user_id`, `action`, `ip_address`, `user_agent`, etc.
4. Trigger a login request and check server logs: **Expected:** No raw password or token in the logged body (values show as `[REDACTED]`).

**Demo line:** *“We log dispatcher actions to an audit table with IP and user agent, and our request logger redacts passwords and tokens so they never appear in logs.”*

---

## Presentation tips

1. **Order:** Start with Authentication (hashing, login, logout, rate limit), then Input validation (one example of validation + parameterized query + Helmet), then Database (TLS config, backups doc, audit logs).
2. **Code vs live:** For “where to show,” have the file open and scroll to the relevant lines. For “how to test,” run one or two tests live if time allows (e.g. wrong token → 401, rate limit → 429, backup script).
3. **Checklist:** You can print this MD or use it on screen and tick off each subsection (1.1–1.6, 2.1–2.3, 3.1–3.4) as you cover it.

---

*RescueLink Security Checklist – Presentation & Testing Guide*
