# OneSignal Amber-style Emergency Alerts — Dashboard Setup

You already registered the RescueLink app in OneSignal. Finish these dashboard and device steps so **department notify** and **team assign** can blare like an amber alert.

Related code: `Backend/src/services/oneSignalService.js` (`critical: true` payload), `Frontend/Mobile` channel + `emergency_alert` sound.

---

## 1. Confirm app credentials in `.env`

### Backend (`Backend/.env`)

```env
ONESIGNAL_APP_ID=<your OneSignal App ID>
ONESIGNAL_REST_API_KEY=<REST API key — prefer os_v2_… Keys>
```

### Mobile (`Frontend/Mobile/.env`)

```env
ONESIGNAL_APP_ID=<same App ID>
```

Restart backend and rebuild/reinstall the mobile app after changes.

---

## 2. External User IDs (required)

RescueLink targets users with **`external_id` = internal `user_id`** (string).

In OneSignal:

1. **Settings → Platforms** — confirm Android (FCM) and/or iOS are configured.
2. Ensure **External ID / aliases** are enabled for your app (OneSignal User Model).
3. On device login, the app calls `OneSignal.login("<user_id>")` from AuthNavigator `LoginSuccess` (and again on cold-start session restore). Verify in **Audience → Users** that a subscribed device shows the correct External ID after logging in as e.g. `09001000011` (dept admin) or `09003000003` (Rescue Alpha) — **without** force-killing the app.

Without External ID linkage, critical pushes never reach the phone.

---

## 3. Android emergency channel

Backend sends:

| Field | Value |
|-------|--------|
| `existing_android_channel_id` | `724e011a-e821-4e40-a810-9c175737a997` (app-created in `MainActivity`) |
| `android_sound` | `emergency_alert` |
| `priority` | `10` |

Do **not** use REST `android_channel_id` for amber — that targets the OneSignal **dashboard** category (on-device often `OS_<uuid>`), which `MainActivity` does not repair. Killed/asleep sound+vibe then come from a sticky dashboard channel instead of the app channel.

### In OneSignal dashboard

Dashboard category is optional for amber once REST uses `existing_android_channel_id`. If you keep a dashboard channel for manual test sends:

1. Open your app → **Settings → Platforms → Google Android (FCM)**.
2. Emergency **Notification Channel** (manual composer only):
   - **Channel ID:** `724e011a-e821-4e40-a810-9c175737a997`
   - **Name:** RescueLink Emergency (or similar)
   - **Importance:** Urgent (or High)
   - **Sound:** Custom — enter **`emergency_alert`** with **no file extension** (not `emergency_alert.wav`; Android `res/raw` resource name has no extension)
   - **Vibration:** Custom with ms pattern **`0,1000,5000,1000`** (0 delay, vibrate 1s, pause 5s, vibrate 1s — app channel repeats this for ~60s). Do **not** type the word `custom` as the pattern — that is invalid and yields a quiet/wrong channel.
   - Enable badges; enable bypass DND **if** the dashboard/OEM option exists (behavior varies by Android version)

After changing Sound/Vibration, click **Update**, then **cold-start the app once** (or uninstall/reinstall). Sticky channels do not update in place; `MainActivity` delete+recreates the emergency channel (and removes legacy `OS_724e011a-…`) on every cold start so killed-app tray amber keeps custom sound + vibe. Hot reload is not enough.

### In the app repo (already shipped)

