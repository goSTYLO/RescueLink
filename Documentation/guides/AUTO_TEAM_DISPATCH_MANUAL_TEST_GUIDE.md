# Hybrid Auto Team Assignment — Manual Test Guide

**Scope:** All updates from the [Auto Team Dispatch plan](file:///c:/Users/Aaron/.cursor/plans/auto_team_dispatch_0020ff61.plan.md) (backend picker, confirm/reassign, web gating, mobile team mode, escalation/duplicate/backup coexistence).

**Goal:** Walk through real user flows end-to-end, confirm correct behavior, and surface bugs or bottlenecks before production.

**Related docs:** [`Documentation/misc/MEMORY.md`](../misc/MEMORY.md) · [`Documentation/backend/API_DOCUMENTATION.md`](../backend/API_DOCUMENTATION.md) · [`Documentation/guides/MANUAL_RUN_TEST_GUIDE.md`](MANUAL_RUN_TEST_GUIDE.md)

---

## 1. Prerequisites

### 1.1 Services running

| Service | Default port | Notes |
|---------|--------------|-------|
| PostgreSQL | 5432 | DB must have latest schema |
| Backend API | 3000 | `cd Backend && npm run dev` |
| RescueLink AI | 8000 | Required for audio classification tests |
| Web dispatcher | 5173 | `cd Frontend/Web/dispatcher_dashboard && npm run dev` |
| Mobile app | — | Flutter device/emulator pointed at backend |

### 1.2 Database migration

Run once if you have not since the auto-assignment work landed:

```bash
cd Backend
npm run migrate
```

Confirm columns exist:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'incident_reports'
   AND column_name LIKE 'auto_assignment%'
    OR column_name IN ('suggested_department_code', 'suggested_team_name');
```

Also confirm `departments.supported_incident_types` is populated (seed or admin UI).

### 1.3 Environment (Backend `.env`)

| Variable | Expected | Used for |
|----------|----------|----------|
| `AI_LOW_CONFIDENCE_THRESHOLD` | `0.7` | Auto-apply gate (via `aiService.js` → `lowConfidenceFlag`) |
| `AI_SERVICE_URL` | `http://localhost:8000` | Audio classification |
| `ONESIGNAL_APP_ID` | set | Push copy “Your team was assigned…” (optional for WS-only tests) |

Automation **does not** read the threshold directly. It uses `lowConfidenceFlag` and `fallbackUsed` from classification.

### 1.4 Seed data (recommended)

Fresh seed gives predictable teams and accounts (12 teams × 2 account-backed members each):

```bash
cd Backend
npm run migrate
npm run seed-db
```

Full credential + team mapping: [`Documentation/backend/ACCOUNTS.md`](../backend/ACCOUNTS.md).

**Teams to know:**

| Department | Team | Status | Types |
|------------|------|--------|-------|
| `drrmo` | Rescue Alpha | available | disaster, medical |
| `drrmo` | Medical Alpha | available | medical |
| `drrmo` | Fire Support | standby | fire, disaster |
| `pnp` | Patrol Alpha | available | police |

**Test accounts:** see [`Documentation/backend/ACCOUNTS.md`](../backend/ACCOUNTS.md) — 24 responder logins (`responder@` … `responder24@`, password `responder123`), 2 per team. **Mobile uses phone + password** (not email).

| Role | Phone (mobile) | Password | Email (web only) |
|------|----------------|----------|------------------|
| Dispatcher | `09002000001` | `dispatcher123` | `dispatcher@rescuelink.test` |
| Admin | `09001000001` | `admin123` | `admin@rescuelink.test` |
| CDRRMO dept admin | `09001000011` | `deptadmin123` | `deptadmin_drrmo@rescuelink.test` |
| CDRRMO dept head | `09001000021` | `depthead123` | `depthead_drrmo@rescuelink.test` |
| PNP dept admin | `09001000010` | `deptadmin123` | `deptadmin_pnp@rescuelink.test` |
| Citizen | `09005000001` | `user123` | `user@rescuelink.test` |
| Team member (Rescue Alpha) | `09003000003` | `responder123` | `responder3@rescuelink.test` |
| Team member (Medical Alpha) | `09003000004` | `responder123` | `responder4@rescuelink.test` |
| Team member (Patrol Alpha) | `09003000001` | `responder123` | `responder@rescuelink.test` |

Before each scenario block, ensure **at least one CDRRMO team is `available`** and members are `available`/`standby` (not `busy`/`off-duty`). Use dept admin Team page or SQL if a prior test left teams busy.

---

## 2. Pre-flight checklist

Run before starting; tick when OK.

- [ ] Migration applied (`auto_assignment_*` columns present)
- [ ] Backend + AI + Web + Mobile all running
- [ ] Seed loaded (or you know your team roster)
- [ ] `AI_LOW_CONFIDENCE_THRESHOLD=0.7` in `Backend/.env`
- [ ] At least one `drrmo` team `available`, one `pnp` team `available`
- [ ] Browser devtools Network tab ready (web)
- [ ] Optional: DB client open for spot checks (queries in §8)

---

## 3. Test matrix — auto vs suggest (backend + create flows)

Each row is one incident. Use a **new report** per row. Record `report_id` in the bug log.

### 3.1 SOS → auto CDRRMO team

| Step | Action | Expected |
|------|--------|----------|
| 1 | Mobile: submit **SOS** (emergency button) as citizen | 201, incident created |
| 2 | Check DB / `GET /api/incidents/:id` | `auto_assignment_status = auto_applied`, `status = in_progress` |
| 3 | Check dispatches | One CDRRMO team (`team_name` set), `responder_source = account`, members assigned |
| 4 | Web dispatcher queue | Incident **not** in pending filter; badge **Auto-assigned** |
| 5 | Mobile team member (`responder3@…`) | **Assigned to my team** list shows incident; push/WS alert |

**Must NOT happen:** PNP team assigned; incident stays `pending`; suggestion only.

### 3.2 High-confidence AI audio → auto team

| Step | Action | Expected |
|------|--------|----------|
| 1 | Submit audio report classified as **medical** or **fire** with max confidence **≥ 0.7**, no keyword fallback | |
| 2 | Check API | `auto_applied`, mapped dept (`drrmo` for medical/fire per seed), `in_progress` |
| 3 | Team picked | Matches type + availability (prefer `available` over `standby`, more eligible members) |

**Tip:** Use a known-good medical audio sample from seed scripts or prior tests. If AI is down, skip and note — retry job path is §3.6.

### 3.3 Low-confidence AI → suggestion only

| Step | Action | Expected |
|------|--------|----------|
| 1 | Force low confidence: unclear audio, or temporarily set `AI_LOW_CONFIDENCE_THRESHOLD=0.95` and restart backend | |
| 2 | Submit audio report | `auto_assignment_status = suggested`, `status = pending` |
| 3 | Dispatches | **No** team rows created |
| 4 | Web | Badge **Needs confirm**; **Confirm suggested team** visible (if `suggested_team_name` set) |

Restore threshold to `0.7` after this test.

### 3.4 Text-only / no-AI non-SOS → suggestion only

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create text-only incident (no audio) as non-SOS type | `suggested`, stays `pending`, no auto team |
| 2 | Or: audio path where AI fails → pending retry | `source: text` hook → suggestion, not auto-apply |

### 3.5 Mapped dept, no free team → dept notify

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set **all** CDRRMO teams to `busy` (dept admin UI or SQL) | |
| 2 | Submit SOS | `auto_assignment_status = dept_notified`, `status = verified` |
| 3 | Dispatches | Department-only row for `drrmo`, no `team_name` |
| 4 | Web | Badge **Dept notified (no team)**; **Select Team** available for dept admin |
| 5 | Reset teams to `available` | |

### 3.6 AI retry job → auto after success

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create incident with AI pending (AI service stopped during create) | Suggestion or text-only path |
| 2 | Start AI; wait for retry classification | High-confidence retry → `auto_applied` if team free |
| 3 | Check | Same rules as §3.2; `source: retry` in logs |

### 3.7 Duplicate-flagged → no auto-apply

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create incident flagged `flagged_for_review = true` or linked duplicate | SOS or high-confidence AI |
| 2 | Check | `suggested` with reason `duplicate_flagged`, **no** team auto-applied |

---

## 4. Web dispatcher — badges, gating, overrides

Login: `dispatcher@rescuelink.test` unless noted.

### 4.1 Queue badges (`DashboardPage`)

| State | Where to get it | Badge |
|-------|-----------------|-------|
| `suggested` | §3.3 or §3.4 | **Needs confirm** |
| `auto_applied` | §3.1 or §3.2 | **Auto-assigned** |
| `dept_notified` | §3.5 | **Dept notified (no team)** |
| `confirmed` | After confirm (§5.1) | **Suggestion confirmed** |
| `overridden` | After reassign (§5.2) | **Reassigned** |

- [ ] Badges appear on main dashboard **and** department dashboard lists
- [ ] List API returns `auto_assignment_status`, `assigned_team_name` (not stale localStorage)

### 4.2 Incident details — button gating

Open incident in each state and verify action bar:

| State | Notify Dept | Undo Notify | Confirm | Select Team | Reassign | Add Department |
|-------|-------------|-------------|---------|-------------|----------|----------------|
| `suggested` + team name | Hidden | Hidden | **Shown** | Hidden (use Confirm) | Hidden | Prompt; dept-only |
| `suggested` dept only | Per matrix | Hidden | Hidden if no team | Shown (dept scoped) | Hidden | |
| `auto_applied` | Hidden | Hidden | Hidden | Hidden | **Shown** | Prompt; does not replace team |
| `dept_notified` | Hidden for that dept | **Shown** | Hidden | **Shown** | Hidden | |
| `confirmed` / `overridden` | Same as auto_applied | Hidden | Hidden | Hidden | **Shown** | |

**Add Department regression (critical):**

1. Open `auto_applied` incident with team assigned
2. Add supporting department (e.g. PNP)
3. **Expect:** Swal confirm → department-only notify → **primary team unchanged**
4. **Must NOT:** Second primary team; `assigned_team_name` overwritten in UI

### 4.3 Confirm suggested team

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `suggested` incident with `suggested_team_name` | Confirm button visible |
| 2 | Click **Confirm suggested team** | 201, team assigned, `confirmed`, `in_progress` |
| 3 | Repeat confirm on same incident | 409 `NO_SUGGESTION` or already teamed |

Also test as **dept head** (`depthead_drrmo@…`) on in-dept suggestion — should succeed; out-of-dept → 403.

### 4.4 Reassign team

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `auto_applied` incident | Reassign dialog |
| 2 | Pick different available team + reason ≥ 10 chars | Old team → `available`, new team `busy`, `overridden` |
| 3 | Reassign to **same** team | 409 |
| 4 | Reassign with unavailable team | 409 before release (no orphaned incident) |
| 5 | Reassign with empty team (release only) | Team released, status → `verified`, no new team |

### 4.5 Idempotency — second primary team blocked

| Step | Action | Expected |
|------|--------|----------|
| 1 | On teamed incident, try **Select Team** via API or UI workaround | 409 `PRIMARY_TEAM_ALREADY_ASSIGNED` |
| 2 | POST `/api/dispatches` with another team same incident | 409 |

### 4.6 Undo department notify

| Step | Action | Expected |
|------|--------|----------|
| 1 | On `dept_notified` incident (no team) | Undo notify works |
| 2 | After undo, if no dispatches remain | `auto_assignment_status` reset to `none` |
| 3 | On teamed incident | Undo blocked `TEAM_ALREADY_ASSIGNED` |

### 4.7 Department dashboard assign

Login: `deptadmin_drrmo@rescuelink.test`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open dept-notified incident | Assign button visible |
| 2 | Assign team via modal | Team on API; assignment column shows API `assigned_team_name` |
| 3 | After assign | Assign button hidden; not reading localStorage fallback |

---

## 5. Mobile — team members & volunteers

### 5.1 Assigned-to-my-team list

Login: `09003000003` / `responder123` (Rescue Alpha, role `responder`)

- [ ] Status shows **Online** (toggle hidden)
- [ ] List/map is **assigned incidents only** (no nearby volunteer pool)
- [ ] Auto-applied incident from §3.1 or §3.2 listed with status badge
- [ ] Tap opens detail **without** Accept step (`isTeamAssignment: true`)
- [ ] History chips: Reported / **Assigned** (not Accepted)

### 5.2 Per-member status stepper

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open assigned incident | Stepper: Assigned → En Route → On Scene → Resolved |
| 2 | Tap **Mark En Route** | `PATCH /api/dispatches/me/status` 200 |
| 3 | DB | **Your** `dispatches.response_status` updated (title case) |
| 4 | Timeline | Coordination note: `{Your name} set status to En Route` |
| 5 | `incident_reports.responder_status` | **Unchanged** unless you are also the volunteer acceptor |
| 6 | Tap **Mark Resolved** (team member) | Your dispatch resolved; incident **still** `in_progress` |

Repeat with second member on same team — independent dispatch rows.

### 5.3 Team roster sheet

- [ ] App bar **groups** icon opens roster
- [ ] `GET /api/responders/me/team` returns members for your team

### 5.4 Volunteer coexistence

Do **not** use `responder@rescuelink.test` (that is Patrol Alpha **personnel**). Approve a reporter application first, e.g. `09005000001` / `user123`, then login as that **`volunteer`**.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Receive WS/push alert for teamed incident | Modal shows **formal team name** |
| 2 | Open incident detail (volunteer accept path if accepted) | Banner: formal team assigned |
| 3 | **Request Backup** | **Hidden/disabled** when `assigned_team_name` present |
| 4 | API `POST .../backup` on teamed incident | 409 `TEAM_ALREADY_ASSIGNED` |

Volunteer who **accepted** before team assign: still uses volunteer stepper; can resolve incident (existing parallel track). Personnel never see Accept/Decline or volunteer/backup popups.

### 5.5 OneSignal / push deep link

With OneSignal configured:

- [ ] Team member receives push: “Your team was assigned to Incident #…”
- [ ] Tap opens assigned-incident detail (not citizen screen)
- [ ] Cold start: `openIncidentByReportId` prefers assigned list

---

## 6. Escalation, duplicates, reclassify, backup

### 6.1 Escalation — assisting dept only

| Step | Action | Expected |
|------|--------|----------|
| 1 | On `auto_applied` incident, create escalation to PNP | Assisting dispatch `responder_source = escalation` |
| 2 | PNP dept admin | Can Select Team for **assisting** dept only |
| 3 | Decline/cancel escalation | Deletes **only** escalation dispatches |
| 4 | Primary CDRRMO team | **Still assigned** after decline |

**Regression:** Declining escalation must **not** wipe primary auto-assigned team.

### 6.2 Duplicate link

| Step | Action | Expected |
|------|--------|----------|
| 1 | Child with `suggested` | Link duplicate → suggestion cancelled (`none`) |
| 2 | Child with `auto_applied` | Web **warns** before link; team not silently released |
| 3 | Unlink duplicate (still pending, no team) | Hybrid re-runs (`source: text` — suggest, not auto-apply without confidence) |

### 6.3 Reclassify

| Step | Action | Expected |
|------|--------|----------|
| 1 | `suggested` incident, change type | Suggestion regenerated |
| 2 | `auto_applied`, type maps to different dept | `auto_assignment_mismatch = true`; **no** silent re-route |
| 3 | Web | Prompt to reassign |

### 6.4 Staff backup vs primary team

- [ ] Send Backup on teamed incident goes through escalation/backup flow, not second primary team
- [ ] Does not confirm a pending suggestion

---

## 7. Performance & bottleneck watchlist

Time or note these during testing. Targets are indicative — log actuals.

| Area | What to watch | Red flag |
|------|---------------|----------|
| SOS create → team assigned | End-to-end latency (mobile tap → member alert) | > 5s with local stack |
| Audio create + classify + auto-dispatch | Total 201 response time | > 30s (AI bound) |
| `GET /api/incidents` list | Payload size + time with badges | > 2s for 50 rows |
| `GET /api/responders/me/assigned-incidents` | Mobile pull on dashboard open | > 1s repeatedly |
| Confirm / reassign | Web button → refreshed incident | > 3s or UI optimistic desync |
| Team pick race | Two SOS reports while one team available | Only one gets team; other dept-notifies or picks next team |
| WS fan-out | N team members on one assign | All receive alert within ~2s |
| DB | `dispatches` row count per auto-assign | Should match eligible members, not duplicates |

**Concurrency spot check (optional):**

1. Submit two SOS reports within 5 seconds with only **one** CDRRMO team available
2. Expect: one `auto_applied`, second `dept_notified` or picks next ranked team — never double-book same team

---

## 8. SQL spot checks

Replace `:report_id` with your test incident.

```sql
-- Assignment state
SELECT report_id, status, incident_type,
       auto_assignment_status, suggested_department_code, suggested_team_name,
       auto_assignment_reason, auto_assignment_mismatch
  FROM incident_reports WHERE report_id = :report_id;

-- Primary team dispatches
SELECT dispatch_id, department_code, team_name, responder_id,
       response_status, responder_source, dispatched_at
  FROM dispatches WHERE report_id = :report_id
  ORDER BY dispatched_at;

-- Team status after assign/release
SELECT team_name, department_code, team_status
  FROM responder_teams
 WHERE department_code IN ('drrmo', 'pnp');
```

---

## 9. API quick checks (curl)

Obtain token: login via web or `POST /api/auth/login`.

```bash
# Incident detail
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/incidents/REPORT_ID | jq '{status, auto_assignment_status, suggested_team_name, assigned_team_name}'

# Confirm suggestion
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"report_id": REPORT_ID}' \
  http://localhost:3000/api/dispatches/confirm-suggestion

# Reassign
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"report_id": REPORT_ID, "department_code": "drrmo", "team_name": "Medical Alpha", "reason": "Test reassign reason"}' \
  http://localhost:3000/api/dispatches/reassign-team

# Team member status
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"report_id": REPORT_ID, "response_status": "En Route"}' \
  http://localhost:3000/api/dispatches/me/status

# Assigned incidents (responder token)
curl -s -H "Authorization: Bearer $RESPONDER_TOKEN" \
  http://localhost:3000/api/responders/me/assigned-incidents
```

---

## 10. Automated tests (sanity before manual)

```bash
cd Backend
npx jest tests/autoDispatchService.test.js \
           tests/dispatchPrimaryTeam.test.js \
           tests/dispatchOps.test.js \
           tests/backupIntegration.test.js \
           tests/incident.lifecycle.test.js \
  --detectOpenHandles --forceExit
```

All should pass before manual QA. Manual testing still required for UI gating, mobile stepper, WS/push, and multi-user timing.

---

## 11. Bug log template

| ID | Date | Scenario § | Steps | Expected | Actual | Severity | Notes |
|----|------|------------|-------|----------|--------|----------|-------|
| 1 | | 3.1 | | | | | |
| 2 | | 4.2 | | | | | |

**Severity:** Blocker (wrong team / data loss) · Major (gating wrong) · Minor (copy/UI) · Perf (§7 threshold)

---

## 12. Sign-off checklist

Minimum pass before calling the feature ready:

- [ ] §3.1 SOS → CDRRMO auto team
- [ ] §3.2 High-confidence AI auto team
- [ ] §3.3 Low-confidence suggestion
- [ ] §3.5 No team → dept notify
- [ ] §4.2 Add Department does not replace primary team
- [ ] §4.3 Confirm suggestion
- [ ] §4.4 Reassign team
- [ ] §4.5 Second primary team 409
- [ ] §5.2 Per-member stepper + timeline note
- [ ] §5.4 Volunteer backup disabled when teamed
- [ ] §6.1 Escalation decline does not delete primary team
- [ ] §6.2 Duplicate link warnings
- [ ] Automated tests green (§10)

---

*Last updated: 2026-09-07 — aligned with hybrid auto team assignment implementation and audit fixes.*
