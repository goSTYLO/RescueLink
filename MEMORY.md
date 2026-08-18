# RescueLink Memory

## Incident detail routing (promoted responders)

- **Account role** (`user` vs `responder`) unlocks capabilities (Responder tab, accept alerts). It must **not** choose which incident detail screen to show from History.
- **Involvement** chooses the detail screen:
  - `reported` → citizen `IncidentDetailsScreen` (timeline, confirm resolution)
  - `accepted` → `ResponderIncidentDetailScreen` (response actions / read-only when resolved)
  - `both` → citizen view under All/Reported filters; responder view under Accepted filter
- History API: `GET /api/incidents/user/my?involvement=reported|accepted|all` returns an `involvement` field per row.
- `ResponderIncidentPreviewScreen` is only for **unaccepted pool** incidents (dashboard alerts), not History.

Added: 2026-08-16 — dual incident views after citizen-to-responder promotion.

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
