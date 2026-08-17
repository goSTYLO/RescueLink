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
