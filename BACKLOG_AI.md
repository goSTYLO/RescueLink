# AI Backlog

Last updated: 2026-02-27  
Component path: `RescueLink AI/`

## Manuscript Traceability
- FR-05 AI Incident Classification
- FR-06 False Report Detection
- FR-09 Notification-adjacent signal generation
- NFR: performance, reliability, security, scalability

## Component Roll-up
- Progress: 47%
- Status: `In Progress`
- Direction change: STT will migrate from internet-dependent HF inference to local quantized inference suitable for current machine capacity.

## AI-E1 AI API Foundation and Contract
- Progress: 76% | Status: `In Progress`
- Sub-epic AI-SE1.1 Endpoint surface (89%, `In Progress`)
  - Story AI-US1.1.1 Text classification contract (100%, `Done`)
    - AI-T101 `/classify` endpoint — `Done`
      - Evidence: `RescueLink AI/api/main.py`
    - AI-T102 Labels/confidence response schema — `Done`
    - AI-T103 Validation and clear HTTP errors — `Done`
  - Story AI-US1.1.2 Audio+classification single-call contract (83%, `In Progress`)
    - AI-T104 `/classify-audio` endpoint — `Done`
    - AI-T105 Transcription + classification payload — `Done`
    - AI-T106 Explicit versioning strategy — `In Progress`
- Sub-epic AI-SE1.2 Service packaging (63%, `In Progress`)
  - Story AI-US1.2.1 Local/cloud run readiness (63%, `In Progress`)
    - AI-T107 Configurable startup/run docs — `Done`
    - AI-T108 Production packaging/containerization — `In Progress`
    - AI-T109 Backend environment contract clarity — `Done`

## AI-E2 Audio Transcription Pipeline
- Progress: 58% | Status: `In Progress`
- Sub-epic AI-SE2.1 Cloud STT baseline (legacy path) (100%, `Done`)
  - Story AI-US2.1.1 Legacy constrained transcription flow (100%, `Done`)
    - AI-T201 Whisper handler implementation — `Done`
      - Evidence: `RescueLink AI/audio/whisper_handler.py`
    - AI-T202 HF InferenceClient integration — `Done`
    - AI-T203 Duration/payload guardrails — `Done`
    - AI-T204 Structured usage statistics — `Done`
- Sub-epic AI-SE2.2 Local quantized STT migration (15%, `In Progress`)
  - Story AI-US2.2.1 Offline-first transcription reliability (15%, `In Progress`)
    - AI-T205 Select local quantized Whisper-family model for machine constraints (CPU/GPU/RAM) — `In Progress`
    - AI-T206 Add local inference backend abstraction and provider toggle (local vs legacy cloud) — `Not Started`
    - AI-T207 Implement local model loader with warmup and lazy fallback strategy — `Not Started`
    - AI-T208 Replace runtime HF dependency in primary transcription path — `Not Started`
    - AI-T209 Add deterministic offline mode flag with hard fail if internet path unavailable — `Not Started`
- Sub-epic AI-SE2.3 Audio resiliency under local runtime (22%, `In Progress`)
  - Story AI-US2.3.1 Graceful degradation for local inference (22%, `In Progress`)
    - AI-T210 Timeout/retry behavior for local inference jobs — `In Progress`
    - AI-T211 Failed/empty transcription fallback completion — `In Progress`
    - AI-T212 Queue-based async burst handling — `Not Started`
    - AI-T213 Memory pressure handling and model unload/reload policy — `Not Started`
    - AI-T214 Large-audio chunking strategy for local execution — `Not Started`

## AI-E7 Local Model Performance and Deployment Readiness
- Progress: 8% | Status: `In Progress`
- Sub-epic AI-SE7.1 Quantized model benchmarking (10%, `In Progress`)
  - Story AI-US7.1.1 Model is fast enough on target machine (10%, `In Progress`)
    - AI-T701 Benchmark candidate quantized models (tiny/base/small/medium variants) on representative rescue audio — `In Progress`
    - AI-T702 Record latency, real-time factor, memory usage, and transcription quality per model — `Not Started`
    - AI-T703 Select default model profile and backup profile for low-resource mode — `Not Started`
    - AI-T704 Define acceptance threshold (target p95 latency and minimum accuracy) — `Not Started`
- Sub-epic AI-SE7.2 Local runtime packaging (5%, `In Progress`)
  - Story AI-US7.2.1 Team can run local STT consistently (5%, `In Progress`)
    - AI-T705 Pin local inference dependencies and version lockfile — `Not Started`
    - AI-T706 Document one-command local model setup and cache path strategy — `Not Started`
    - AI-T707 Add startup preflight checks for model files, device capability, and disk space — `Not Started`
    - AI-T708 Add environment template for model path, compute type, thread count, and batch size — `Not Started`
