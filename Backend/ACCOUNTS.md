# RescueLink Test Accounts

This document lists all seeded test credentials for development and testing.

## System Admins (Full System Access)

Full system access to all features, settings, and management functions.

- **admin@rescuelink.test** / `admin123`
- **admin2@rescuelink.test** / `admin123`

## Department Admins (Roster & Team Management)

Create, update, and delete responders and teams. Manage department resources and personnel rosters.

- **deptadmin_pnp@rescuelink.test** / `deptadmin123` (PNP)
- **deptadmin_drrmo@rescuelink.test** / `deptadmin123` (DRRMO)

## Dispatchers (Incident & Dispatch Management)

Create and manage incidents and dispatches. Assign responders and update status.

- **dispatcher@rescuelink.test** / `dispatcher123` (DRRMO)
- **dispatcher2@rescuelink.test** / `dispatcher123` (PNP)
- **dispatcher3@rescuelink.test** / `dispatcher123` (DRRMO)
- **dispatcher4@rescuelink.test** / `dispatcher123` (PNP)

## Department Heads (Operational Leadership)

View and read responders and teams within assigned department (read-only access).

- **depthead_pnp@rescuelink.test** / `depthead123` (PNP)
- **depthead_drrmo@rescuelink.test** / `depthead123` (DRRMO)

## Supervisors (Escalation Management)

Manage incident escalation and reclassification.

- **supervisor@rescuelink.test** / `supervisor123` (DRRMO)
- **supervisor2@rescuelink.test** / `supervisor123` (PNP)

## Responders (Field Personnel)

Field personnel who can report incidents and view roster information.

- **responder@rescuelink.test** / `responder123` (PNP)
- **responder2@rescuelink.test** / `responder123` (PNP)
- **responder3@rescuelink.test** / `responder123` (DRRMO)
- **responder4@rescuelink.test** / `responder123` (DRRMO)

## Reporters (Mobile App Users)

Mobile app users who can report emergency incidents.

- **user@rescuelink.test** / `user123`
- **user2@rescuelink.test** / `user123`
- **user3@rescuelink.test** / `user123`
- **user4@rescuelink.test** / `user123`
- **user5@rescuelink.test** / `user123`
- **user6@rescuelink.test** / `user123`

## Departments

All accounts from the same department can see other department members.

- **PNP** - Dagupan City Police Station (PNP admins, dispatchers, responders)
- **DRRMO** - Dagupan CDRRMC at City Engineers Office (DRRMO admins, dispatchers, responders)

## Testing Notes

- All passwords follow the pattern: `[role]123` (e.g., `dispatcher123`, `responder123`)
- Department-scoped accounts are linked to their respective departments via `department_code`
- System admins and reporters have no department affiliation
- Use **department-admin** email accounts to manage rosters and teams
- Use **dispatcher** accounts for incident and dispatch management
- Use **department-head** accounts to view department-specific operational data (read-only)
