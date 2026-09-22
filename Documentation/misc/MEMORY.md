# RescueLink Memory

## Dispatcher web UI (2026-09-22)

- Dispatcher pages use Ant Design (shell, compact `Card`/`Table`, forms, modals). Insights chart panels and the incidents table use the same compact cards and shared `buildAntdTheme`; filter controls still use the legacy UI `Select`/`Input` kit. The shared sidebar/header is Ant Design for every role. Brand color stays `#134178` with the existing light/dark mode. Feedback dialogs go through `alertUser` (`modal` / `message` / `notification`) instead of SweetAlert2. The shell is pinned to the viewport (only the page scrolls). Light mode uses grey chrome (`#e5e7eb`) and a grey page (`#f3f4f6`); dark mode keeps navy containers. Selected tabs use amber (`#b45309`). Responder and team availability tags share one map: available green, standby gold, busy red, off-duty grey. Volunteer on-incident labels use the same helper (assigned blue, en route gold, on scene orange, resolved green).

Added: 2026-09-22 — Ant Design conversion outside Insights.

## Seed-db analytics demo (2026-09-22)

- `npm run seed-db` (Backend) seeds ~300 incidents over ~90 days with lifecycles for Insights: dispatches + on-scene history, resolve/close timestamps, SOS/voice/text mix, volunteer `accepted_at`, escalation funnel rows, exception slices (reassign, mismatch, backup, declined), duplicate cluster, `ai_classifications`, coordination note, `department_units` / personnel, and `incident_unit_usage`. Flags: `--count=N`, `--days=N`. Voice rows still need sample audio under `RescueLink AI/test` or `Backend/uploads/incidents`.

Added: 2026-09-22 — analytics-ready seed-db.

## Insights / analytics (2026-09-19)

- Web `/insights` is one scrollable CAD layout (its own Ant Design cards, stats, progress, and tables; other dispatcher pages use Ant Design too). It **auto-refreshes**: debounced refetch on incident WebSocket events (~2s) plus backup poll (60s, 120s when WS connected); header shows Live / last updated. Analytics GET helpers share in-flight requests so React Strict Mode remounts do not double-hit overview/incidents/geojson. Super Admin defaults to all departments with a picker; **`department_id=volunteers`** scopes to incidents with a primary volunteer acceptor (`accepted_by_user_id`), not a DB department row. City-wide department comparison includes a **Volunteers** row. Department Admin is locked to `users.department_id` (cannot pick Volunteers).
- Headline clocks: first action (LEAST of first dispatch, `accepted_at`, first escalation, first coordination note), dispatch (`created_at` → first dispatch, dept-scoped when picked), arrival (`created_at` → first On Scene), resolution (`created_at` → `COALESCE(resolved_at, closed_at)`). p50/p90/p95 + n. Null clocks excluded.
- Internal SLAs (not NFPA): dispatch ≤ 8 min, arrival ≤ 10 min. Overdue: still open at range end and created > 30 min earlier. Unserved: no dispatch, no escalation, no volunteer `accepted_at`.
- Demand: types / barangays (each row includes top 3 incident types) / type×barangay / channels, Leaflet choropleth from `GET /api/analytics/barangays.geojson` (`NAME_3`). Operations: exceptions from real events only, escalation funnel, unit usage counts (no deployment duration), outcomes donut.
- Concurrent: hour buckets if range ≤ 90 days, else day. City-wide department clocks mark primary vs supporting. CSV is PII-safe; PDF is browser print. Each metric has a `?` definition.

Added: 2026-09-19 — Insights v2 scrollable dashboard.

## Volunteer nearby amber when app is background/killed (2026-09-18)

- Nearby volunteer alerts were WebSocket-only (`responder:incident_alert`). Background or killed app never got the emergency-channel OneSignal, so no outside-app alarm.
- Same eligibility as the volunteer pool (`findEligibleNearbyVolunteerUserIds`: online, specialization, radius, not the reporter) now also gets critical push (`alert_kind: volunteer`). Backup nearby uses `alert_kind: backup`.
- Volunteer popup stays `IncidentAlertModal`. Foreground still skips the OS tray so the sheet owns the WAV; background/killed uses NSE + emergency channel like personnel.
- Volunteer tray tap opens `ResponderIncidentPreviewScreen` (not citizen GET `/incidents/:id`, which 403s before accept).

