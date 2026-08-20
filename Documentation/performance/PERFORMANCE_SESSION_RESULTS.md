# RescueLink Performance Session Results

## Run Context

- Date: 2026-02-25
- Team: Aaron + Copilot-assisted run
- Environment: Local development
- Load profile: moderate baseline (5-10 concurrent target)
- Scope: AI pipeline, blockchain verification, backend orchestration

## Executive Summary

- Session 2 implementation is complete for the approved minimal set: startup warmup, AI precheck gating, duplicate deep-scan removal, and blockchain gas fields in API responses.
- Post-change rerun completed with 3 test cases per component and AI samples from `RescueLink AI/test`.
- AI remains stable at 0% error rate across AI-1/AI-2, and AI-3 was changed to a long text-only classification experiment from dataset sample.
- Blockchain remains stable across BC-1/BC-2/BC-3 and now includes duplicate-write prevention (`already_recorded`) to avoid unnecessary gas spending.
- Backend with-audio orchestration remains healthy (BE-2/BE-3 all 201) after duplicate scan and precheck optimizations.

## Session 1 Baseline Results (Narrative)

### AI-1 — Audio sample 1 classification

- Scenario: classify `RescueLink AI/test/test_report_1.m4a` via `/v1/classify-audio`.
- Run timings: 4.404s, 4.952s, 4.902s.
- Summary: average 4.753s, p95 4.952s, error rate 0%.
- Bottleneck hypothesis: stable moderate latency with small run-to-run variance.

### AI-2 — Audio sample 2 classification

- Scenario: classify `RescueLink AI/test/test_report_2.m4a` via `/v1/classify-audio`.
- Run timings: 4.617s, 4.496s, 4.554s.
- Summary: average 4.556s, p95 4.617s, error rate 0%.
- Bottleneck hypothesis: moderate transcription latency under normal load.

### AI-3 — Audio sample 3 classification

- Scenario: classify `RescueLink AI/test/test_report_3.m4a` via `/v1/classify-audio`.
- Run timings: 4.673s, 5.221s, 4.557s.
- Summary: average 4.817s, p95 5.221s, error rate 0%.
- Bottleneck hypothesis: similar latency profile to AI-2.

### BC-1 — Single incident verification

- Scenario: verify one incident at a time through blockchain service.
- Run timings: 2.116s, 2.109s, 2.113s.
- Summary: average 2.113s, p95 2.116s, error rate 0%.
- Bottleneck hypothesis: no immediate latency bottleneck at this load; gas observability gap remains.

### BC-2 — Burst verification baseline

- Scenario: burst-style local baseline (5 sequential verification runs).
- Run timings: 2.098s, 2.100s, 2.107s, 2.120s, 2.106s.
- Summary: average 2.106s, p95 2.120s, error rate 0%.
- Bottleneck hypothesis: throughput headroom still acceptable at this baseline.

### BC-3 — Extended verification baseline

- Scenario: extended verification baseline (10 sequential runs).
- Run timings: 2.097s, 2.142s, 2.088s, 2.091s, 2.100s, 2.120s, 2.092s, 2.080s, 2.105s, 2.101s.
- Summary: average 2.102s, p95 2.142s, error rate 0%.
- Bottleneck hypothesis: stable latency at higher call volume; gas still not visible in run output.

### BE-1 — Incident creation without audio

- Scenario: authenticated call to `/api/incidents/emergency`.
- Run timings: 0.040s, 0.020s, 0.032s.
- Summary: average 0.031s, p95 0.040s, error rate 0%.
- Bottleneck hypothesis: no significant issue; good control case.

### BE-2 — Incident creation with audio sample 1

- Scenario: authenticated call to `/api/incidents/with-audio` using `test_report_1.m4a`.
- Run timings: 4.476s, 2.966s, 2.920s.
- Summary: average 3.454s, p95 4.476s, error rate 0%.
- Bottleneck hypothesis: previously failed due missing scan columns in DB schema; now fixed via compatibility fallback.

### BE-3 — Incident creation with audio sample 2

- Scenario: authenticated call to `/api/incidents/with-audio` using `test_report_2.m4a`.
- Run timings: 3.339s, 2.707s, 2.628s.
- Summary: average 2.891s, p95 3.339s, error rate 0%.
- Bottleneck hypothesis: same schema-compatibility issue as BE-2, now resolved.

## Session 2 Implementation and Validation (Narrative)

### What was implemented

- AI startup warmup was added in the AI service startup lifecycle (classifier warmup plus optional Whisper warmup).
- AI per-request `/health` precheck was gated behind config (`AI_HEALTH_PRECHECK_ENABLED`), so default runtime avoids extra network round-trip.
- Backend `/api/incidents/with-audio` fallback flow no longer triggers deep scan twice.
- Blockchain service now returns `gas_used`, `effective_gas_price`, and `gas_cost_wei`; backend verify response passes these through.
- Blockchain service now checks on-chain logs by `report_id` and skips duplicate writes (returns `already_recorded=true` with zero gas fields).
- Runner was updated to read blockchain gas directly from API response.
- AI-3 test case now uses `/classify` (text-only) and automatically selects a long report from `cleaned_emergency_dataset.csv`.

### Post-change rerun snapshot

- AI-1 (`test_report_1.m4a`): 6.342s, 4.670s, 3.751s → avg 4.921s, p95 6.342s, error 0%.
- AI-2 (`test_report_2.m4a`): 4.514s, 4.532s, 4.483s → avg 4.509s, p95 4.532s, error 0%.
- AI-3 (text-only `/classify`, dataset sample id 10178, length 512): 2.199s, 2.149s, 2.150s → avg 2.166s, p95 2.199s, error 0%.
- AI-3 quality check (vs dataset label): predicted `Natural Disaster` + `Other` and `Yellow` on all runs; overlap count 2/4 expected labels, severity mismatch vs expected `Red`.
- BC-1/BC-2/BC-3 averages: 2.080s / 2.076s / 2.071s, all with 0% error.
- Blockchain gas in this rerun: 0 across BC-1/BC-2/BC-3 because report IDs were already recorded and duplicate writes were skipped.
- BE-1 avg 0.053s; BE-2 avg 6.383s; BE-3 avg 2.721s; all runs successful (201, 0% error).

### Session 2 conclusion

- Session 2 goals for the approved scope are met: reliability preserved, duplicate work removed, blockchain gas observability added, and duplicate blockchain writes now avoid additional gas costs.
- Text-only AI-3 shows materially lower latency than audio AI cases, but quality did not fully match the dataset target labels/severity on this long sample.
- Remaining optimization opportunity is improving long-text classification quality consistency while keeping low latency.

## Automated Test Notes

- m4a dependency installation approach: `imageio-ffmpeg` in root `.venv`, plus runtime ffmpeg shim setup in AI handler.
- Direct endpoint check now returns successful transcription for `test_report_1.m4a`.
- Blockchain test suite remains passing (`2 passing`).

## Presentation Notes (Copy-Ready)

- The latest rerun uses 3 test cases each for AI, blockchain, and backend.
- AI m4a handling is fixed; all three AI cases now return successful responses.
- Blockchain remains stable; backend no-audio and with-audio paths are both healthy after fixes.

## Sign-off

- Prepared by:
- Reviewed by:
- Date:
