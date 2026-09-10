# RescueLink Test Accounts

This document lists all seeded test credentials for development and testing.

**Password pattern:** staff roles use `[role]123` (e.g. `dispatcher123`); all responders use **`responder123`**.

**Mobile login:** the app accepts **phone number + password** only (not email). The UI enforces local format **`09XXXXXXXXX`** (digits only, 11 characters). The API accepts `09…`, `639…`, or `+639…` on input but **stores** `09XXXXXXXXX`. Web staff login uses email via the dispatcher portal.

After re-seeding for auto team dispatch testing, every team has **2 account-backed members** linked via `responders.user_id` (mobile assigned-incidents + stepper).

---

## System Admins (Full System Access)

| Email | Phone (mobile) | Password |
|-------|----------------|----------|
| admin@rescuelink.test | 09001000001 | admin123 |
| admin2@rescuelink.test | 09001000002 | admin123 |

## Department Admins (Roster & Team Management)

| Email | Phone (mobile) | Password | Dept |
|-------|----------------|----------|------|
| deptadmin_pnp@rescuelink.test | 09001000010 | deptadmin123 | PNP |
| deptadmin_drrmo@rescuelink.test | 09001000011 | deptadmin123 | DRRMO |

**Mobile:** phone login uses the **Reports** tab for the department incident queue (assign / reassign / mark resolved — same as web). No separate Incidents tab. Same for department heads below. Web email login remains the full department dashboard. Amber push setup: [Documentation/guides/ONESIGNAL_AMBER_ALERT_SETUP.md](../guides/ONESIGNAL_AMBER_ALERT_SETUP.md).

## Dispatchers (Incident & Dispatch Management)

| Email | Phone (mobile) | Password | Dept |
|-------|----------------|----------|------|
| dispatcher@rescuelink.test | 09002000001 | dispatcher123 | DRRMO |
| dispatcher2@rescuelink.test | 09002000002 | dispatcher123 | PNP |
| dispatcher3@rescuelink.test | 09002000003 | dispatcher123 | DRRMO |
| dispatcher4@rescuelink.test | 09002000004 | dispatcher123 | PNP |

## Department Heads (Operational Leadership)

| Email | Phone (mobile) | Password | Dept |
|-------|----------------|----------|------|
| depthead_pnp@rescuelink.test | 09001000020 | depthead123 | PNP |
| depthead_drrmo@rescuelink.test | 09001000021 | depthead123 | DRRMO |

**Mobile:** same **Reports** ops queue as department admins (dept-scoped list + assign / reassign / resolve).

## Supervisors (Escalation Management)

| Email | Phone (mobile) | Password | Dept |
|-------|----------------|----------|------|
| supervisor@rescuelink.test | 09004000001 | supervisor123 | DRRMO |
| supervisor2@rescuelink.test | 09004000002 | supervisor123 | PNP |

## Reporters (Mobile App Users)

| Email | Phone (mobile) | Password |
|-------|----------------|----------|
| user@rescuelink.test | 09005000001 | user123 |
| user2@rescuelink.test | 09005000002 | user123 |
| user3@rescuelink.test | 09005000003 | user123 |
| user4@rescuelink.test | 09005000004 | user123 |
| user5@rescuelink.test | 09005000005 | user123 |
| user6@rescuelink.test | 09005000006 | user123 |

---

## Responders (Field Personnel — 24 accounts, role `responder`)

All use password **`responder123`**. Each team has two mobile-testable logins. These are **team personnel**, not volunteers: Assigned history, assigned nearby list, no Accept/Decline, always online.

Volunteers are **not** these accounts. Approve a reporter application (e.g. `09005000001`) to promote `users.role = volunteer`. Do not use `responder@rescuelink.test` as a volunteer.

All use password **`responder123`**. Each team has two mobile-testable logins.

### PNP

| Email | Phone (mobile) | Team | Availability |
|-------|----------------|------|--------------|
| responder@rescuelink.test | 09003000001 | Patrol Alpha | available |
| responder5@rescuelink.test | 09003000005 | Patrol Alpha | standby |
| responder2@rescuelink.test | 09003000002 | Patrol Bravo | standby |
| responder6@rescuelink.test | 09003000006 | Patrol Bravo | available |
| responder7@rescuelink.test | 09003000007 | Traffic Unit | available |
| responder8@rescuelink.test | 09003000008 | Traffic Unit | standby |
| responder9@rescuelink.test | 09003000009 | K9 Unit | available |
| responder10@rescuelink.test | 09003000010 | K9 Unit | standby |
| responder11@rescuelink.test | 09003000011 | Investigation Unit | available |
| responder12@rescuelink.test | 09003000012 | Investigation Unit | standby |
| responder13@rescuelink.test | 09003000013 | Quick Response Team | available |
| responder14@rescuelink.test | 09003000014 | Quick Response Team | standby |

### CDRRMO (drrmo)

| Email | Phone (mobile) | Team | Availability |
|-------|----------------|------|--------------|
| responder3@rescuelink.test | 09003000003 | Rescue Alpha | available |
| responder15@rescuelink.test | 09003000015 | Rescue Alpha | standby |
| responder4@rescuelink.test | 09003000004 | Medical Alpha | available |
| responder16@rescuelink.test | 09003000016 | Medical Alpha | standby |
| responder17@rescuelink.test | 09003000017 | Fire Support | standby |
| responder18@rescuelink.test | 09003000018 | Fire Support | available |
| responder19@rescuelink.test | 09003000019 | Emergency Response Alpha | available |
| responder20@rescuelink.test | 09003000020 | Emergency Response Alpha | standby |
| responder21@rescuelink.test | 09003000021 | Logistics Support | available |
| responder22@rescuelink.test | 09003000022 | Logistics Support | standby |
| responder23@rescuelink.test | 09003000023 | Search and Rescue | standby |
| responder24@rescuelink.test | 09003000024 | Search and Rescue | available |

**Suggested auto-dispatch smoke tests (mobile login):**

- SOS → **Rescue Alpha**: `09003000003` / `responder123`
- High-confidence medical → **Medical Alpha**: `09003000004` / `responder123`
- Police incident → **Patrol Alpha**: `09003000001` / `responder123`

---

## Departments

- **PNP** — Dagupan City Police Station (`supported_incident_types`: police)
- **DRRMO** — Dagupan CDRRMC (`supported_incident_types`: fire, medical, disaster, accident)

## Re-seed command

```bash
cd Backend
npm run migrate
npm run seed-db
```

See also: [AUTO_TEAM_DISPATCH_MANUAL_TEST_GUIDE.md](../guides/AUTO_TEAM_DISPATCH_MANUAL_TEST_GUIDE.md)
