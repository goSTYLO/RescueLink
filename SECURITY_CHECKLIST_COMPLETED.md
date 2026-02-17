# Security & Documentation Checklist – Completed

This document records the checklist items that have been implemented for RescueLink.

---

## Authentication

- [x] **Strong password hashing (bcrypt/Argon2)** – `Backend/src/utils/hash.js` uses bcryptjs with configurable `SALT_ROUNDS` (env).
- [x] **Generic login error** – Phone and dispatcher login return `"Invalid credentials"` (401); no user enumeration.
- [x] **MFA available or enforced (web email OTP)** – Dispatcher login supports email OTP when `DISPATCHER_MFA_ENABLED=true`; `POST /api/auth/dispatcher/verify-otp` completes login.
- [x] **Validated token (JWT)** – Auth middleware verifies JWT; invalid/expired returns 401.
- [x] **JWT secret in production** – `Backend/src/config/jwt.js` requires `JWT_SECRET` in production (no default).
- [x] **Strong password policy** – `Backend/src/utils/validation.js`: min 8, max 128 chars, at least one letter and one number.
- [x] **Logout invalidates session** – Token blacklist; logout adds JWT to `token_blacklist`; middleware rejects blacklisted tokens.

---

## Input validation

- [x] **All inputs validated server-side** – Auth, incident, dispatch, responder, notification, location use `validate*` helpers; incident `description` length-validated (max 2000) in `createWithAudio`.
- [x] **Parameterized SQL queries** – All DB access uses `pool.query(sql, [params])` with placeholders.
- [x] **File upload validation (type + size)** – `Backend/src/middleware/fileUpload.js`: allowed extensions and env-based MAX_*_SIZE for audio/photo/video.
- [x] **API validation** – Per-route validation via `Backend/src/utils/validation.js` (no central schema layer).

---

## Database security

- [x] **Secure credential storage (env/vault)** – `DATABASE_URL`, `JWT_SECRET`, etc. in `.env`; README/DEPLOYMENT note production vault; JWT_SECRET required in production.
- [x] **Audit logging enabled** – Dispatcher actions (login, logout, signup, password reset, etc.) logged to `dispatcher_audit_logs` with IP and user agent.

---

## Documentation

- [x] **Complete README** – Backend README expanded (env vars, auth, file upload, audit, migrations); root README added with project layout and links.
- [x] **Deployment guide** – `Backend/DEPLOYMENT.md`: env checklist, DB setup, migrations, build/run, production notes (JWT_SECRET, HTTPS, logging).
- [x] **Clean terminal logs (no sensitive data)** – Request body redacts `password`, `idToken`, `newPassword`, `currentPassword`, `token`, `otp`, `sessionToken`; auth controller logs avoid phone/email/decoded token; phone-formatting log removed from validation.

---

## Other

- [x] **Migrations in setup-db** – `Backend/setup-db.js` runs schema then migrations in order.
- [x] **Token blacklist migration** – `add_token_blacklist.sql`; table also in `schema.sql`.
- [x] **Dispatcher MFA** – `add_dispatcher_login_otp.sql`; `dispatcher_login_otp` table; email OTP flow and verify-otp endpoint.
- [x] **Removed rescuelink_user GRANT** – `add_ai_fields.sql` no longer references non-existent role.

---

*Last updated from implementation of the Security & Documentation Run-Down Plan.*