- Sound file: `Frontend/Mobile/android/app/src/main/res/raw/emergency_alert.wav` (tray) and `Frontend/Mobile/assets/sounds/emergency_alert.wav` (foreground modal) — ~**60s** real RIFF WAV; amber stops at 1 minute or when the user opens/dismisses / taps the notification
- Manifest: `POST_NOTIFICATIONS`, `VIBRATE`, `USE_FULL_SCREEN_INTENT`
- `MainActivity` **deletes + recreates** channel `724e011a-…` on every cold start (`IMPORTANCE_MAX` / Urgent, `setBypassDnd(true)`, public lockscreen, **`emergency_alert` on the Alarm stream**) and deletes `OS_724e011a-…` if present
- Foreground (app open): OneSignal `addForegroundWillDisplayListener` starts the same amber modal as WebSocket `incident:dispatched`. Critical staff pushes call `preventDefault` (no tray) so the modal owns the WAV; tapping Open/Dismiss stops `audioplayers` and cancels the emergency-channel tray / FGS. Volunteers keep the old `IncidentAlertModal` and play/stop the same `emergency_alert.wav`. Tapping a tray notification opens the incident and **consumes** that report so the in-app modal does not start again on resume.
- `NotificationServiceExtension` intercepts critical pushes (`data.critical: true`), sets `CATEGORY_ALARM` + full-screen intent + emergency `channelId`/`emergency_alert`, and starts **`AmberAlertPlayerService`** when **MainActivity is not resumed** (not process importance — a killed-app FCM wake looks foreground and used to skip the player). FGS plays `res/raw/emergency_alert` via `USAGE_ALARM` + vibration for ~60s. NSE also creates the emergency channel if it is missing.
- Also delete+recreates `rescuelink_updates` (`IMPORTANCE_HIGH`, default sound + vibration) for quiet / status trays; quiet REST uses `existing_android_channel_id: rescuelink_updates`
- Sound uses the **Alarm** volume stream (`USAGE_ALARM`) — if Alarm volume is 0, amber is silent
- Android 14+: Settings → Apps → RescueLink → Special app access → **Full screen intents** must be allowed (or the system may show a quiet heads-up instead of waking the lock screen)
- Do **not** force-stop RescueLink from system Settings (that blocks FCM until the next manual open). Swiping from recents is OK.
- You may replace the WAV with a louder branded alert; **keep the filename** `emergency_alert.wav` (Android resource name = `emergency_alert`) and copy into both `res/raw` and `assets/sounds`. Keep length around **one minute** so tray/foreground amber match.

---

## 4. iOS sound + Time Sensitive

Backend sends:

| Field | Value |
|-------|--------|
| `ios_sound` | `emergency_alert.wav` |
| `ios_interruption_level` | `time_sensitive` |

### Dashboard / Xcode

1. Confirm **Apple iOS** platform is set (APNs auth key or cert).
2. Add **Time Sensitive Notifications** capability in Xcode for the Runner target (Signing & Capabilities).
3. Bundle sound: `Frontend/Mobile/ios/Runner/emergency_alert.wav` — ensure it is included in **Copy Bundle Resources**.
4. Optional later: **Critical Alerts** entitlement from Apple → then change backend `ios_interruption_level` from `time_sensitive` to `critical` for true silent/DND bypass.

Until Critical Alerts are approved, iOS will not fully match Amber/WEA DND override; Time Sensitive is the supported step.

---

## 5. Message / data expectations

### Who gets amber (critical) vs quiet

| Event | Amber (critical channel + foreground blare) | Quiet push + DB notification |
|-------|-----------------------------------------------|------------------------------|
| **Notify Dept** (no team yet) | All `department-admin`, `department-head`, and `responder` (field personnel) in that department | Same staff + reporter + global dispatchers/admins |
| **Assign Team** (manual or auto) | Account-backed **team members** + **department-admin/head** in that department | Quiet fan-out minus the critical set (includes **reporter** + other staff) |
| **Auto suggestion only** (`auto_assignment_status=suggested`) | None — no `incident:dispatched` until Confirm / Notify Dept | None for dispatch |
| **Nearby volunteer alert** (`responder:incident_alert`) | Online nearby `volunteer`s matching specialization/radius (`alert_kind: volunteer`) | None for this path (WS + critical push only) |
| **Nearby volunteer backup** (`responder:backup_alert`) | Same volunteer pool minus joined/declined (`alert_kind: backup`) | DB `backup_alert` rows for those volunteers |

