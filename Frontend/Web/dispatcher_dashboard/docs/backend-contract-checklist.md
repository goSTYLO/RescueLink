# Backend Contract Checklist

Pre-release checklist for web/backend contract readiness.

## Incident API contracts
- [x] `GET /api/incidents` supports `limit`, `offset`, `status`.
- [x] `GET /api/incidents/:id` returns incident detail payload.
- [x] `GET /api/incidents/:id/with-ai` returns incident + AI metadata.
- [x] `POST /api/incidents/:id/verify` supports dispatcher/admin role and returns verification metadata.
- [x] `POST /api/incidents/:id/reclassify` supports manual override payload and reason.

## Lifecycle and error handling
- [x] Canonical status mapping is enforced in web (`pending`, `verified`, `resolved`).
- [x] Web clients standardize backend errors as `message || error || fallback`.
- [x] Request correlation IDs are sent by web clients and echoed by backend.

## Operational consistency
- [x] Dashboard and map use deterministic polling interval (30s).
- [x] Post-action refresh event (`incident:updated`) converges dashboard/map/details.
- [x] Verify/reclassify action failures rollback optimistic local UI changes.
