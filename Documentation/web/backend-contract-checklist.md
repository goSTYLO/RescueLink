# Backend Contract Checklist

Pre-release checklist for web/backend contract readiness.

## Incident API contracts
- [x] `GET /api/incidents` supports `limit`, `offset`, `status`, `severity_level`, `incident_type`, `barangay`, `exclude_duplicates`, `search`, `exclude_report_id`.
- [x] `GET /api/incidents/:id` returns incident detail payload (includes `is_duplicate`, `flagged_for_review`, `duplicate_cluster` when applicable).
- [x] `GET /api/incidents/:id/with-ai` returns incident + AI metadata.
- [x] `POST /api/incidents/:id/verify` supports dispatcher/admin role and returns verification metadata.
- [x] `POST /api/incidents/:id/reclassify` supports manual override payload and reason.
- [x] `GET /api/incidents/:id/duplicates` returns duplicate cluster with decrypted descriptions.
- [x] `GET /api/incidents/:id/potential-duplicates` returns AI-detected potential duplicates.
- [x] `POST /api/incidents/:id/link-duplicate` links incident as duplicate of parent (dispatcher/admin).
- [x] `POST /api/incidents/:id/unlink-duplicate` unlinks from duplicate (dispatcher/admin).

## Lifecycle and error handling
- [x] Canonical status mapping is enforced in web (`pending`, `verified`, `resolved`).
- [x] Web clients standardize backend errors as `message || error || fallback`.
- [x] Request correlation IDs are sent by web clients and echoed by backend.

## Operational consistency
- [x] Dashboard and map use deterministic polling interval (30s).
- [x] Post-action refresh event (`incident:updated`) converges dashboard/map/details.
- [x] Verify/reclassify action failures rollback optimistic local UI changes.