Added: 2026-09-18 — volunteer outside-app amber.

## Web push click auth + shorter copy + foreground amber (2026-09-18)

- Web JWT is in `localStorage` and `sessionStorage` so a OneSignal `web_url` new tab can load `/incidents/:id` without `No authentication token found`. Logout still clears both. SPA click navigates in the open dashboard tab.
- OneSignal titles/bodies shortened in `formatPushTitle` / `formatPushBody` / `formatCriticalPushTitle` (`Respond now`, `Your team is up`, `#123 Fire in Pantal — go now`).
- Mobile app-open amber: OneSignal foreground listener starts `EmergencyDispatchAlertCoordinator` (not WebSocket-only). Emergency channel plays `emergency_alert` on Alarm volume again; FGS player remains backup.
- App-open staff critical: `preventDefault` skips the tray so the red modal owns the WAV; Open/Dismiss also cancels emergency-channel notifications + FGS via `rescuelink/amber`. Volunteers keep `IncidentAlertModal` and play/stop the same helper. Tapping the tray consumes that `report_id` so WS reconnect does not stack the in-app modal under incident details, and `AmberAlertSound.stop()` invalidates in-flight `play()` so the WAV cannot outlive the modal.
- Killed-app amber: NSE starts `AmberAlertPlayerService` when `RescueLinkUi.resumed` is false (FCM-woken process importance is not treated as UI). Ensures emergency channel + `setChannelId` so the tray is not the default/updates sound.
- Suggested-team confirm UI names the team on the badge, details card, button, and Swal (`Needs confirm: Alpha`).

Added: 2026-09-18 — push click auth, short copy, foreground sound, stop-on-interact, volunteer amber, suggested team label.

## Continuous amber WAV (2026-09-11)

- Replaced gap-alternating two-tone (cut/continue) with continuous dual-tone 853+960 Hz for full 60s.
- Native player holds alarm audio focus + MediaPlayer wake mode; skips restart if already playing.
- Vibe uses short 400/200 pulse (no 5s silent gaps). Stops on interaction or 60s.

Added: 2026-09-11 — continuous 1-minute amber blare.

## Amber closed-app native player (2026-09-11)

- Swiped-away / process-dead amber: tray often silent even when channel is correct; background+sleep still worked via tray.
- Fix: `NotificationServiceExtension` starts `AmberAlertPlayerService` (MediaPlayer `USAGE_ALARM` + vibe, ~60s, short FGS + wake lock) when UI is not foreground.
- Emergency channel is visual-only (no sound/vibe) to avoid double-blare; Flutter modal still owns foreground.
- Stop player on `MainActivity` onCreate/onResume (notification tap / open app).

Added: 2026-09-11 — native amber player for fully closed app.

## Remade emergency_alert.wav (2026-09-11)

- Regenerated loud WEA-style two-tone (853/960 Hz) ~60s mono PCM @ 22.05 kHz into `res/raw`, `assets/sounds`, and iOS `Runner`.
- Regenerator: `Frontend/Mobile/tools/_make_emergency_alert_wav.py`. Cold-start app after install so sticky channel picks up the new raw resource.

Added: 2026-09-11 — remake amber tray/foreground WAV.

## Amber sleep / force-stop blare (2026-09-11)

- Emergency channel now `IMPORTANCE_MAX` + `setBypassDnd(true)` + public lockscreen (HIGH alone often silent in sleep/Bedtime).
- `NotificationServiceExtension` sets `CATEGORY_ALARM` + `setFullScreenIntent` for `data.critical` so tray still wakes when Flutter is dead.
- App `build.gradle.kts` adds `com.onesignal:OneSignal:5.9.9` so the extension compiles in `:app` (matches onesignal_flutter).
- Tray sound follows **Alarm** volume; Android 14+ may need Full screen intents special access.

