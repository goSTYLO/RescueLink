# RescueLink Backend

Node.js + Express backend for RescueLink, using PostgreSQL. Handles authentication, incident reporting, dispatcher workflows, AI-powered incident classification, and audit logging.

## Session Updates (Mobile + Backend Incident Integration)

Recent backend changes aligned with current mobile integration:

- **Notifications ownership enforcement for user role**:
  - `GET /api/notifications` now forces `user_id = req.user.user_id` for role `user`.
  - `GET /api/notifications/:id` returns `403` if a regular user tries to access another user's notification.
- **Incident detail contract parity with mobile unified screen**:
  - `GET /api/incidents/:id/with-ai` remains the primary detail source for combined tracking/details UI.
  - mobile now supports AI confidence keys from both create and stored-classification paths (`confidence`, `confidence_score`, and incident `primary_confidence` fallback).
- **Incident evidence download endpoints in active use by mobile**:
  - `GET /api/incidents/:id/audio`
  - `GET /api/incidents/:id/media/:index`
  - both routes keep ownership protection for regular users through RBAC middleware.

## Session Updates (Performance Session 2)

Implemented updates during this session:

- **AI request path optimization**: per-request AI health precheck can now be gated to avoid extra round-trip latency
- **With-audio flow cleanup**: duplicate deep-scan invocation in AI-fallback path was removed
- **Blockchain observability passthrough**: verify responses now include gas metrics from blockchain service
- **Duplicate blockchain write awareness**: backend verify response now includes `already_recorded` when chain service skips duplicate writes

These changes were validated in the latest local performance reruns.

## Session Updates (Web + Backend Integration Alignment)

Recent cross-stack updates completed for dispatcher web integration:

- **Request correlation parity**: web clients now consistently send `x-request-id`; backend already echoes/uses this for logs.
- **Incident contract hardening**: web incident client contract tests now cover list/detail/with-ai/verify/reclassify.
- **Lifecycle consistency**: web side now enforces canonical lifecycle values (`pending`, `verified`, `in_progress`, `resolved`, `closed`) to match backend expectations.
- **Post-action convergence**: verify/reclassify flows trigger cross-page refresh events in web (dashboard/map/details).
- **Live API test script resilience**: `tests/integration.test.js` setup now handles "already registered" account messages more safely.

## Session Updates (Assignment v2 + AI Top-2 Classification)

Recent backend updates for dispatcher workflow simplification:

- **Dispatch assignment v2 contract (backward compatible)**:
  - `POST /api/dispatches` now supports grouped assignment payloads with `department_code`, `team_name`, and `responders[]`.
  - Legacy single-responder payload (`report_id` + `responder_id`) is still supported.
- **Backend-driven team auto-assignment**:
  - `POST /api/dispatches` also accepts `report_id + department_code + team_name` without `responders[]`.
  - server resolves eligible team members and assigns only responders marked `available` or `standby`.
  - API returns `assignment_summary` with `assigned_count` and `unassigned_reason` (e.g. `no_available_team_members`).
- **Hybrid responder model support**:
  - responders can be tagged with `source_type` (`account` or `directory`).
  - dispatch records persist responder source and assignment metadata.
- **Top-2 AI classification persistence**:
  - incident records now support explicit primary/secondary classification fields and confidence values.
  - AI classification record supports secondary predicted type/confidence when available.

## Session Updates (Responder Flow + RBAC Status Split)

Recent backend updates for responder/team operations:

- **Responder/team specialization schema**:
  - responders now support `supported_incident_types`.
  - responder teams now support `team_status` and `supported_incident_types`.
- **RBAC split for responder management**:
  - admin-only: create/update/delete responders and teams, plus team-member mapping.
  - dispatcher + admin: status update endpoints for responder and team availability.
- **Task-aware auto-assignment eligibility**:
  - auto-assignment now checks:
    - team status (`available`/`standby`)
    - responder status (`available`/`standby`)
    - incident-type compatibility when team/responder specialization is configured.
  - assignment summary now includes requested incident type metadata.

## Session Updates (Department Ops Integration Support)

Backend endpoints continue to support the updated web department operations flow:

- `GET /api/departments/:id` is used as the canonical detail source with numeric `department_id`.
- Team/member assignment and status endpoints remain the source of truth for Department Details and Departments Teams tabs:
  - team listing/status updates
  - team-member list/add/remove
  - responder status updates
- This keeps department operations aligned with assignment v2 (team-first, status-aware workflows).

## Session Updates (Incident Lifecycle + Reporter Confirmation)

Implemented end-to-end lifecycle flow updates:

- **Canonical status flow**:
  - `pending -> verified -> in_progress -> resolved -> closed`
  - guarded transitions enforced in backend model/controller path.
- **Dispatcher/admin status endpoint**:
  - `PATCH /api/incidents/:id/status`
  - validates allowed transitions and rejects invalid jumps.