- Sub-epic AI-SE7.3 Regression and fallback policy (8%, `In Progress`)
  - Story AI-US7.3.1 Migration does not regress API contracts (8%, `In Progress`)
    - AI-T709 Add regression tests comparing cloud-baseline vs local output schema consistency — `Not Started`
    - AI-T710 Add canary mode to shadow-run local STT and compare confidence/latency before full cutover — `Not Started`
    - AI-T711 Define rollback policy to legacy provider for emergency incidents only — `In Progress`
    - AI-T712 Remove rollback dependency after local path proves reliability target — `Not Started`

## AI-E3 Classification Quality and False Report Detection
- Progress: 46% | Status: `In Progress`
- Sub-epic AI-SE3.1 Incident classification quality (58%, `In Progress`)
  - Story AI-US3.1.1 Category + severity confidence quality (58%, `In Progress`)
    - AI-T301 Core label mapping pipeline — `Done`
    - AI-T302 Severity thresholds governance — `In Progress`
    - AI-T303 Calibration workflow with datasets — `In Progress`
- Sub-epic AI-SE3.2 False report detection (12%, `In Progress`)
  - Story AI-US3.2.1 Suspicious report flagging (12%, `In Progress`)
    - AI-T304 Anomaly/fraud signal extraction — `In Progress`
    - AI-T305 Dedicated false-report classifier/ruleset — `Not Started`
    - AI-T306 False-report confidence in API response — `Not Started`
    - AI-T307 Human-review recommendation policy — `Not Started`
- Sub-epic AI-SE3.3 Continuous model improvement (0%, `Not Started`)
  - Story AI-US3.3.1 Feedback-driven model improvement (0%, `Not Started`)
    - AI-T308 Feedback capture schema — `Not Started`
    - AI-T309 Scheduled retraining pipeline — `Not Started`
    - AI-T310 Drift monitoring alerts — `Not Started`

## AI-E4 Security, Access, and Abuse Controls
- Progress: 58% | Status: `In Progress`
- Sub-epic AI-SE4.1 API security and request constraints (83%, `In Progress`)
  - Story AI-US4.1.1 Abuse-resistant endpoint behavior (83%, `In Progress`)
    - AI-T401 Internal API token check — `Done`
      - Evidence: `RescueLink AI/api/main.py`
    - AI-T402 Text/audio constraint guardrails — `Done`
    - AI-T403 Safe error response hardening — `In Progress`
- Sub-epic AI-SE4.2 Secrets and dependency security (33%, `In Progress`)
  - Story AI-US4.2.1 Secrets/dependency hardening (33%, `In Progress`)
    - AI-T404 Full env-only secret handling — `In Progress`
    - AI-T405 Dependency vulnerability scanning in pipeline — `Not Started`
    - AI-T406 API abuse security test suite expansion — `In Progress`

## AI-E5 Observability and Reliability Engineering
- Progress: 34% | Status: `In Progress`
- Sub-epic AI-SE5.1 Operational telemetry (17%, `In Progress`)
  - Story AI-US5.1.1 Service health and quality observability (17%, `In Progress`)
    - AI-T501 Structured logs with correlation IDs — `In Progress`
    - AI-T502 Metrics endpoint for latency/errors/throughput — `Not Started`
    - AI-T503 Dashboard alerts for error spikes — `Not Started`
- Sub-epic AI-SE5.2 Reliability strategy (50%, `In Progress`)
  - Story AI-US5.2.1 Incident-time availability safeguards (50%, `In Progress`)
    - AI-T504 Health/readiness probes — `In Progress`
    - AI-T505 Circuit-breaker guidance for backend callers — `In Progress`
    - AI-T506 Autoscaling/load profile policy — `Not Started`

## AI-E6 Testing, Benchmarking, and Release Maturity
- Progress: 28% | Status: `In Progress`
- Sub-epic AI-SE6.1 Automated testing (33%, `In Progress`)
  - Story AI-US6.1.1 API/model pre-release validation (33%, `In Progress`)
    - AI-T601 Fallback rule unit tests — `Done`
      - Evidence: `RescueLink AI/test/test_fallback_rules.py`
    - AI-T602 Endpoint contract tests — `Not Started`
    - AI-T603 Fixture-based regression suite — `Not Started`
- Sub-epic AI-SE6.2 Benchmarking and release (25%, `In Progress`)
  - Story AI-US6.2.1 KPI reporting against latency/accuracy targets (25%, `In Progress`)
    - AI-T604 Latency/throughput benchmark scripts — `In Progress`
    - AI-T605 Automated accuracy report generation — `Not Started`
    - AI-T606 Release gates/promotion checklist closure — `In Progress`

## Audit Notes
- Strongest area: API foundation and core audio pipeline.
- Largest delivery gaps: local quantized STT migration completion, explicit false-report module, and confidence output.
- Operational gap: observability, production reliability tooling, and local-model benchmark automation remain early.
- Priority shift: internet-dependent transcription path is now legacy baseline; offline-first local inference is primary delivery objective.