Citizens / reporters **never** get amber. Test amber on `09001000011` (dept admin) via **Notify Dept** or **Assign Team**, or a team member for team amber — not on the phone that filed the SOS. Volunteers: stay **online** on the Responder tab, background or kill the app, then file a nearby matching incident.

If auto-dispatch assigns a team but no account-backed `user_id`s resolve, amber **falls through to dept** staff (same as Notify Dept) instead of sending zero critical pushes.

Critical titles:

- `Respond now` (dept-only assign)
- `Your team is up` (team members)

Custom data includes `report_id`, `critical: true`, `alert_kind: dept|team|volunteer|backup`. Volunteer tap opens pre-accept preview (not citizen incident details). Staff tap opens ops/assigned detail. The in-app sheet is skipped when the tap already opened the report.

Quiet events (notes, status updates) **must not** use `724e011a-e821-4e40-a810-9c175737a997`.

Backend logs on dispatch: `[emitIncidentEvent] Push critical kind=… userIds=[…]` then `[oneSignalService] OneSignal ok … recipients=N` (or `0 recipients`).

---

## 6. Test checklist (after coding)

1. Log in mobile as **CDRRMO dept admin** `09001000011` / `deptadmin123` (not a citizen reporter) → **Reports** tab shows the dept queue; allow notifications when prompted.
2. Confirm log `Linked user external ID: …` and OneSignal **Audience → Users** shows that External ID. Background the app.
3. From web, dispatcher **Notify Dept** → CDRRMO on a pending incident.
4. Expect **loud** OS tray push on the dept-admin device (and foreground blare modal if app is open). Backend log should show critical `userIds` including that admin, then `[oneSignalService] OneSignal ok … recipients=` ≥ 1 (not `0 recipients`).
5. **Force-stop** RescueLink → lock screen / sleep the phone → Notify Dept again → expect custom sound + vibe (Alarm volume > 0). Cold-start the app once after installing this build so `IMPORTANCE_MAX` channel is recreated.
6. Field `responder` accounts in that department should also get amber on Notify Dept (same critical list).
7. Assign **Rescue Alpha** from the mobile Assign team action (or web).
8. Log in as `09003000003` / `responder123` → loud **team** amber + assigned list update.
9. In OneSignal **Delivery** / message log, confirm the notification used channel `724e011a-e821-4e40-a810-9c175737a997` for those sends.
10. Trigger a non-critical event (e.g. coordination note) → normal channel only.

Citizen / reporter accounts get quiet status pushes when they are recipients; they **never** receive amber critical dept/team alerts by design.

### Optional OneSignal test push

Audience → find user by External ID → open the **device under test** Subscription ID (match Logcat `subscriptionId=`; for reporter tests on emulator use the `sdk_gphone…` row, not a physical phone logged into the same account) → **Send push** / test notification. Amber: Android channel `724e011a-e821-4e40-a810-9c175737a997`. Quiet/status: default sound is fine.

**Background the app** before the test. If tray appears, FCM + that install are fine. If the emulator tray is empty, use an AVD **with Google Play**, sign into Google, and confirm notifications are allowed for RescueLink.

Permission is requested **after** login on home. After you tap Turn On / allow OS notifications, Logcat must show `optedIn=true` (not only `externalId=`).

---

## 7. Common failures

