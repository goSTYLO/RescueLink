# Mobile Backlog

Last updated: 2026-03-04  
Component path: `Frontend/Mobile/`

## Manuscript Traceability
- FR-01 User Registration & Authentication
- FR-02 Emergency Report Submission
- FR-03 GPS Location Capture
- FR-04 Multimedia Attachment
- FR-09 Notification Service (client-facing)
- NFR: usability, reliability, performance, security

## Component Roll-up
- Progress: 46%
- Status: `In Progress`

## MO-E1 Authentication and Account Journey
- Progress: 74% | Status: `In Progress`
- Sub-epic MO-SE1.1 Auth API integration (79%, `In Progress`)
  - Story MO-US1.1.1 Register/login from mobile (88%, `In Progress`)
    - MO-T101 Registration API integration — `Done`
      - Evidence: `Frontend/Mobile/lib/services/auth_service.dart`
    - MO-T102 Login API integration — `Done`
      - Evidence: `Frontend/Mobile/lib/services/auth_service.dart`
    - MO-T103 Session/token persistence hardening — `In Progress`
    - MO-T104 Logout/token clear edge handling — `In Progress`
  - Story MO-US1.1.2 Account recovery flow (75%, `In Progress`)
    - MO-T105 Password reset request path — `Done`
    - MO-T106 OTP/recovery verification completion — `In Progress`
- Sub-epic MO-SE1.2 Role-aware onboarding (63%, `In Progress`)
  - Story MO-US1.2.1 Auth-state route orchestration (63%, `In Progress`)
    - MO-T107 Main route orchestration by auth state — `Done`
      - Evidence: `Frontend/Mobile/lib/main.dart`
    - MO-T108 Role-specific landing behavior — `In Progress`

## MO-E2 Incident Reporting and Submission
- Progress: 66% | Status: `In Progress`
- Sub-epic MO-SE2.1 Core incident report flow (79%, `In Progress`)
  - Story MO-US2.1.1 Submit emergency reports (83%, `In Progress`)
    - MO-T201 Emergency incident service call — `Done`
      - Evidence: `Frontend/Mobile/lib/services/incident_service.dart`
    - MO-T202 Required field validation hardening — `In Progress`
    - MO-T203 Consistent success/failure user feedback — `In Progress`
  - Story MO-US2.1.2 Submit audio-assisted reports (75%, `In Progress`)
    - MO-T204 Audio upload API wiring (`createWithAudio`) — `Done`
      - Evidence: `incident_service.dart`, `emergency_report_screen.dart`
    - MO-T205 Device audio recording UX — `Done`
    - MO-T206 Location/time/user metadata completeness — `In Progress`
- Sub-epic MO-SE2.2 Report reliability UX (25%, `In Progress`)
  - Story MO-US2.2.1 Safe retry and duplicate protection (25%, `In Progress`)
    - MO-T207 Retry strategy for transient failures — `In Progress`
    - MO-T208 Duplicate-submission prevention — `Not Started`
    - MO-T209 Offline draft/queue support — `Not Started`

## MO-E3 Location, Audio, and Attachments UX
- Progress: 62% | Status: `In Progress`
- Sub-epic MO-SE3.1 Geolocation capture (83%, `In Progress`)
  - Story MO-US3.1.1 Dispatch-usable location precision (83%, `In Progress`)
    - MO-T301 Device geolocation integration — `Done`
      - Evidence: `Frontend/Mobile/lib/services/geolocation_service.dart`
    - MO-T302 Attach coordinates in payload — `Done`
    - MO-T303 Barangay boundary/map-assisted selection completion — `In Progress`
- Sub-epic MO-SE3.2 Media handling (42%, `In Progress`)
  - Story MO-US3.2.1 Safe evidence media handling (42%, `In Progress`)
    - MO-T304 Recording permission/lifecycle hardening — `In Progress`
    - MO-T305 Additional multimedia attachment support — `In Progress`
    - MO-T306 Device-side size/format pre-validation — `Not Started`

## MO-E4 Citizen Dashboard and Incident Tracking UX
- Progress: 35% | Status: `In Progress`
- Sub-epic MO-SE4.1 Home/dashboard (33%, `In Progress`)
  - Story MO-US4.1.1 Functional home dashboard (33%, `In Progress`)
    - MO-T401 Replace `HomePlaceholderScreen` with production shell — `In Progress`
      - Evidence: `Frontend/Mobile/lib/screens/home/home_placeholder_screen.dart`
    - MO-T402 Incident status summary cards — `Not Started`
    - MO-T403 Quick actions cohesion for emergency/history — `In Progress`
- Sub-epic MO-SE4.2 Incident history UX (38%, `In Progress`)
  - Story MO-US4.2.1 Track submitted incidents (38%, `In Progress`)
    - MO-T404 Incident list fetch baseline (`getMyIncidents`) — `Done`
      - Evidence: `Frontend/Mobile/lib/services/incident_service.dart`
    - MO-T405 Incident detail UI completeness — `In Progress`
    - MO-T406 Realtime/near-realtime status refresh — `Not Started`

