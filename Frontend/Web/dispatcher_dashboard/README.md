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
  - `pending`, `verified`, `resolved`
- Queue sync and convergence improvements:
  - deterministic polling
  - optimistic rollback on failed action flows
  - cross-page refresh via `incident:updated` events
- Security hardening updates:
  - role-scoped action visibility
  - session-state cleanup on logout/session expiry

## Backend contract and sync docs

- Pre-release contract checklist:
  - `docs/backend-contract-checklist.md`
- Realtime migration design (SSE/WebSocket):
  - `docs/realtime-sync-design.md`
- E2E smoke checklist placeholder:
  - `e2e/smoke.placeholder.md`