| Symptom | Likely cause |
|---------|----------------|
| No push at all | Missing External ID / `OneSignal.login` not run after login (must link on every `LoginSuccess`, not only cold start); wrong App ID; permission denied; backend log `0 recipients` |
| Dashboard **Delivered** but phone tray empty | Delivered to a **stale/ghost subscription** under the same External ID — not necessarily this install. Debug log `subscriptionId=… optedIn=… tokenPresent=…` after login; match that ID in Audience / Delivery. Multiple Subscribed rows for one phone are usually login/logout/reinstall churn; ignore historical rows without a live push token |
| Logcat shows `GET .../iams` or `refresh-user` only | Those are **not** received pushes (in-app message poll / user refresh). A real push needs FCM delivery + tray UI. Prove with OneSignal **Send test** to this Subscription ID |
| `optedIn=false` / `NO_PERMISSION` after login | Expected until the **post-login** permission prompt is granted; then app must `optIn()`. If OS allowed but still `optedIn=false`, re-open app (recovery runs) or toggle Settings → Notifications |
| `[emitIncidentEvent] Push userIds=…` but no `[oneSignalService]` line | Backend silently skipped send — look for `skipped: no eligible after prefs` or `skipped: OneSignal not configured` |
| Multiple subscription IDs same device | Expected after reinstalls; also happened when Exit cleared JWT without `OneSignal.logout` (fixed — Exit and Settings logout both call `logoutUser`). Prefer Settings logout; uninstall once to drop sticky FCM tokens if Audience is cluttered |
| Amber never arrives on citizen phone | By design — critical push is dept-admin/head/responder on Notify Dept, or assigned team members; test as `09001000011` / `09003000003` |
| Amber never arrives on dept admin after Assign Team / auto team | Should receive critical push (team members + dept admin/head). Check backend `Push critical kind=team userIds=` includes the admin External ID |
| Amber missing after SOS/AI with only a suggestion | Automation `persistSuggestion` does not emit `incident:dispatched` — confirm suggestion or Notify Dept first |
| Resident no tray on En Route / On Scene | Fixed: volunteer `updateResponderStatus` now emits `incident:status_updated` (quiet push). Team member status already emitted via dispatch |
| In-app list updates but no OS tray | DB/WebSocket path ≠ OneSignal push; check backend `[oneSignalService]` recipients log |
| `[oneSignalService] HTTP 400` / `Remove url field when setting app_url or web_url` | Do not send `url` together with `web_url` — backend uses `web_url` only (fixed) |
| Emulator subscribed but no reporter tray | Quiet payload needs high priority (backend sets `priority:10` + `android_sound:default`). Prove FCM with dashboard Send test to the **emulator** subscription while app is backgrounded; use Google Play AVD. Same External ID on phone+emulator is OK — watch the emulator sub |
| Silent / quiet on Android | Channel ID mismatch; channel sound set to `emergency_alert.wav` instead of `emergency_alert`; vibration Custom field set to literal `custom` instead of `0,1000,5000,1000` — fix dashboard → Update → cold-start app (MainActivity recreates sticky channel) |
| Tray appears but no sound/vibe when app swiped away / process dead | Needs `AmberAlertPlayerService` (rebuild with this fix); cold-start once; Alarm volume > 0; do not Force stop from Settings (blocks FCM). Confirm extension meta-data in APK |
| In-app amber modal but no tray | WebSocket works; OS push is separate. Background/kill app; check `[oneSignalService] OneSignal ok` and dashboard test to that subscription |
| Tray OK but weak/no custom vibe after channel edit | Sticky channel — cold-start app once after install so MainActivity delete+recreates; hot reload does not |
| `invalid_aliases.external_id` (e.g. `["71","71","71"]`) | That `user_id` is not linked in OneSignal Audience — open app and login so `OneSignal.login` runs. Backend now dedupes ids; still cannot invent a subscription |
| No custom sound | Sound not in `res/raw` or wrong name; need cold start after channel recreate |
| iOS muted in Focus | Need Time Sensitive capability; Critical Alerts for full bypass |
| Double notification | Critical recipients should be excluded from quiet copy (backend handles this) |

After logout → login, confirm **Audience → Users** shows External ID **and** the Subscription ID from device debug logs before blaming FCM/APNs.

---

## 8. Seed accounts for testing

See [Documentation/backend/ACCOUNTS.md](../backend/ACCOUNTS.md):

- Dept admin (DRRMO): `09001000011` / `deptadmin123`
- Team member (Rescue Alpha): `09003000003` / `responder123`
- Dispatcher (web email): `dispatcher@rescuelink.test` / `dispatcher123`
