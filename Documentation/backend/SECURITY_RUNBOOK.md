# Security Operations Runbook

## Scope
This runbook covers upload scanner outages, fail-open triage, and quarantine workflow for durable multipart uploads (incident media, avatars, responder application documents).

## Pre-store ClamAV gate
When `FILE_DEEP_SCAN_ENGINE=clamav` and `FILE_SCANNER_AVAILABLE=true`, middleware runs ClamAV on in-memory buffers **before** durable storage (`writeObject`). Infected uploads are rejected with **400** and never written. Avatars and application documents use the same gate (they have no separate quarantine worker).

Production should set:
- `FILE_DEEP_SCAN_ENGINE=clamav`
- `FILE_SCANNER_AVAILABLE=true`
- `FILE_SCAN_FAIL_OPEN=false` (reject rather than store when ClamAV is down)
- Reachable `CLAMAV_HOST` / `CLAMAV_PORT`

## Scanner Modes (incident rows)
- `clean`: ClamAV already passed at upload time, or retry worker completed with no threat.
- `pending`: Legacy/backlog row queued for deep scan (should be rare when pre-store ClamAV is enabled).
- `unscanned`: Scanner unavailable, upload accepted in fail-open mode.
- `quarantined`: Threat detected by retry worker; files moved to quarantine.
- `error`: Scanner/deep-scan processing failed.

## Outage Handling (Fail-Open)
When `FILE_SCAN_FAIL_OPEN=true` and scanner is unavailable:
1. Upload may still be accepted (incident created to preserve emergency reporting continuity).
2. Incident response includes `security_scan.fail_open_flagged=true`.
3. Incident scan state is set to `unscanned` and picked up by retry worker.

### Immediate Operator Actions
1. Verify scanner health (`CLAMAV_HOST`/`CLAMAV_PORT` reachable).
2. Confirm retry worker is running (`FILE_SCAN_RETRY_CRON`).
3. Prioritize high-severity incidents with `scan_status=unscanned`.

## Quarantine Triage
When the retry worker deep scan returns a threat (legacy/fail-open rows only):
1. Files are moved to `QUARANTINE_DIR`.
2. Incident is marked `quarantined=true`, `scan_status=quarantined`.
3. Audio/media download endpoints return `403`.

### Dispatcher Review Checklist
- Confirm report legitimacy from metadata and transcript context.
- Request fresh media upload if evidence is required.
- Escalate suspicious repeated uploader patterns to admin.

## Recovery Checklist
1. Restore scanner availability.
2. Ensure retry worker catches up `pending`/`unscanned` incidents.
3. Verify scan status transitions from `unscanned`/`pending` to `clean` or `quarantined`.
4. Export list of affected incidents for audit report.

## Recommended Alerts
- Scanner unreachable for > 5 minutes.
- Count of `unscanned` incidents exceeds threshold.
- Any `quarantined` incident in last 24 hours.
- Spike in **400** upload rejections with `clamav_threat` findings.
