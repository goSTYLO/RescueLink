# AI Security and Upload Scan Backlog

## Scope
- Implement basic AI security hardening and safe fallback behavior in `RescueLink AI`.
- Implement multimedia upload security checks (images, videos, audio) in `Backend`.
- Preserve emergency reporting continuity with fail-open behavior when deep scanner is unavailable.

## Confirmed Decisions
- Malware scanner outage policy: **Fail-open with flag**.
- Scan timing strategy: **Hybrid** (quick synchronous checks + asynchronous deep scan).
- AI fallback trigger: **AI exceptions and low confidence**.
- Backlog file location: **Repository root**.

## Epic 1: AI Security Baseline (RescueLink AI)

### Goal
Harden AI endpoints against misuse and ensure deterministic fallback when classification confidence is low or model execution fails.

### Tasks
- [x] Add optional service-to-service token enforcement header (`x-ai-service-token`) for sensitive AI endpoints.
- [x] Add request text length guardrail for `/classify`.
- [x] Add keyword-based fallback for incident type + severity when:
  - model fails,
  - no labels pass threshold,
  - confidence is below configured threshold.
- [x] Return fallback metadata in API responses (`fallback_used`, `fallback_reason`, matched keywords).
- [x] Add PII redaction policy for transcript logs and enforce in endpoint logging.
- [x] Add startup warning when token auth is disabled in non-dev environments.
- [x] Add endpoint-level request IDs for audit traceability.

### Files
- `RescueLink AI/api/main.py`

### Risks
- Over-triggering fallback if low-confidence threshold is too high.
- Keyword rules can overfit mixed-language phrasing.

## Epic 2: Backend Multimedia Security Scan (Backend)

### Goal
Reject obviously unsafe uploads immediately and mark incidents for follow-up deep scanning.

### Tasks
- [x] Add synchronous quick scan service for uploaded buffers:
  - file signature checks,
  - blocked binary/script signatures,
  - extension-signature mismatch detection.
- [x] Integrate quick scan in upload middleware before controller execution.
- [x] Add deep-scan queue scaffold with fail-open semantics when scanner is unavailable.
- [x] Surface scan metadata in incident creation responses.
- [ ] Integrate real deep scanner engine (e.g., ClamAV daemon) behind queue worker.
- [x] Persist scan status in database fields (e.g., `scan_status`, `scan_engine`, `scan_error`, `scanned_at`).
- [x] Add quarantine storage path and access restrictions for suspicious files.
- [x] Add retry worker for deep-scan pending items.

### Files
- `Backend/src/services/fileScanService.js`
- `Backend/src/middleware/fileUpload.js`
- `Backend/src/controllers/incident.js`

### Risks
- Signature checks are necessary but not sufficient for malware detection.
- Fail-open requires strong operator visibility to avoid silent risk.

## Epic 3: Backend ↔ AI Integration Hardening

### Goal
Ensure backend-to-AI requests remain consistent, authenticated, and resilient.

### Tasks
- [x] Add optional `AI_SERVICE_TOKEN` propagation from backend to AI headers.
- [x] Fix text classification payload contract to `{"text": "..."}`.
- [ ] Add integration tests for token-enabled and token-disabled modes.
- [ ] Add health-check degradation policy (circuit breaker/retry budget).

### Files
- `Backend/src/services/aiService.js`

## Epic 4: Testing and Validation

### Goal
Validate new fallback and upload scan paths with deterministic fixtures.

### Tasks
- [ ] Add unit tests for AI keyword fallback trigger matrix:
  - low confidence,
  - no labels above threshold,
  - model exception path.
- [ ] Add backend middleware tests for:
  - clean uploads accepted,
  - blocked signatures rejected,
  - signature mismatch rejected,
  - scanner unavailable + fail-open accepted with flags.
- [ ] Add controller response tests to verify `security_scan` metadata shape.
- [ ] Add manual QA checklist for image/video/audio samples.

## Epic 5: Documentation and Operations

### Goal
Document security behavior and required environment variables.

### Tasks
- [x] Update `Backend/README.md` with upload scanner env vars and behavior matrix.
- [x] Update `RescueLink AI/README.md` with token auth + fallback metadata contract.
- [x] Update `Backend/API_DOCUMENTATION.md` for `POST /api/incidents/with-audio` scan metadata.
- [ ] Add runbook section for scanner outage handling and follow-up triage.

## Environment Variables (Planned/Used)

### RescueLink AI
- `AI_INTERNAL_TOKEN` (optional): required token for protected AI endpoints when set.
- `AI_MAX_TEXT_LENGTH` (optional, default `4000`).
- `AI_LOW_CONFIDENCE_THRESHOLD` (optional, default `0.7`).

### Backend
- `AI_SERVICE_TOKEN` (optional): sent to AI as `x-ai-service-token`.
- `FILE_SCAN_FAIL_OPEN` (optional, default `true`).
- `FILE_DEEP_SCAN_ENABLED` (optional, default `true`).
- `FILE_DEEP_SCAN_ENGINE` (optional, default `stub`).
- `FILE_SCANNER_AVAILABLE` (optional, default `false`).
- `FILE_SCAN_RETRY_CRON` (optional, default `*/10 * * * *`).
- `FILE_SCAN_MAX_BATCH` (optional, default `30`).
- `QUARANTINE_DIR` (optional, default `uploads/quarantine`).
- `IMAGE_COMPRESSION_ENABLED` (optional, default `true`).
- `VIDEO_COMPRESSION_ENABLED` (optional, default `true`).
- `IMAGE_MAX_WIDTH` (optional, default `1920`).
- `IMAGE_JPEG_QUALITY` (optional, default `78`).
- `VIDEO_CRF` (optional, default `30`).

## Rollout Plan
1. Enable in dev with default `stub` scanner mode.
2. Validate quick scan acceptance/rejection behavior.
3. Integrate real deep scanner and queue worker.
4. Add DB scan status columns + migration.
5. Enable production token auth and endpoint audit logging.

## Remaining External Dependency
- Deep scan currently uses a `stub` engine hook for queue/retry/quarantine flow validation.
- Production malware detection still requires deploying and wiring a real scanner runtime (e.g., ClamAV daemon).
