# Changelog

## 2026-10-02

- AI classification: Filipino street-fight wording (`nagsusuntukan`, `nag-aaway`, `rambol`, etc.) and English phrases such as “people fighting” now map to **Crime** in the keyword ranker, with false **Fire** dropped when the text has no fire words (same path as crash/lost-child at `bahay`). Model weights unchanged; low-confidence keyword replacement stays gated at 0.7.

## 2026-09-30

- Mobile incident details: the reporter can **Cancel report** or **Edit details** (description and map pin) until a responder is on scene. Cancel releases assigned teams and records status `cancelled`. Edits must stay inside Dagupan and recompute the barangay. Both actions are written to the audit log, including when a responder or volunteer filed the report.
- Mobile signup: password must match the server rule (8–128 characters, capital, number, special character) before Create Account continues. Retyping ignores trailing spaces, and a password the server rejects returns to the filled signup form instead of trapping the user on location verification.
- Mobile SOS countdown vibrates the phone motor for the full 5 seconds, one long pulse per second in time with the countdown number. The old haptic tick stayed silent when touch vibration was off.
- Mobile shake-to-SOS ignores a single bump. Faster phones were counting every accelerometer sample above the line as a new shake, so ordinary movement started the countdown. A trigger now needs two separate jolts, and the force line is 15 m/s².

## 2026-09-29

- Mobile password-updated screen: removed top-right Skip; simplified layout to match verified success; repaired white streak artifacts in `passwordupdated_illustration.png`.
- Mobile forgot-password flow: screens follow light/dark theme (system/app); text fields no longer force white fills so typed text stays readable; OTP/success/error cards use `GlassCard`.
- Mobile home: **Current Location** uses live GPS + reverse geocode (no longer hardcoded Dagupan). Outside Dagupan (or GPS unavailable) locks SOS, Report, shake, and Reports FAB; status card reflects Ready / Outside / unavailable. Dev bypass via `BYPASS_LOCATION_CHECK`.
- Audit log Excel export: only read the response as JSON on error — success path uses `blob()` once (fixes "body stream already read").
- Audit log Excel columns auto-size to content (min 10 / max 60 chars).
- Audit log revamp: department CRUD/units/personnel mutations are logged; `logDispatcherAction` also records **department-admin** and **department-head**. Citizen auth (register, login/logout, password, profile/avatar) and volunteer application submit are logged via `logUserAction` / `logUserActionByUser`. Audit Log UI shows plain-language actions; Excel export adds **Action code** + friendly **Area** columns for IT tracing.

## 2026-09-28

- Super-admin Departments → Responders create form: required **password** + **department** for mobile account (phone = contact number; no email). Inline validation for name/phone/password/department (password matches backend complexity). Backend `POST /api/responders` creates a login with password + phone only (`email` optional/null).
- Dept-admin Personnel → Responders create form aligned the same way; department is fixed to the signed-in admin’s department (read-only display, sent as `department_id`).
- Dept-admin Personnel: unassigned / new account responders stay in the assignable pool (scoped by `organization` = department name), so they can be assigned or re-added after team removal.
- Assign/remove team member now syncs `responders.team_name` so Responder Status stops showing “Unassigned” after assignment.
- Team member list API only returns `is_active = TRUE` rows so Remove in Assign Members actually disappears from the modal.
- Super-admin Team page lists Field Responders (`exclude_role` no longer drops `responder`) so accounts can be deactivated.
- Super-admin Team page: search (name/email/phone/department) plus role filter; **Active** / **Deactivated** tabs segregate inactive accounts; Reactivate restores access.

## 2026-09-27

- Insights: **Excel** and **PDF** download as files (`insights-{chart}-YYYYMMDD-HHmmss`, Asia/Manila). PDF uses html2canvas + jsPDF (one page per chart, on-screen colors); Excel remains data tables with data bars. Sticky filter bar; per-chart export icons. `GET /api/analytics/export.xlsx` (`sheet=` optional). CSV endpoint remains.
- Audit log: **Excel** export via `GET /api/audit-logs/export.xlsx` with Insights-style workbook chrome (navy header, gray column headers); filename `audit-log-YYYYMMDD-HHmmss.xlsx`.

## 2026-09-25

- Cloud Run STT: **local Faster-Whisper `medium` first**, HF API fallback (`STT_ENABLE_API_FALLBACK`); Dockerfile prefetches medium; deploy script and [`GCP_AI.md`](Documentation/backend/GCP_AI.md) aligned.
- Backend `AI_REQUEST_TIMEOUT` default **150s** (env override; legacy `AI_TRANSCRIPTION_TIMEOUT` still read).
- Mobile: **180s** timeout for `with-audio` only; cold-start submit copy; **55s** recording cap; snackbar when response is `ai_pending`.

## 2026-09-24 (continued)

- Mobile release builds: `pubspec.yaml` version sync + `RescueLink_App_<version>_<build>.apk` via Gradle (`android/app/build.gradle.kts`) and optional `build_release.bat` / `run_release.bat`.
- Deployed integration smoke: `Backend/scripts/smoke-deployed-e2e-once.js` + [`Documentation/HOW_TO_RUN.md`](Documentation/HOW_TO_RUN.md) § deployed backend ↔ AI.
- Cloud Run AI: `/health` exposes `load_error` + `weights_bytes`; startup awaits classifier load; entrypoint logs weight file size; [`GCP_AI.md`](Documentation/backend/GCP_AI.md) deploy uses **4Gi**, **warmup enabled**, Cloud Shell verification section.
- Cloud Run deploy: [`RescueLink AI/scripts/cloud-run-build-deploy.sh`](RescueLink%20AI/scripts/cloud-run-build-deploy.sh) + GCP_AI **Cloud Shell cheat sheet** (`deploy_cloud_run` is not a built-in command).
- GCP_AI **One-time setup**: enable Secret Manager, create `hf-api-token`, grant Cloud Run SA `secretAccessor`; deploy script enables API and checks secret exists.
- STT: HF API first with optional local Faster-Whisper fallback (`STT_ENABLE_LOCAL_FALLBACK`). Production Docker restores `faster-whisper` + prefetches `tiny`; Render Blueprint keeps local fallback off for 512Mi.
- Cloud Run deploy runbook: [`Documentation/backend/GCP_AI.md`](Documentation/backend/GCP_AI.md) (AI on GCP; backend stays on Render).
- Cloud Run startup: classifier loads after uvicorn binds (background thread); prod image bakes `emergency_model.pt` at build time so the container listens on `PORT` within the startup timeout.
- Production DB moved to Supabase **`ap-southeast-1`** (`RescueLink DB Singapore`); Render **`resquelink-backend`** already **`singapore`** — `DATABASE_URL` + `AI_SERVICE_URL` (Cloud Run) synced via Render MCP.
- Render `FRONTEND_URL` set to production dashboard [`https://rescue-link-front.vercel.app`](https://rescue-link-front.vercel.app) for CORS.
- Production uploads: private Supabase bucket `rescuelink-media` (Singapore) with local `uploads/` fallback; incident photos and avatars convert to WebP. Application IDs stay original files.
- Backend uses **pnpm** (`Backend/pnpm-lock.yaml`); Render build runs `corepack enable && pnpm install --frozen-lockfile`.
- `/health` reports Supabase Storage reachability; `pnpm check:storage` / `tests/storageIntegration.test.js` for local round-trip checks.

## 2026-09-24

- Slim Render AI Docker image: `requirements-prod.txt`, CPU `torch` only, HF Whisper API as the container default.
- Local install is unchanged: `pip install -r requirements.txt` and `.env.example` still use `STT_PROVIDER=local`.
- Classifier inference builds from backbone config + checkpoint (no second Hugging Face weight download). Whisper handler lazy-loads; `/health` includes `stt_ready`.