## MO-E5 Notifications and Real-time Updates
- Progress: 22% | Status: `Not Started`
- Sub-epic MO-SE5.1 Push notifications (0%, `Not Started`)
  - Story MO-US5.1.1 Receive report status alerts (0%, `Not Started`)
    - MO-T501 FCM/APNs client setup — `Not Started`
    - MO-T502 Device token registration with backend — `Not Started`
    - MO-T503 Notification deep-link routing — `Not Started`
- Sub-epic MO-SE5.2 In-app realtime channel (0%, `Not Started`)
  - Story MO-US5.2.1 In-app updates without relaunch (0%, `Not Started`)
    - MO-T504 Realtime bridge (SSE/WebSocket) or polling wrapper — `Not Started`
    - MO-T505 Notification center UI — `Not Started`

## MO-E6 Security and Privacy Hardening
- Progress: 40% | Status: `In Progress`
- Sub-epic MO-SE6.1 Secure app behavior (42%, `In Progress`)
  - Story MO-US6.1.1 Secure handling of sensitive state/data (42%, `In Progress`)
    - MO-T601 Secure token storage strategy completion — `In Progress`
    - MO-T602 TLS-only client + cert hardening policy — `In Progress`
    - MO-T603 Sensitive log redaction in release mode — `Not Started`
- Sub-epic MO-SE6.2 Abuse prevention (38%, `In Progress`)
  - Story MO-US6.2.1 Reduce spam/malicious report attempts (38%, `In Progress`)
    - MO-T604 Rate-limit UX hints and anti-spam controls — `Not Started`
    - MO-T605 reCAPTCHA path completion — `In Progress`

## MO-E7 Quality, Testing, and Release Engineering
- Progress: 36% | Status: `In Progress`
- Sub-epic MO-SE7.1 Automated tests (0%, `Not Started`)
  - Story MO-US7.1.1 Protect critical flows with tests (0%, `Not Started`)
    - MO-T701 Unit tests for auth/incident services — `Not Started`
    - MO-T702 Widget tests for core screens — `Not Started`
    - MO-T703 Integration test for report submission — `Not Started`
- Sub-epic MO-SE7.2 Release readiness (58%, `In Progress`)
  - Story MO-US7.2.1 Build and release readiness (58%, `In Progress`)
    - MO-T704 Resolve Android build TODO placeholders — `Not Started`
      - Evidence: `android/app/build.gradle.kts`
    - MO-T705 Production app ID/signing setup — `Not Started`
    - MO-T706 Startup/performance optimization pass — `In Progress`

  ## Integration Test Readiness (Current)
  - Master orchestration is available via `run_master_integration_tests.ps1` (root).
  - Current mobile phase in master run is dependency-gated and reports `SKIPPED` until a `Frontend/Mobile/test` baseline is added.
  - Near-term readiness target: land MO-T701 and MO-T703 baseline tests so mobile runs as an executed phase in the master integration pipeline.

## MO-E8 Backend Contract and Incident Sync Integration
- Progress: 33% | Status: `In Progress`
- Depends on: BE-E2, BE-E3, BE-E6
- Sub-epic MO-SE8.1 Incident history fetch and sync (50%, `In Progress`)
  - Story MO-US8.1.1 Reliable incident history fetch (50%, `In Progress`)
    - MO-T801 Align history API contract usage (`getMyIncidents`, filters, pagination) — `In Progress`
      - Evidence: `Frontend/Mobile/lib/services/incident_service.dart`
    - MO-T802 Preserve pagination/sort state across refresh — `Not Started`
    - MO-T803 Pull-to-refresh with stale-data indicator — `In Progress`
    - MO-T804 Empty/error/auth-expired state handling consistency — `In Progress`
- Sub-epic MO-SE8.2 Incident detail/status consistency (38%, `In Progress`)
  - Story MO-US8.2.1 Client status mapping aligned with backend lifecycle (38%, `In Progress`)
    - MO-T805 Canonical status enum mapping (`pending`, `verified`, `resolved`) — `In Progress`
    - MO-T806 Post-action detail refresh policy (create/verify/reclassify side-effects) — `Not Started`
    - MO-T807 With-AI detail fallback handling while AI is pending — `In Progress`
- Sub-epic MO-SE8.3 Contract governance and regression safety (25%, `In Progress`)
  - Story MO-US8.3.1 Contract drift prevention (25%, `In Progress`)
    - MO-T808 Mobile API contract checklist for incidents endpoints — `In Progress`
    - MO-T809 Parsing regression tests for list/detail payloads — `Not Started`
    - MO-T810 Request correlation ID propagation in client logs — `Not Started`
    - MO-T811 Track status enum mismatch decision until backend validator parity is complete — `In Progress`
- Sub-epic MO-SE8.4 Hybrid sync strategy (19%, `In Progress`)
  - Story MO-US8.4.1 Polling-first with realtime migration path (19%, `In Progress`)
    - MO-T812 Define polling interval SLA and battery/network guardrails — `In Progress`
    - MO-T813 Implement resilient polling channel for history/status updates — `Not Started`
    - MO-T814 Realtime migration plan (SSE/WebSocket) with de-dup merge rules — `Not Started`

## Audit Notes
- Strongest area: auth and incident submission wiring.
- Major product gap: placeholder-heavy dashboard/history experience.
- New highest priority: MO-E8 backend integration closure for history correctness and sync reliability, plus MO-E7 test-baseline activation for master-run participation.