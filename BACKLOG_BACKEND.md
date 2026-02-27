# Backend Backlog

Last updated: 2026-02-27  
Component path: `Backend/`

## Manuscript Traceability
- FR-01 User Registration & Authentication
- FR-02 Emergency Report Submission
- FR-04 Multimedia Attachment
- FR-05 AI Incident Classification
- FR-06 False Report Detection
- FR-07 Blockchain Logging
- FR-09 Notification Service
- NFR: security, reliability, performance, scalability

## Component Roll-up
- Progress: 61%
- Status: `In Progress`

## BE-E1 Identity, Access, and Session Security
- Progress: 75% | Status: `In Progress`
- Sub-epic BE-SE1.1 Account lifecycle (77%, `In Progress`)
  - Story BE-US1.1.1 Secure register/login (88%, `In Progress`)
    - BE-T101 Register endpoint with validation — `Done`
      - Evidence: `Backend/src/app.js`
    - BE-T102 Login endpoint with password verification — `Done`
      - Evidence: `Backend/src/app.js`
    - BE-T103 JWT token issuance — `Done`
      - Evidence: auth flow usage across clients
    - BE-T104 Password reset flow parity verification — `In Progress`
      - Evidence: consumed by mobile; backend parity check pending
  - Story BE-US1.1.2 Role and department access (67%, `In Progress`)
    - BE-T105 Persist role fields/mapping — `Done`
      - Evidence: RBAC migrations and tests
    - BE-T106 Enforce role guards — `Done`
      - Evidence: `Backend/tests/rbac.test.js`
    - BE-T107 Admin role assignment endpoints completion — `In Progress`
- Sub-epic BE-SE1.2 Session hardening (72%, `In Progress`)
  - Story BE-US1.2.1 Session abuse protection (72%, `In Progress`)
    - BE-T108 Token blacklist/revocation — `Done`
      - Evidence: `Backend/migrations/add_token_blacklist.sql`
    - BE-T109 OTP/MFA for privileged users — `In Progress`
      - Evidence: `Backend/migrations/add_dispatcher_login_otp.sql`
    - BE-T110 Login throttling/brute-force protections — `In Progress`

## BE-E2 Incident Intake and Core Orchestration
- Progress: 72% | Status: `In Progress`
- Sub-epic BE-SE2.1 Incident creation APIs (83%, `In Progress`)
  - Story BE-US2.1.1 Emergency incident submission (100%, `Done`)
    - BE-T201 `createEmergencyIncident` endpoint — `Done`
      - Evidence: `Backend/src/controllers/incident.js`
    - BE-T202 Payload validation and normalization — `Done`
    - BE-T203 Incident persistence with defaults — `Done`
    - BE-T204 Tracking identifiers in response — `Done`
  - Story BE-US2.1.2 Incident with media/audio (67%, `In Progress`)
    - BE-T205 Multipart upload middleware — `Done`
      - Evidence: `Backend/tests/uploadMiddleware.integration.test.js`
    - BE-T206 Upload metadata persistence — `Done`
    - BE-T207 Upload constraints hardening — `In Progress`
- Sub-epic BE-SE2.2 Incident workflow lifecycle (83%, `In Progress`)
  - Story BE-US2.2.1 Verify/reclassify lifecycle (83%, `In Progress`)
    - BE-T208 `verifyIncident` flow — `Done`
      - Evidence: `Backend/src/controllers/incident.js`
    - BE-T209 `reclassifyIncident` flow — `Done`
      - Evidence: `Backend/src/controllers/incident.js`
    - BE-T210 Formal lifecycle state-machine enforcement — `In Progress`

## BE-E3 AI and Audio Integration
- Progress: 66% | Status: `In Progress`
- Sub-epic BE-SE3.1 AI service orchestration (58%, `In Progress`)
  - Story BE-US3.1.1 AI classify/transcribe and persistence (67%, `In Progress`)
    - BE-T301 AI classify client — `Done`
      - Evidence: `Backend/src/services/aiService.js`
    - BE-T302 AI transcribe client — `Done`
      - Evidence: `Backend/src/services/aiService.js`
    - BE-T303 Confidence/label mapping calibration — `In Progress`
  - Story BE-US3.1.2 AI degradation tolerance (50%, `In Progress`)
    - BE-T304 Timeout/retry policy completion — `In Progress`
    - BE-T305 Fallback behavior quality gates — `In Progress`
    - BE-T306 Repeated AI-failure alerting — `Not Started`