- **Reporter confirmation endpoint**:
  - `POST /api/incidents/:id/confirm-resolution`
  - owner-only confirmation after incident is already `resolved`.
  - auto-transitions incident from `resolved -> closed` on successful confirmation.
  - persists `reporter_confirmed_at` + `reporter_confirmed_by_user_id` and closure metadata (`closed_at`, `closed_by_user_id`, `closure_method`).
- **Resolve actor audit field**:
  - `resolved_by_user_id` is persisted when dispatcher/admin marks resolved.
- **Closure reconciliation**:
  - on `resolved` and `closed`, assigned responder/team statuses and department units are reconciled back to available state.
- **Auto-start lifecycle hook**:
  - first successful dispatch assignment now attempts `verified -> in_progress`.

## Session Updates (Lifecycle Reliability + Task Mapping Normalization)

Latest reliability fixes applied:

- **Auto-transition reliability fix**:
  - fixed SQL parameter binding in incident status transition update path.
  - resolves cases where assignment created a dispatch but incident status stayed `verified`.
  - expected behavior is now consistent: first successful assignment moves `verified -> in_progress`.
- **Task-to-incident normalization for assignment eligibility**:
  - responder/team task matching now normalizes common synonyms into canonical task buckets:
    - medical: `accident`, `vehicular accident`, `traffic accident`, `collision`, `injury`, `trauma`
    - police: `crime`, `robbery`, `theft`, `assault`, `violence`
    - disaster: `natural disaster`, `typhoon`, `flood`, `earthquake`, `landslide`
    - fire: `fire`, `blaze`, `wildfire`
