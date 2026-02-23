# Security Manual QA Checklist

## Purpose
Manual validation checklist for AI fallback, upload scanning, quarantine handling, and media compression.

## Pre-Checks
- Backend running with current `.env`.
- RescueLink AI service running.
- Scanner mode configured (`stub` or `clamav`).
- Test account with permissions to create incidents.

## AI Fallback Scenarios
- [ ] Submit low-confidence text/audio sample and verify `fallback_used=true`.
- [ ] Simulate AI model/transcription error and verify fallback reason is `model_error`.
- [ ] Verify fallback metadata fields are present in AI response.

## Upload Security Scenarios
- [ ] Upload valid audio/image and confirm incident created with `security_scan` metadata.
- [ ] Upload blocked signature sample and confirm request is rejected (`400`).
- [ ] Upload extension/signature mismatch sample and confirm request is rejected (`400`).

## Fail-Open and Retry Scenarios
- [ ] Set scanner unavailable with fail-open enabled; verify incident accepted with `fail_open_flagged=true`.
- [ ] Verify scan status is `unscanned` and later retried by scan worker.
- [ ] Set fail-open disabled while scanner unavailable; verify request returns `503`.

## Quarantine Scenarios
- [ ] Trigger threat detection (simulated name match or ClamAV EICAR) and verify `scan_status=quarantined`.
- [ ] Verify quarantined files move to `QUARANTINE_DIR`.
- [ ] Verify audio/media download endpoints return `403` for quarantined incidents.

## Compression Scenarios
- [ ] Upload large JPG/PNG and verify saved file size is reduced.
- [ ] Upload large MOV/AVI/MP4 and verify output is transcoded/compressed when FFmpeg available.
- [ ] Verify fallback-to-original works when compression dependencies are unavailable.

## Post-Validation
- [ ] Confirm `security_scan` metadata appears in `POST /api/incidents/with-audio` responses.
- [ ] Confirm no sensitive transcript data is logged in full.
- [ ] Record findings and attach evidence screenshots/log snippets.