- Sub-epic BE-SE3.2 Audio-first intake (83%, `In Progress`)
  - Story BE-US3.2.1 Voice evidence pipeline (83%, `In Progress`)
    - BE-T307 `createWithAudio` endpoint — `Done`
      - Evidence: `Backend/src/controllers/incident.js`
    - BE-T308 Audio metadata persistence — `Done`
    - BE-T309 Structured AI result persistence depth — `In Progress`

## BE-E4 Blockchain Verification and Auditability
- Progress: 64% | Status: `In Progress`
- Sub-epic BE-SE4.1 Verification integrity (83%, `In Progress`)
  - Story BE-US4.1.1 Immutable verification anchoring (83%, `In Progress`)
    - BE-T401 Blockchain verification service integration — `Done`
      - Evidence: `Backend/src/services/blockchainService.js`
    - BE-T402 Trigger chain write on verification — `Done`
      - Evidence: `Backend/src/controllers/incident.js`
    - BE-T403 Transaction/hash persistence completeness — `In Progress`
- Sub-epic BE-SE4.2 Auditability (58%, `In Progress`)
  - Story BE-US4.2.1 Action trace visibility (58%, `In Progress`)
    - BE-T404 Audit route mount — `Done`
      - Evidence: `Backend/src/app.js`
    - BE-T405 Sensitive action matrix coverage — `In Progress`
    - BE-T406 Filter/export maturity — `In Progress`

## BE-E5 Upload Security and Threat Mitigation
- Progress: 45% | Status: `In Progress`
- Sub-epic BE-SE5.1 Upload scanning pipeline (50%, `In Progress`)
  - Story BE-US5.1.1 Pre-trust file scanning (50%, `In Progress`)
    - BE-T501 Lightweight signature scan — `Done`
      - Evidence: `Backend/src/services/fileScanService.js`
    - BE-T502 Deep-scan queue interface — `In Progress`
    - BE-T503 Replace `stub` deep engine — `Not Started`
      - Evidence: `FILE_DEEP_SCAN_ENGINE=stub`
    - BE-T504 Quarantine/release workflow completion — `In Progress`
- Sub-epic BE-SE5.2 Security controls (42%, `In Progress`)
  - Story BE-US5.2.1 API and payload hardening (42%, `In Progress`)
    - BE-T505 Full endpoint validation/sanitization coverage — `In Progress`
    - BE-T506 TLS/JWT hardening verification — `In Progress`
    - BE-T507 IDS/firewall/backup ops linkage — `In Progress`

## BE-E6 Notification and Event Dispatch
- Progress: 28% | Status: `Not Started`
- Sub-epic BE-SE6.1 Notification microservice integration (0%, `Not Started`)
  - Story BE-US6.1.1 Push/SMS event delivery (0%, `Not Started`)
    - BE-T601 Event publication on create/verify — `Not Started`
    - BE-T602 Push provider integration — `Not Started`
    - BE-T603 SMS fallback integration — `Not Started`
    - BE-T604 Retry/dead-letter handling — `Not Started`
- Sub-epic BE-SE6.2 Preference management (0%, `Not Started`)
  - Story BE-US6.2.1 User/dispatcher channel preferences (0%, `Not Started`)
    - BE-T605 Preference model — `Not Started`
    - BE-T606 Preference endpoints — `Not Started`

## BE-E7 Testing, Performance, and Operational Readiness
- Progress: 76% | Status: `In Progress`
- Sub-epic BE-SE7.1 Automated test coverage (100%, `Done`)
  - Story BE-US7.1.1 Backend critical flow regression tests (100%, `Done`)
    - BE-T701 Incident lifecycle integration tests — `Done`
    - BE-T702 RBAC security tests — `Done`
    - BE-T703 Upload middleware tests — `Done`
    - BE-T704 AI service tests — `Done`
    - BE-T705 File scan service tests — `Done`
    - BE-T706 Incident security tests — `Done`
- Sub-epic BE-SE7.2 Performance/scalability readiness (58%, `In Progress`)
  - Story BE-US7.2.1 Load resilience and deployment hardening (58%, `In Progress`)
    - BE-T707 Baseline latency instrumentation — `In Progress`
    - BE-T708 Throughput/load script CI integration — `In Progress`
    - BE-T709 Production hardening checklist closure — `In Progress`

## Audit Notes
- Strongest area: incident lifecycle + test coverage.
- Highest risk: deep scan engine still stub-based.
- Biggest delivery gap: notification/event dispatch epic remains largely unstarted.