Added: 2026-09-11 — fix silent amber when app closed / phone asleep.

## Amber alert max 1 minute (2026-09-11)

- Foreground amber modal stops sound/haptics and auto-dismisses after **60s**, or immediately on Open / Dismiss / system notification tap (`dismissActiveAlert`).
- Tray uses ~60s `emergency_alert.wav` + channel vibe `0,1000,5000` repeating (~60s); tapping the notification cancels tray playback (OS).

Added: 2026-09-11 — amber duration cap + stop on notification click.

## Amber killed-app channel routing fix (2026-09-11)

- Critical OneSignal REST now uses `existing_android_channel_id` = MainActivity channel `724e011a-…` (not dashboard `android_channel_id` / `OS_<uuid>`).
- Quiet pushes use `existing_android_channel_id: rescuelink_updates`.
- `MainActivity` also deletes legacy `OS_724e011a-…` on cold start.
- Replaced mislabeled ~61s MP3-as-`.wav` with a short real RIFF WAV in `res/raw`, `assets/sounds`, and iOS Runner.

Added: 2026-09-11 — fix killed/asleep amber sound+vibe channel mismatch.

## Notification copy + wrong-audience fix (2026-09-11)

- Quiet `incident:dispatched` push never says "Your team…" even when `assigned_team_name` is set; only critical team audience gets that wording.
- Accept inbox row now selects `user_id` and notifies the reporter only (no fallback to the accepting volunteer).
- Push titles/bodies, in-app messages, backup/application copy, and amber modal text: plain language, no emojis, humanized statuses.
- Opening the notification bell once marks all as read (mobile + web) and clears local WS unread badges.

Added: 2026-09-11 — clean notification recipients, copy, and mark-all-on-bell.

## Dept admin mobile: responder-like queue + reassign/resolve (2026-09-11)

- Department ops **Reports** tab shows the dept incident queue (responder-like list chrome); separate **Incidents** tab removed.
- Detail reuses responder layout (team banner, map, info card) without personnel stepper.
- Mobile actions: **Assign team** (`POST /api/dispatches`), **Reassign team** (`POST /api/dispatches/reassign-team`, reason ≥10), **Mark resolved** (`PATCH /api/incidents/:id/status` `{status:'resolved'}`) when status is In Progress + team assigned — same gates as web.
- `DepartmentOpsService.reassignTeam` / `resolveIncident`; `isValidReassignReason` unit-tested.

Added: 2026-09-11 — dept mobile assign/reassign/resolve parity.

## Amber killed-app tray sound + invalid_aliases (2026-09-11)

- Killed / not-running amber sound+vibe = OS tray + Android channel (app need not be open); requires OneSignal subscription for that External ID.
- `MainActivity` again **delete+recreates** emergency channel `724e011a-…` on cold start (`emergency_alert`, vibe `0,400,200,400`) so sticky bad settings get repaired. Hot reload is not enough.
- `sendPushToUsers` dedupes user ids via `normalizePushUserIds` before `include_aliases`; `invalid_aliases` log hints to open app + `OneSignal.login`.
- Dashboard Vibration Custom must still be ms pattern `0,400,200,400` — not the word `custom`.

Added: 2026-09-11 — killed-app tray sound fix + alias dedupe.

## Amber dashboard channel + foreground blare (2026-09-11)

- OneSignal dashboard channel `724e011a-…` matches REST `android_channel_id` (not `existing_android_channel_id`).
- Dashboard Vibration Custom must be ms pattern `0,400,200,400` — never the word `custom`.
- Foreground amber modal loops `assets/sounds/emergency_alert.wav` via `audioplayers` (stops on Open/Dismiss/dispose); haptics kept.

Added: 2026-09-11 — restore amber custom sound/vibe + modal asset.

## OneSignal HTTP 400 url + web_url (2026-09-11)

