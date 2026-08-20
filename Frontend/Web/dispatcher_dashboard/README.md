# RescueLink Dispatcher Dashboard (Web)

React + Vite web app for dispatcher operations: incident queue management, map operations, incident actions (verify/reclassify), department operations, and audit visibility.

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development:
   ```bash
   npm run dev
   ```
3. Open the app in browser (Vite prints the local URL).

## Environment and runtime config

The app no longer relies on a hardcoded backend URL.

- Preferred env var:
  - `VITE_API_URL=http://localhost:3000`
- Optional runtime override:
  - `window.__RESCUELINK_CONFIG__ = { API_URL: 'http://localhost:3000' }`
- Optional dev-mode switch:
  - `VITE_DEV_MODE=true` (auth bypass for UI-only development)

Config source is centralized in:
- `src/core/config/app.config.js`

## Test commands

- Unit/integration tests:
  ```bash
  npm test
  ```
- Full local suite:
  ```bash
  npm run test:all
  ```
- CI-style run with coverage:
  ```bash
  npm run test:ci
  ```
- E2E smoke placeholder:
  ```bash
  npm run test:e2e:smoke
  ```

## Notable implementation updates

- Standardized API client behavior (auth headers, request IDs, error mapping) via:
  - `src/data/api/http.js`
- Canonical incident lifecycle mapping:
  - `pending`, `verified`, `in_progress`, `resolved`
- Queue sync and convergence improvements:
  - deterministic polling
  - optimistic rollback on failed action flows
  - cross-page refresh via `incident:updated` events
- Security hardening updates:
  - role-scoped action visibility
  - session-state cleanup on logout/session expiry
- Assignment flow v2 (dispatcher/admin):
  - sector defaulting policy: Crime -> Police, non-crime -> CDRRMO (editable)
  - assignment now captures sector + team and relies on backend auto-assignment
  - backend selects only `available` / `standby` members in the selected team
  - manual responder checkbox selection removed from dashboard/details assignment dialogs
- Calling behavior removed from assignment workflows:
  - no `tel:` launch/dial actions during assign/notify actions
  - assignment feedback is now status-based only (success/warning from API result)
- Responder Flow + RBAC update:
  - Incident Details now includes task-alignment hinting for selected team vs incident type.
  - Incident Details includes status controls for team/responders (dispatcher + admin).
  - Departments page includes admin-only management forms for team creation, responder creation, team-member mapping, and task-type specialization.
  - responder/team status values (`available`, `standby`, `busy`, `off-duty`) are now wired to backend status endpoints.
- Incident Details now surfaces secondary AI classification when provided by backend:
  - `2nd AI classification` label with confidence percentage when available
- Incident lifecycle controls update:
  - Incident Details now supports persisted `Mark Resolved` action for dispatcher/admin roles.
  - resolved incidents show reporter confirmation state (`Awaiting reporter confirmation` vs `Reporter confirmed`).
  - dashboard status filtering and badges now include `In Progress` consistently.
  - backend lifecycle auto-transition reliability fix is now compatible with team assignment flow (first successful assignment should move to `In Progress`).
- Assignment conflict handling clarity:
  - `POST /api/dispatches` may return `409` when selected team has no eligible available/standby members.
  - UI should treat this as an operational assignment conflict (not a server crash) and guide user to switch team/status.
- Incident-to-task normalization alignment:
  - incident/task matching now recognizes common synonyms (e.g., `accident` -> `medical`, `natural disaster` -> `disaster`) so team compatibility hints align with backend eligibility checks.
- Dashboard density refresh:
  - single compact summary strip (hero/cards/banners reduced)
  - incident table area uses `flex-1 min-h-0` + internal scroll for one-screen operation
- Map view simplification:
  - map-first emergency layout with focused filters and marker-to-details interaction
  - removed geo-intelligence side panels for faster operational scanning
- Department operations alignment (Teams/Responders model):
  - `DepartmentDetailsPage` now uses backend APIs (no mock units/personnel local state).
  - route identity is standardized to numeric `department_id` for `/departments/:id`.
  - details view now focuses on team/member assignment and status operations.
  - role gating mirrors backend rules: admin can assign/remove members; dispatcher updates statuses only.
- Department dashboard card metric alignment:
  - department cards now derive operational counts from responder/team mappings when legacy unit tables are empty.
  - sector-code normalization handles `pnp/police` and `drrmo/cdrrmo/cdrmmo` variants to prevent false `0/0` team counts.
- Department API rate-limit hardening:
  - read endpoints in `departments.api.js` and `responders.api.js` use short-lived dedupe/cache windows.
  - client-side cooldown on `429` (`Retry-After` aware) prevents burst refetch loops and repeated console floods.
- **Session updates (notifications, RBAC, incident closure)**:
  - **Notification deduplication**: merged WebSocket + API notifications deduped by `reportId` + `eventType`.
  - **Breadcrumb RBAC routing**: "Home" and `/dashboard` links resolve to `getDefaultRouteByRole` so department users navigate to their allowed home (e.g. `/department/dashboard`, `/department/assigned-incidents`).
  - **Departments 403 fix**: `getDepartments()` only called for Super Admin and Dispatcher; department users skip the call to avoid 403.
  - **Incident closed resource refresh**: `DepartmentPersonnelPage` and `DepartmentDashboardPage` refetch teams, responders, and units on `incident:updated` so status returns to "available" after incident is closed/resolved.
  - **MapViewPage**: fixed `wsConnected` reference (destructure from `useIncidentWebSocketStatus`).

## Backend contract and sync docs

- Pre-release contract checklist:
  - [Documentation/web/backend-contract-checklist.md](../../../Documentation/web/backend-contract-checklist.md)
- Realtime migration design (SSE/WebSocket):
  - [Documentation/web/realtime-sync-design.md](../../../Documentation/web/realtime-sync-design.md)
- E2E smoke checklist placeholder:
  - `e2e/smoke.placeholder.md`
