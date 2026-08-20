# Security Operations Runbook

## Scope
This runbook covers upload scanner outages, fail-open triage, and quarantine workflow for incident multimedia uploads.

## Scanner Modes
- `clean`: Deep scan completed and no threat found.
- `pending`: Uploaded and queued for deep scan.
- `unscanned`: Scanner unavailable, upload accepted in fail-open mode.
- `quarantined`: Threat detected; files moved to quarantine.
- `error`: Scanner/deep-scan processing failed.

## Outage Handling (Fail-Open)
When `FILE_SCAN_FAIL_OPEN=true` and scanner is unavailable:
1. Incident is still created to preserve emergency reporting continuity.
2. Response includes `security_scan.fail_open_flagged=true`.
3. Incident scan state is set to `unscanned` and picked up by retry worker.

### Immediate Operator Actions
1. Verify scanner health (`CLAMAV_HOST`/`CLAMAV_PORT` reachable).
2. Confirm retry worker is running (`FILE_SCAN_RETRY_CRON`).
3. Prioritize high-severity incidents with `scan_status=unscanned`.

## Quarantine Triage
When deep scan returns threat:
1. Files are moved to `QUARANTINE_DIR`.
2. Incident is marked `quarantined=true`, `scan_status=quarantined`.
3. Audio/media download endpoints return `403`.

### Dispatcher Review Checklist
- Confirm report legitimacy from metadata and transcript context.
- Request fresh media upload if evidence is required.
- Escalate suspicious repeated uploader patterns to admin.

## Recovery Checklist
1. Restore scanner availability.
2. Ensure queue worker catches up pending/unscanned incidents.
3. Verify scan status transitions from `unscanned`/`pending` to `clean` or `quarantined`.
4. Export list of affected incidents for audit report.

## Recommended Alerts
- Scanner unreachable for > 5 minutes.
- Count of `unscanned` incidents exceeds threshold.
- Any `quarantined` incident in last 24 hours.