- OneSignal rejects `url` when `web_url` is also set (`Remove url field when setting app_url or web_url`).
- `buildNotificationBody` now sends only `web_url` (payload.url); mobile deep-link stays in `data.report_id`.

Added: 2026-09-11 — fix push send 400 that blocked all tray notifications.

## Quiet tray push priority + Android channels (2026-09-11)

- Quiet OneSignal bodies now always set `priority: 10`, `android_visibility: 1`, `android_sound: 'default'` (critical still uses emergency channel + `emergency_alert`).
- `MainActivity` delete+recreates emergency channel (`USAGE_ALARM` + vibe `0,400,200,400`) and `rescuelink_updates` HIGH for status trays.
- Reporter testing on emulator: do not delete the emulator subscription; Send test to that sub while app is backgrounded; Google Play AVD required for FCM.

Added: 2026-09-11 — tray sound/vibration for quiet + sticky channel fix.

## Team assign amber includes dept admin/head (2026-09-11)

- `getCriticalDispatchRecipients` on team assign unions account-backed team `user_id`s with `department-admin` + `department-head` for assigned depts (not all department field responders).
- Foreground blare no longer skips dept ops on team assign; dept ops title is `EMERGENCY — Team assigned`.

Added: 2026-09-11 — dept admin amber when team already assigned.

## OneSignal send proof + post-login optIn (2026-09-10)

- Logcat `GET .../iams` / refresh-user is **not** a received push.
- Permission is requested **after** `OneSignal.login`; `ensureOptedInIfAllowed` + subscription observer heal `optedIn=false` once OS permission is true.
- Backend `sendPushToUsers` logs `skipped: OneSignal not configured` and `skipped: no eligible after prefs filter` (no longer silent). `NODE_ENV=test` still skips quietly.
- Verify: dashboard test push to live Subscription ID; then Notify Dept / status change and require both `[emitIncidentEvent] Push …` and `[oneSignalService] OneSignal ok … recipients=`.

Added: 2026-09-10 — prove send path + opted-out recovery.

## Dispatch push targeting: empty-team fallthrough + resident status (2026-09-10)

- `getCriticalDispatchRecipients`: `kind: 'team'` only when account-backed team `user_id`s exist; `assigned_team_name` alone no longer returns empty critical (falls through to dept amber).
- `getIncidentAssignedDepartmentIds` joins departments with `LOWER(TRIM(code))` so case mismatch does not drop dept recipients.
- Volunteer `updateResponderStatus` (En Route / On Scene / Resolved / …) always emits `incident:status_updated` so the reporter gets a quiet OneSignal push (not only on Resolved).
- Automation: suggestion-only → no dispatch push; auto/manual team → amber to team members **and** dept admin/head, quiet to reporter + others; Notify Dept → dept amber.

Added: 2026-09-10 — fix missing resident quiet + dept amber after subscribe works.

## OneSignal ghost subscriptions + tray miss (2026-09-10)

- Dashboard **Delivered** ≠ this phone showed a tray notification; External ID fan-out can hit stale Subscribed rows.
- Mobile Exit path now awaits `OneSignal.logout` (same as Settings logout) so JWT clear does not leave an identified subscription dangling.
- `effectivePushEnabled` defaults prefer-push to **true** when unset; requires OS permission + not opted out when SDK is ready (`isPushEnabled` no longer returns false while OS already allowed).
- Citizen permission dialog marks prompted only after **Turn On** (`requestPermission`) or when already enabled — **Not Now** no longer permanently skips the prompt.
- Debug logs after login/permission: `externalId`, `subscriptionId`, `optedIn`, `tokenPresent`; subscription observer in debug init.
- Android `MainActivity` delete+recreates emergency channel `724e011a-…` and `rescuelink_updates` HIGH on cold start.

Added: 2026-09-10 — delivered-but-invisible / duplicate subscription fixes.

## Amber audience on Notify Dept