- **Conflict semantics remain explicit**:
  - `POST /api/dispatches` returns `409` when no eligible/available team members are found for the selected team.
  - response includes `assignment_summary.unassigned_reason` to help client-side messaging.

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
   psql $DATABASE_URL -f migrations/add_dispatch_assignment_v2_and_secondary_ai.sql
   psql $DATABASE_URL -f migrations/add_team_member_assignment_schema.sql
   psql $DATABASE_URL -f migrations/add_responder_task_and_team_status.sql
   psql $DATABASE_URL -f migrations/add_incident_resolution_confirmation_fields.sql
   ```
   Run other migrations in `migrations/` as needed for your schema version.

4. **Install dependencies and start:**
   ```bash
   npm install
   npm run dev
   ```

5. **Seed test data (optional, local/dev only):**
   ```bash
   node scripts/seed-db.js
   node scripts/seed-incidents-from-audio.js --reset --count=10
   ```
   `seed-db.js` seeds realistic core operational data (departments, users, teams, responders, team memberships).
   `seed-incidents-from-audio.js` seeds incidents using real audio files from `RescueLink AI/test` and `Backend/uploads/incidents`.
   Incident seeding is intentionally capped for local/dev predictability (max/default: 10 incidents).

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
| `AI_SERVICE_URL` | RescueLink AI service URL | No |
| `AI_SERVICE_TOKEN` | Optional token sent as `x-ai-service-token` to AI service | No |
| `AI_HEALTH_PRECHECK_ENABLED` | Enables per-request AI `/health` precheck before classification (`default: false`) | No |
| `AI_CIRCUIT_FAILURE_THRESHOLD` | Consecutive AI request failures before opening circuit (`default: 3`) | No |
| `AI_CIRCUIT_RESET_MS` | Circuit open duration in milliseconds (`default: 30000`) | No |
| `FILE_SCAN_FAIL_OPEN` | If `true`, accepts uploads when deep scanner is unavailable and flags them (`default: true`) | No |
| `FILE_DEEP_SCAN_ENABLED` | Enables async deep scan workflow (`default: true`) | No |
| `FILE_DEEP_SCAN_ENGINE` | Deep scan engine identifier (`stub`, `clamav`, etc.) | No |
| `FILE_SCANNER_AVAILABLE` | Marks scanner runtime availability (`default: false`) | No |
| `CLAMAV_HOST` | ClamAV daemon host (`default: 127.0.0.1`) | No |
| `CLAMAV_PORT` | ClamAV daemon port (`default: 3310`) | No |
| `CLAMAV_TIMEOUT_MS` | ClamAV stream scan timeout (`default: 15000`) | No |
| `FILE_SCAN_RETRY_CRON` | Cron schedule for scan retry worker (`default: */10 * * * *`) | No |
| `FILE_SCAN_MAX_BATCH` | Max incidents processed per scan retry run (`default: 30`) | No |
| `QUARANTINE_DIR` | Directory used for quarantined files (`default: uploads/quarantine`) | No |
| `IMAGE_COMPRESSION_ENABLED` | Enables image compression before save (`default: true`) | No |
| `VIDEO_COMPRESSION_ENABLED` | Enables video compression/transcoding before save (`default: true`) | No |
| `IMAGE_MAX_WIDTH` | Max image width during compression (`default: 1920`) | No |
| `IMAGE_JPEG_QUALITY` | JPEG compression quality (`default: 78`) | No |
| `VIDEO_CRF` | FFmpeg CRF value for video compression (`default: 30`) | No |

For production, use a secrets manager or vault for sensitive values. Never commit `.env` to version control.

## Authentication

- **Mobile (phone):** Register with phone + password, then verify via Firebase Phone Auth. Send Firebase ID token to `POST /api/auth/onboard-phone` to mark phone as verified.
- **Web dispatcher:** Email + password via `POST /api/auth/dispatcher/login` or `POST /api/auth/dispatcher/signup`. When MFA is enabled (`DISPATCHER_MFA_ENABLED=true`), login returns a `sessionToken`; complete with `POST /api/auth/dispatcher/verify-otp` using the 6-digit code from email.
- **JWT:** All protected routes require `Authorization: Bearer <token>`.
- **Logout:** `POST /api/auth/logout` invalidates the token (blacklist) so it cannot be reused.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint details.

## Seeded Test Accounts

- Admin: `admin@rescuelink.test`, `admin2@rescuelink.test` (password: `admin123`)
- Dispatcher: `dispatcher@rescuelink.test`, `dispatcher2@rescuelink.test` (password: `dispatcher123`)
- Supervisor: `supervisor@rescuelink.test`, `supervisor2@rescuelink.test` (password: `supervisor123`)
- Responder: `responder@rescuelink.test`, `responder2@rescuelink.test` (password: `responder123`)
- User: `user@rescuelink.test`, `user2@rescuelink.test` (password: `user123`)

## File uploads

Incident reports can include audio and media. Use `POST /api/incidents/with-audio` with `multipart/form-data`:
- `audio` – Single audio file (wav, mp3, m4a, flac), max 25MB
- `media` – Up to 5 photos/videos (jpg, png, mp4, mov, avi)

Server-side upload protections and optimizations:
- **Quick security gate (sync):** signature validation + blocked binary/script signatures + extension mismatch rejection
- **Deep scan workflow (async):** queued scan status (`pending`, `clean`, `unscanned`, `quarantined`, `error`)
- **Fail-open mode:** if scanner is unavailable and `FILE_SCAN_FAIL_OPEN=true`, incident is accepted but flagged for follow-up
- **Quarantine support:** suspicious files are moved to `QUARANTINE_DIR` and blocked from download
- **Compression:** photos are resized/compressed (Sharp), videos are transcoded/compressed (FFmpeg) before storage

`/api/incidents/with-audio` responses now include `security_scan` metadata so clients can display scan status.

### Incident verify response additions

`POST /api/incidents/:id/verify` now includes blockchain metadata fields:
- `gas_used`
- `effective_gas_price`
- `gas_cost_wei`
- `already_recorded`

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
| `add_dispatch_assignment_v2_and_secondary_ai.sql` | Assignment v2 metadata, hybrid responder fields, and top-2 AI fields |
| `add_team_member_assignment_schema.sql` | Team and team-member mapping tables for auto-assignment |
| `add_responder_task_and_team_status.sql` | Responder/team specialization fields and team status availability |
| `add_incident_resolution_confirmation_fields.sql` | Incident resolve/confirmation metadata fields for reporter confirmation flow |

Run migrations in order for existing databases. New setups via `setup-db` use `schema.sql` which includes core tables.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment steps and checklist.

## Security Runbook

Operational scanner outage and quarantine procedures are documented in [SECURITY_RUNBOOK.md](SECURITY_RUNBOOK.md).

## Security Test Runner

- Backend-only suite: `npm run test:security`
- Full security suite (Backend + AI fallback tests): run [run_security_integration_tests.ps1](../run_security_integration_tests.ps1) from the repository root.

## Integration test commands

From `Backend/`:

```bash
npm run test:all
npm run test:endpoints
npm run test:rbac
npm run test:security
npm run test:integration
```

Live API integration (requires backend running on `http://localhost:3000`):

```bash
node tests/integration.test.js
```

From repo root, cross-stack runner (web + backend focused):

```bash
powershell -ExecutionPolicy Bypass -File .\run_master_integration_tests.ps1 -SkipMobile -SkipAI -SkipBlockchain
```

## Security Trigger Logs

Watch these backend logs to confirm security features are firing:
- `🛡️ Upload quick scan status:` (quick scan executed)
- `⛔ Upload blocked by quick scan findings:` (malicious/signature mismatch blocked)
- `⚠️ Fail-open triggered:` (scanner unavailable but upload accepted)
- `🛡️ Performing deep scan using engine=...` (deep scan execution)
- `☣️ ClamAV detected threat...` / `✅ ClamAV clean result...` (deep scan outcomes)
- `🗜️ Image compressed...` / `🗜️ Video compressed...` (compression applied)
- `🚨 File moved to quarantine...` (quarantine action triggered)
