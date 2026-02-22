# RescueLink Backend

Node.js + Express backend for RescueLink, using PostgreSQL. Handles authentication, incident reporting, dispatcher workflows, AI-powered incident classification, and audit logging.

## Quick start

1. **Copy environment file and configure:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at minimum:
   - `DATABASE_URL` – PostgreSQL connection string
   - `JWT_SECRET` – Secure random string (32+ chars). Generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

2. **Create the database and run schema:**
   ```bash
   npm run setup-db
   ```
   Or manually run `schema.sql` via your DB client.

3. **Run migrations** (for existing databases):
   ```bash
   psql $DATABASE_URL -f migrations/add_dispatcher_audit_logs.sql
   psql $DATABASE_URL -f migrations/add_token_blacklist.sql
   psql $DATABASE_URL -f migrations/add_dispatcher_login_otp.sql
   ```
   Run other migrations in `migrations/` as needed for your schema version.

4. **Install dependencies and start:**
   ```bash
   npm install
   npm run dev
   ```

## Environment variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs (32+ chars in production) | Yes |
| `SALT_ROUNDS` | bcrypt salt rounds (default: 10) | No |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | `production` or `development` | Yes in production |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON | For phone auth |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP for password reset emails | For dispatcher forgot-password |
| `FRONTEND_URL` | Base URL for password reset links | For dispatcher web app |
| `BLOCKCHAIN_SERVICE_URL` | Blockchain verification service URL | For incident verification |
| `DISPATCHER_MFA_ENABLED` | Enable email OTP for dispatcher login (default: true). Set `false` for dev without SMTP | No |
| `UPLOAD_DIR` | Directory for incident uploads (default: `uploads/incidents`) | No |
| `MAX_AUDIO_SIZE` | Max audio file size in bytes (default: 25MB) | No |
| `MAX_PHOTO_SIZE` | Max photo size in bytes (default: 10MB) | No |
| `MAX_VIDEO_SIZE` | Max video size in bytes (default: 50MB) | No |

For production, use a secrets manager or vault for sensitive values. Never commit `.env` to version control.

## Authentication

- **Mobile (phone):** Register with phone + password, then verify via Firebase Phone Auth. Send Firebase ID token to `POST /api/auth/onboard-phone` to mark phone as verified.
- **Web dispatcher:** Email + password via `POST /api/auth/dispatcher/login` or `POST /api/auth/dispatcher/signup`. When MFA is enabled (`DISPATCHER_MFA_ENABLED=true`), login returns a `sessionToken`; complete with `POST /api/auth/dispatcher/verify-otp` using the 6-digit code from email.
- **JWT:** All protected routes require `Authorization: Bearer <token>`.
- **Logout:** `POST /api/auth/logout` invalidates the token (blacklist) so it cannot be reused.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint details.

## File uploads

Incident reports can include audio and media. Use `POST /api/incidents/with-audio` with `multipart/form-data`:
- `audio` – Single audio file (wav, mp3, m4a, flac), max 25MB
- `media` – Up to 5 photos/videos (jpg, png, mp4, mov, avi)

File type and size are validated server-side.

## Audit logging

Dispatcher actions (login, logout, signup, password change, dispatch, etc.) are logged to `dispatcher_audit_logs` with IP and user agent. Use `GET /api/audit-logs` (dispatcher only) to query.

## Migrations

| File | Purpose |
|------|---------|
| `add_dispatcher_audit_logs.sql` | Dispatcher audit log table |
| `add_token_blacklist.sql` | Token blacklist for logout invalidation |
| `add_dispatcher_login_otp.sql` | Dispatcher MFA OTP table |
| `add_ai_fields.sql` | AI classification fields |
| `add_incident_verified.sql` | Incident verification status |
| `add_incident_barangay.sql` | Barangay field for incidents |

Run migrations in order for existing databases. New setups via `setup-db` use `schema.sql` which includes core tables.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment steps and checklist.