- Critical / amber push on **Notify Dept** targets `department-admin`, `department-head`, and `responder` (field personnel) in the assigned department.
- **Assign Team** amber targets account-backed team members **plus** dept admin/head; foreground blare shows for dept ops on team assign too.
- Foreground blare (`EmergencyDispatchAlertCoordinator`) matches: responders get dept modal on notify and team modal when assigned; dept ops get both notify and team assign.
- `emitIncidentEvent` logs `Push critical userIds=[…]` / `Push quiet userIds=[…]` before OneSignal send.
- Reporter fallback SQL uses `incident_reports` (not `incidents`).
- Retest amber on staff login (`09001000011`), not citizen reporter phones.

Added: 2026-09-10 — expand critical dept recipients + push target logs; 2026-09-11 team assign includes dept ops.

## OneSignal push delivery observability + channel sound

- Backend `interpretOneSignalResponse` logs notification `id` / `recipients` and treats HTTP 2xx with `recipients: 0` or `errors` as a logged failure (still best-effort, never breaks incident APIs).
- REST body targets User Model only: `include_aliases.external_id` + `target_channel: push` (no legacy `include_external_user_ids`).
- After `OneSignal.login`, mobile re-`optIn()` when OS permission + push preference allow (logout can leave subscription opted out).
- Dashboard Android channel sound must be **`emergency_alert`** (no `.wav`); vibration Custom ms pattern `0,400,200,400` — not the word `custom`. Reinstall app after channel edits.
- Amber critical push targets dept staff (admin/head/responder) on notify, or team members on assign; citizens never get amber.

Added: 2026-09-10 — push delivery logging, optIn-after-login, channel sound docs.

## OneSignal External ID on login

- Backend push targets `external_id` = stringified `user_id` only (not stored `onesignal_player_id`).
- Mobile must call `OneSignal.login(userId)` on **every** interactive `LoginSuccess` (AuthNavigator), not only cold-start `_restoreSession`. Logout clears the link via `OneSignal.logout`.
- `AuthService._cacheUserProfileFields` persists `user_id` (via `parsePositiveUserId`) on login/profile so `getUserId()` works without JWT parse.
- Verify: logout → login (no app kill) → OneSignal Audience shows External ID; then dept-notify delivers.

Added: 2026-09-10 — fix missing External ID after interactive login.

## Frontend form validation (mobile + web)

- Phone inputs: digits only, max 11 chars, local PH format `09XXXXXXXXX` (`Validators.phoneInputFormatters` on mobile; `PhoneInput` / `inputUtils.js` on web). Backend `validatePhone()` stores local format; login lookup normalizes across `09` / `639` / `+639`.
- All password fields include show/hide toggles; mobile biometric enable uses shared `biometric_password_dialog.dart`.
- Name/notes fields use `maxLength` aligned with backend limits (100 names, 255 address, 500 notes).

Added: 2026-09-09 — consistent client-side validation across forms.

## Team assignment display (reporter + web parity)

- Incident GET attaches `assigned_team_roster` (primary team members + per-member `response_status`) and enriched `dispatches` (`responder_name`, `responder_source`).
- Reporter mobile **Assigned Department** card shows department, assigned team, roster, and **Assisting Dept** only when `responder_source = escalation`.
- Auto team dispatch sets member dispatch status to **En Route**; personnel detail auto-bumps legacy `Assigned` rows on open.
- Personnel status updates emit `responder:status_changed`; WS delivers to assigned team personnel by dispatch join (not department_id alone).

Added: 2026-09-10.

## Incident detail routing (personnel vs volunteer)

- **`responder`** (team personnel, e.g. `09003000003`): Assigned history, assigned nearby list, no Accept/Decline, always online (toggle hidden).
- **`volunteer`** (approved first-responder application): nearby pool, Accept/Decline, backup join, Online/Offline switch.
- Both can still report SOS/incidents. History API: `GET /api/incidents/user/my?involvement=reported|accepted|assigned|all`.
- **Involvement** chooses the detail screen:
  - `reported` → citizen `IncidentDetailsScreen`
  - `accepted` → volunteer `ResponderIncidentDetailScreen`
  - `assigned` → personnel detail with `isTeamAssignment: true`
  - `both` → citizen view under Reported; responder/volunteer view under Assigned/Accepted
