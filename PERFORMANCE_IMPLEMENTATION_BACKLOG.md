# Performance Implementation Backlog

Date: 2026-02-25
Owner: Aaron + Copilot

## Status Legend
- Ready
- In Progress
- Blocked
- Done

## Backlog Items

1) Add end-to-end request correlation (`x-request-id`)
- Status: Done
- Scope: Mobile/Web -> Backend -> AI/Blockchain
- Evidence: Mobile/Web API headers updated, Backend request-id middleware added, AI/Blockchain response headers set
- Blocker: None

2) Add hybrid runtime timing logs for UI-triggered flows
- Status: Done
- Scope: incident submit with audio, incident verification, AI call path
- Evidence: Mobile and Web API client logs, Backend incident lifecycle logs, AI/Blockchain endpoint logs
- Blocker: None

3) Add AI service endpoint lifecycle logs
- Status: Done
- Scope: `/v1/classify-audio` start/end + latency + status + request id
- Evidence: classify-audio start/end/error logs with latency and request id
- Blocker: None

4) Add Blockchain verify lifecycle logs
- Status: Done
- Scope: `/verify-incident` start/end + latency + report id + tx hash prefix
- Evidence: verify-incident start/success/error logs with request id and latency
- Blocker: None

5) Update audio sample references to new files
- Status: Done
- Scope: `test_report_1/2/3.m4a`
- Evidence: Backend integration test and perf runner switched to `test_report_1.m4a`
- Blocker: None

6) Make performance results markdown narrative (no tables)
- Status: Done
- Scope: executive summary + per-case sections + bottlenecks + next fixes
- Evidence: Session results rewritten to narrative sections and bullet summaries
- Blocker: None

7) Validate with targeted test runs
- Status: Done
- Scope: blockchain tests + perf runner + smoke checks
- Evidence: Blockchain tests passed (2 passing), perf runner executed with updated audio sample references
- Blocker: None

8) Remove duplicate deep scan invocation in backend fallback
- Status: Done
- Scope: `/api/incidents/with-audio` AI-fallback path
- Evidence: `createWithAudio` now runs deep scan once and reuses result in fallback response
- Blocker: None

9) Gate AI per-request health precheck
- Status: Done
- Scope: AI service integration in backend
- Evidence: `AI_HEALTH_PRECHECK_ENABLED` added; default runtime skips per-request `/health` call
- Blocker: None

10) Add AI startup warmup
- Status: Done
- Scope: classifier warmup + optional Whisper warmup at service startup
- Evidence: AI startup event now performs controlled warmup with env-based toggles
- Blocker: None

11) Expose blockchain gas metrics via API
- Status: Done
- Scope: Blockchain FastAPI response + backend pass-through
- Evidence: `/verify-incident` now returns `gas_used`, `effective_gas_price`, `gas_cost_wei`; backend verify response includes same fields
- Blocker: None

12) Update runner to consume gas from API response
- Status: Done
- Scope: `perf_session1_runner.py` blockchain case parser
- Evidence: latest rerun shows populated gas stats (avg/min/max)
- Blocker: None

13) Prevent duplicate blockchain writes
- Status: Done
- Scope: Blockchain verify flow checks existing `IncidentVerified` logs by `report_id` before sending tx
- Evidence: duplicate verify returns same tx hash with `already_recorded=true` and zero gas fields
- Blocker: None

## Progress Log
- 2026-02-25: Backlog created.
- 2026-02-25: Implemented request-id propagation, hybrid logs, audio sample reference updates, and narrative results format.
- 2026-02-25: Validation complete: blockchain tests passed and perf runner completed with current baseline metrics.
- 2026-02-25: Session 2 minimal scope implemented and validated (warmup, precheck gating, duplicate deep scan removal, gas observability); post-change rerun completed with all cases successful.
- 2026-02-25: Added duplicate blockchain write prevention and reran perf script; duplicate IDs now skip new transactions and report zero gas.
