# RescueLink Memory

## Frontend form validation (mobile + web)

- Phone inputs: digits only, max 11 chars, local PH format `09XXXXXXXXX` (`Validators.phoneInputFormatters` on mobile; `PhoneInput` / `inputUtils.js` on web). Backend `validatePhone()` stores local format; login lookup normalizes across `09` / `639` / `+639`.
- All password fields include show/hide toggles; mobile biometric enable uses shared `biometric_password_dialog.dart`.
- Name/notes fields use `maxLength` aligned with backend limits (100 names, 255 address, 500 notes).

Added: 2026-09-09 — consistent client-side validation across forms.

## Incident detail routing (personnel vs volunteer)

- **`responder`** (team personnel, e.g. `09003000003`): Assigned history, assigned nearby list, no Accept/Decline, always online (toggle hidden).
- **`volunteer`** (approved first-responder application): nearby pool, Accept/Decline, backup join, Online/Offline switch.
- Both can still report SOS/incidents. History API: `GET /api/incidents/user/my?involvement=reported|accepted|assigned|all`.
- **Involvement** chooses the detail screen:
  - `reported` → citizen `IncidentDetailsScreen`
  - `accepted` → volunteer `ResponderIncidentDetailScreen`
  - `assigned` → personnel detail with `isTeamAssignment: true`
  - `both` → citizen view under Reported; responder/volunteer view under Assigned/Accepted
- `ResponderIncidentPreviewScreen` is only for **unaccepted volunteer pool** incidents, not History.

Added: 2026-08-16 — dual incident views after citizen-to-responder promotion. Updated: 2026-09-09 — personnel Assigned vs volunteer Accepted.

## Multi-type AI classification (display vs dispatch)

- AI returns **ranked** `incident_types` (confidence descending) with **keyword promotion** for types below threshold when fallback keywords match transcription/text.
- Backend stores `incident_reports.incident_types TEXT[]` plus legacy `incident_type` (primary) and `secondary_classification`.
- **Dispatch, alerts, and type filters** use primary (`incident_type`) only; mobile/web show all types (`Medical · Fire`).
- Migration: `Backend/migrations/add_incident_types_array.sql`

Added: 2026-08-17 — fire/medical misclassification mitigation without multi-type dispatch.

## AI confidence display (model vs STT vs keywords)

- **Primary model confidence** = score for the primary incident type (not global max); stored in `ai_classifications.confidence_score` and `incident_reports.primary_confidence`.
- **STT confidence** = Whisper language probability; stored in `stt_confidence` on incident + classification rows.
- **Keyword flags**: `keyword_promoted` (rank-and-promote path) vs `fallback_used` (full keyword fallback when model max < 0.7).
- Keyword matching uses **word boundaries** so `baha` does not match inside `bahay`.
- Tagalog collision/injury terms (`nagbanggaan`, `sugat`) promote Accident + Medical; unsupported **Fire** model scores are dropped when those keywords are present.
- Migration: `Backend/migrations/add_ai_confidence_metadata.sql`

Added: 2026-08-17 — clearer confidence UI and bahay/baha fix.

## Volunteer status vs incident lifecycle (dispatcher dashboard)

- Mobile volunteers update **`responder_status`** (`Assigned` → `En Route` → `On Scene` → `Resolved`).
- Dispatcher dashboard lists/filters primarily on **`incident.status`** (`pending`, `verified`, `in_progress`, `resolved`, `closed`).
- When a volunteer marks **Resolved**, backend also sets `status = 'resolved'` and emits **`incident:status_updated`** (plus `responder:status_changed`).
- List API includes `responder_status`, `accepted_by_user_id`, `accepted_at` for volunteer progress badges on web.
- Shared WS payload helper: `Backend/src/utils/incidentEvents.js`.

Added: 2026-08-17 — volunteer resolve sync to dispatcher dashboard.

## Backup requests + volunteer response (dispatcher dashboard)

- Mobile `POST /api/incidents/:id/backup` creates a `backup_requests` row (`status`: `pending` | `acknowledged`) and emits **`responder:backup_requested`** with enriched payload (`backup_request_id`, `target`, `notes`, `requested_by_name`, incident metadata).
- Staff notifications fan out to dispatcher/admin/supervisor and users in **assigned departments** — not stored on the requesting volunteer.
- **`PATCH /api/incidents/:id/backup/:backupId/acknowledge`** (dispatcher/admin/supervisor only) sets `acknowledged_*` and emits **`responder:backup_acknowledged`**. Acknowledgement does **not** clear the web backup badge — badge stays **BACKUP ACKNOWLEDGED** until an official backup team is assigned (`assigned_team_name`).
- List API returns `has_pending_backup` (strict pending), `has_open_backup_request`, `active_backup_request_id`, `open_backup_status`, `latest_backup_status`, `pending_backup_target`, `pending_backup_broadcast_count`.
- **`GET /api/incidents/:id`** (and with-AI variant) includes `has_pending_backup` + `latest_backup_status`; volunteer **acceptor** (`accepted_by_user_id`) may read the incident they accepted.
- Web: bell titled backup items; **`BACKUP REQUESTED`** / **`BACKUP ACKNOWLEDGED`** badge while `has_open_backup_request` and no team assigned; admin **Acknowledge** + **Notify Department**; dept admin **Assign Team** via dialog. **Send Backup** stays visible after ack until team assigned.
- Mobile citizen incident details: amber info line on status card while backup pending; refetch on `responder:backup_requested` / `responder:backup_acknowledged`.
- Mobile volunteer incident details: loads via `getIncidentById` (acceptor access); **Backup requested** / **Backup acknowledged** / **Backup unit dispatched** chips; hides **Request Backup** while pending; WS refetch on backup, dispatch, and status events. Volunteer acceptors receive `incident:dispatched` over WebSocket even when not in the assigned department.
- **Volunteer Response** tab mirrors main filters/pagination; columns include volunteer name/phone/status and **distance from viewer department HQ to incident** (CDRRMO HQ fallback for dispatchers without a department).
- **Nearby volunteer backup (2026-08-18):** `target` `nearby_responders` or `both` emits **`responder:backup_alert`** to online volunteers in radius/specialization. Join via **`POST .../backup/:backupId/join`** (`backup_responses`); joiner status via **`PATCH .../backup/:backupId/responder-status`**. Does not replace primary acceptor; staff ack/dispatch stays independent. **`GET /api/incidents/:id`** attaches `backup_volunteers[]`; lists include `backup_volunteer_count`, `pending_backup_target`, `pending_backup_broadcast_count`.

Added: 2026-08-18 — backup acknowledge lifecycle + volunteer response web tab + incident-details backup UI (web Send Backup, mobile chips). Updated: 2026-08-18 — nearby volunteer backup fan-out + join APIs.

## Incident close (dispatcher/admin force-close)

- Lifecycle: `pending → verified → in_progress → resolved → closed`.
- **Resolve** via department dispatch (`PATCH /status resolved`) or volunteer mobile (`PATCH /responder-status Resolved`, which also sets `status = resolved`).
- **Standard close:** reporter confirms on mobile (`POST /confirm-resolution`) → auto `closed` with `closure_method: auto_from_reporter_confirmation`.
- **Force close:** dispatcher or admin/super-admin on web when incident is **effectively resolved** — lifecycle `resolved` **or** volunteer `responder_status = Resolved` ([`isIncidentEffectivelyResolved`](Frontend/Web/dispatcher_dashboard/src/core/utils/incidentDisplay.js)). Uses `PATCH /status closed` with `allow_force_close`; backend normalizes desynced volunteer rows before closing.
- Optional closure dialog fields persist as `closure_notes` + `closure_method`.

Added: 2026-08-18 — dispatcher close for resolved / volunteer-resolved incidents.

## Hybrid auto team assignment (2026-09-07)

- After create (SOS / high-confidence AI audio) the backend picks **one** matching available team via `autoDispatchService`. SOS always maps to CDRRMO (`drrmo`). Low-confidence, text-only, and unmapped types persist a **suggestion** (`auto_assignment_status=suggested`) for one-click confirm.
- If the mapped department is known but no team is free: **department-only notify** (`dept_notified` → `verified`). Auto-applied teams go `in_progress` and leave the pending triage queue.
- Type → department is `departments.supported_incident_types` (admin-extensible). Human confirm/reassign never silent-reroutes an already-teamed incident.
- Idempotency: a second primary team create **409** `PRIMARY_TEAM_ALREADY_ASSIGNED` unless `POST /api/dispatches/reassign-team`. Escalation decline/cancel deletes **only** `responder_source=escalation` rows.
- Team members reuse volunteer stepper UI but write `dispatches.response_status` + a named coordination note. Team-member Resolved does **not** resolve the incident. Volunteer `Request Backup` is disabled once a formal `assigned_team_name` exists.
- Mobile: `GET /api/responders/me/assigned-incidents`, `GET /api/responders/me/team`, `PATCH /api/dispatches/me/status`. OneSignal copy: “Your team was assigned…”.
- Audit (2026-09-07): auto-apply now walks `pending → in_progress` (was swallowed by the lifecycle machine). Empty-team race after pick falls through to CDRRMO/dept notify. Event payload no longer treats `suggested_team_name` as assigned. Dispatch `response_status` is title-cased so the mobile stepper can advance. Add-department is department-only (does not replace the primary team). Undo-notify resets `auto_assignment_status` when no dispatches remain. Queue list API now includes auto-assignment fields + primary `assigned_team_name` so dashboard badges and Assign-button gating work.

## SOS activation (2026-09-08)

- Mobile SOS no longer requires a 3-second hold. **Tap** the SOS tile or **shake** the phone while the logged-in home shell is foreground (any tab) to start the existing **5-second cancel overlay**, then submit via `reportEmergency()` (no AI/audio). A **2-second heavy haptic pulse** plays when the cancel overlay opens (tap or shake).
- Shake uses `sensors_plus` user accelerometer (~12 m/s² spike threshold, 2 spikes / 500ms); tune in field if pocket false-positives appear.

Added: 2026-09-08 — tap/shake SOS replaces hold-to-activate.

## Seeded account mobile login (2026-09-08)

- Mobile auth is phone + password only; web staff uses email. Seeded users store E.164 `+639…` phones; `User.findByPhone` compares canonical digits so `639…`, `+639…`, and `09…` all match.
- Full phone credentials: `Documentation/backend/ACCOUNTS.md`.

Added: 2026-09-08 — phone format normalization for seeded mobile login.

## Responder vs volunteer RBAC (2026-09-09)

- Team personnel keep `users.role = responder`. Approved applications promote to `volunteer`, not `responder`.
- Volunteer-only: nearby `/incidents/responder/active`, preview, accept/decline, volunteer `responder-status`, backup join APIs, `responder:incident_alert` / `backup_alert` WS.
- Personnel-only: `/responders/me/assigned-incidents`, `/me/team`, `PATCH /dispatches/me/status`. Phone login forces `responder_online = true`.
- Super-admin Team **Field Responder** creates a mobile personnel account (phone + department). Dept Add Responder may attach email/password/phone for the same.
- Migration `add_volunteer_role.sql` remaps non-team `responder` users to `volunteer`.

Added: 2026-09-09 — split mobile field roles.