- Resolved/closed assigned incidents stay on `ResponderIncidentDetailScreen` in **read-only** mode (`ReportStatusUi.isResponderDetailReadOnly`). Personnel deep links load via `GET /api/incidents/:id` when the incident is no longer in the active assigned list.
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
- **Resolve** via department dispatch (`PATCH /status resolved`) or volunteer mobile (`PATCH /responder-status Resolved`, which also sets `status = resolved`). Web department admin/head fill the same Close Incident dialog as super admin; submit still marks `resolved` and waits for citizen confirmation.
- **Standard close:** reporter confirms on mobile (`POST /confirm-resolution`) → auto `closed`. If department staff already saved `closure_method` / `closure_notes` at resolve time, those are kept (`COALESCE`); otherwise `closure_method` is `auto_from_reporter_confirmation`.
- **Force close:** dispatcher or admin/super-admin on web when incident is **effectively resolved** — lifecycle `resolved` **or** volunteer `responder_status = Resolved` ([`isIncidentEffectivelyResolved`](Frontend/Web/dispatcher_dashboard/src/core/utils/incidentDisplay.js)). Uses `PATCH /status closed` with `allow_force_close`; backend normalizes desynced volunteer rows before closing.
- Optional closure dialog fields persist as `closure_notes` + `closure_method` on force-close **and** on department resolve.

Added: 2026-08-18 — dispatcher close for resolved / volunteer-resolved incidents. Updated: 2026-09-18 — department web Mark Resolved reuses the close dialog and persists notes while waiting for citizen confirm.

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
- Volunteer-only: nearby `/incidents/responder/active`, preview, accept/decline, volunteer `responder-status`, backup join APIs, `responder:incident_alert` / `backup_alert` WS plus critical OneSignal for background/killed.
- Personnel-only: `/responders/me/assigned-incidents`, `/me/team`, `PATCH /dispatches/me/status`. Phone login forces `responder_online = true`.
- Super-admin Team **Field Responder** creates a mobile personnel account (phone + department). Dept Add Responder may attach email/password/phone for the same.
- Migration `add_volunteer_role.sql` remaps non-team `responder` users to `volunteer`.

Added: 2026-09-09 — split mobile field roles.

## Edit profile (name + photo)

- `users.profile_image` stores a server-side path; API exposes `has_profile_image` only.
- `PATCH /api/auth/me` accepts optional `firstName`, `lastName`, `address` (partial update — saving name does not clear address).
- Avatar: `POST/GET/DELETE /api/auth/me/avatar` (auth required; files under `uploads/avatars/`).
- Mobile: Settings profile card → Edit Profile (name + photo). Phone/barangay stay in Account Information.
- Web: Profile page inline Edit; header chip shows photo or initials (no hardcoded illustration).

Added: 2026-09-10.

## Amber-style OneSignal + dept-admin mobile (2026-09-10)

- `incident:dispatched` sends a **critical** OneSignal push to dept-admin/head **and department `responder`s** (dept-only notify) or assigned team members + dept-admin/head (team assign). Quiet push goes to everyone else **except** unassigned field responders (a silent tray tap was 403).
- Field `responder` GET `/api/incidents/:id` is allowed when they have a dispatch row **or** their department has a dispatch on the incident (dept-only notify). Mobile personnel push-tap always opens team incident detail, never citizen GET.
- Critical payload: Android channel `724e011a-e821-4e40-a810-9c175737a997`, sound `emergency_alert`, `ios_interruption_level: time_sensitive`.
- Mobile: `department-admin` / `department-head` get the dept queue on the **Reports** tab (assign / reassign / resolve). Foreground blare modal on WS dispatch for ops/personnel. Staff roles auto-request push permission.
- Setup checklist: [Documentation/guides/ONESIGNAL_AMBER_ALERT_SETUP.md](../guides/ONESIGNAL_AMBER_ALERT_SETUP.md).

Added: 2026-09-10 — amber alerts + dept ops mobile.
