# Web Backlog

Last updated: 2026-02-27  
Component path: `Frontend/Web/dispatcher_dashboard/`

## Manuscript Traceability
- FR-08 Responder Dashboard
- FR-07 Blockchain logging visibility (backend-fed)
- FR-09 Notification and coordination surfaces
- NFR: usability, reliability, security, performance

## Component Roll-up
- Progress: 64%
- Status: `In Progress`

## WE-E1 Dispatcher Authentication and Access Control UX
- Progress: 88% | Status: `In Progress`
- Sub-epic WE-SE1.1 Login and session flow (100%, `Done`)
  - Story WE-US1.1.1 Authenticated route access (100%, `Done`)
    - WE-T101 Login page and auth submission — `Done`
      - Evidence: `src/presentation/pages/Login.jsx`
    - WE-T102 Protected route redirects/guards — `Done`
      - Evidence: `src/App.jsx`
    - WE-T103 Session persistence and logout edge handling — `Done`
      - Evidence: `src/core/auth/session.js`, `src/presentation/components/layout/Layout.jsx`, `src/presentation/pages/ProfilePage.jsx`
- Sub-epic WE-SE1.2 Role-aware navigation (83%, `In Progress`)
  - Story WE-US1.2.1 Role-scoped UX access (83%, `In Progress`)
    - WE-T104 Route-level role gating completeness — `Done`
      - Evidence: `src/App.jsx`
    - WE-T105 Action-level permission checks — `Done`
      - Evidence: `src/core/constants/index.js`, `src/App.jsx`, `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T106 Unauthorized flow feedback polish — `Done`
      - Evidence: `src/presentation/components/common/AccessDeniedNotice.jsx`

## WE-E2 Incident Dashboard and Queue Management
- Progress: 81% | Status: `In Progress`
- Sub-epic WE-SE2.1 Dashboard summary/filtering (92%, `In Progress`)
  - Story WE-US2.1.1 Priority-based queue monitoring (92%, `In Progress`)
    - WE-T201 Dashboard summaries/cards — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`
    - WE-T202 Incident filtering controls — `Done`
    - WE-T203 Prioritization/sorting policy completion — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`
- Sub-epic WE-SE2.2 Incident API integration (83%, `In Progress`)
  - Story WE-US2.2.1 Consistent list/detail API usage (83%, `In Progress`)
    - WE-T204 Incident list API client — `Done`
      - Evidence: `src/data/api/incidents.api.js`
    - WE-T205 Incident detail API client — `Done`
    - WE-T206 Error/retry/empty-state standardization — `Done`
      - Evidence: `src/data/api/incidents.api.js`, `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`

## WE-E3 Incident Command and Response Operations
- Progress: 76% | Status: `In Progress`
- Sub-epic WE-SE3.1 Incident detail operations (88%, `In Progress`)
  - Story WE-US3.1.1 Inspect and act on incident detail (88%, `In Progress`)
    - WE-T301 Incident detail page timeline/context — `Done`
      - Evidence: `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T302 Verify action integration — `Done`
    - WE-T303 Reclassify action integration — `Done`
    - WE-T304 Manual override reason governance — `Done`
      - Evidence: `src/presentation/pages/IncidentDetailsPage.jsx`, `Backend/src/controllers/incident.js`
- Sub-epic WE-SE3.2 Dispatch coordination (50%, `In Progress`)
  - Story WE-US3.2.1 Department coordination workflow depth (50%, `In Progress`)
    - WE-T305 Department assignment UX completion — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T306 Availability integration depth — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T307 Cross-department communication log consistency — `Done`
      - Evidence: `src/presentation/pages/IncidentDetailsPage.jsx`

## WE-E4 Map and Geospatial Operations
- Progress: 79% | Status: `In Progress`
- Sub-epic WE-SE4.1 Map views (100%, `Done`)
  - Story WE-US4.1.1 Incident map with filtering (100%, `Done`)
    - WE-T401 Map rendering page — `Done`
      - Evidence: `src/presentation/pages/MapViewPage.jsx`
    - WE-T402 Department/barangay filters — `Done`
    - WE-T403 Live update cadence completion — `Done`
      - Evidence: `src/presentation/pages/MapViewPage.jsx`
- Sub-epic WE-SE4.2 Geospatial intelligence (67%, `In Progress`)
  - Story WE-US4.2.1 Route/alert/heatmap optimization (67%, `In Progress`)
    - WE-T404 Closest-unit/ETA suggestions — `Done`
      - Evidence: `src/data/api/location.api.js`, `src/presentation/pages/MapViewPage.jsx`
    - WE-T405 Geofence/area alerting — `Done`
      - Evidence: `src/data/api/location.api.js`, `src/presentation/pages/MapViewPage.jsx`
    - WE-T406 Heatmap/hotspot layers — `Done`
      - Evidence: `src/data/api/location.api.js`, `src/presentation/pages/MapViewPage.jsx`

## WE-E5 Department, Team, and Admin Management
- Progress: 64% | Status: `In Progress`
- Sub-epic WE-SE5.1 Department operations (83%, `In Progress`)
  - Story WE-US5.1.1 Manage departments/units/personnel (83%, `In Progress`)
    - WE-T501 Department CRUD workflows — `Done`
      - Evidence: `DepartmentsPage.jsx`
    - WE-T502 Department details forms — `Done`
      - Evidence: `DepartmentDetailsPage.jsx`
    - WE-T503 Department metrics/backend sync depth — `Done`
      - Evidence: `src/presentation/pages/DepartmentsPage.jsx`, `src/data/api/departments.api.js`
- Sub-epic WE-SE5.2 Team and admin actions (100%, `Done`)
  - Story WE-US5.2.1 Admin governance actions (100%, `Done`)
    - WE-T504 Team management page — `Done`
    - WE-T505 Admin actions page — `Done`
    - WE-T506 Profile/password management page — `Done`

## WE-E6 Audit, Security, and Compliance UX
- Progress: 56% | Status: `In Progress`
- Sub-epic WE-SE6.1 Audit trail visibility (83%, `In Progress`)
  - Story WE-US6.1.1 Historical platform actions review (83%, `In Progress`)
    - WE-T601 Audit log page — `Done`
    - WE-T602 Audit API integration — `Done`
      - Evidence: `src/data/api/auditLog.api.js`
    - WE-T603 Filter/export maturity — `Done`
      - Evidence: `src/presentation/pages/AuditLogPage.jsx`
- Sub-epic WE-SE6.2 Frontend security posture (42%, `In Progress`)
  - Story WE-US6.2.1 Client-side security hardening (42%, `In Progress`)
    - WE-T604 Environment-safe API base URL policy — `Done`
      - Evidence: `src/core/config/app.config.js`
    - WE-T605 Sensitive state cleanup on logout/session expiry — `Done`
      - Evidence: `src/core/auth/session.js`, `src/App.jsx`
    - WE-T606 Permission-hardening audit completion — `Done`
      - Evidence: `src/App.jsx`, `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`

## WE-E7 Testing, Configuration, and Production Readiness
- Progress: 28% | Status: `In Progress`
- Sub-epic WE-SE7.1 Automated tests (25%, `In Progress`)
  - Story WE-US7.1.1 Regression test baseline (25%, `In Progress`)
    - WE-T701 API client unit tests — `Done`
      - Evidence: `src/data/api/incidents.api.contract.test.js`, `src/data/api/auth.api.contract.test.js`
    - WE-T702 Component/page interaction tests — `Done`
      - Evidence: `src/presentation/pages/Login.interaction.test.jsx`, `src/App.routes.test.jsx`
    - WE-T703 E2E smoke tests for critical routes — `In Progress`
      - Evidence: `e2e/smoke.placeholder.md`
- Sub-epic WE-SE7.2 Environment/deployment hardening (42%, `In Progress`)
  - Story WE-US7.2.1 Production configuration readiness (42%, `In Progress`)
    - WE-T704 Externalize API base URL by environment — `Done`
      - Evidence: `src/core/config/app.config.js`
    - WE-T705 Build/release pipeline quality gates — `Done`
      - Evidence: `package.json` (`test:ci`, `test:e2e:smoke`)
    - WE-T706 Production runbook/smoke checklist closure — `Done`
      - Evidence: `MANUAL_RUN_TEST_GUIDE.md`

## WE-E8 Backend Contract, Queue Sync, and Operational Consistency
- Progress: 30% | Status: `In Progress`
- Depends on: BE-E2, BE-E4, BE-E6
- Sub-epic WE-SE8.1 Queue fetch/sync correctness (38%, `In Progress`)
  - Story WE-US8.1.1 Accurate queue state during operations (38%, `In Progress`)
    - WE-T801 Polling-first queue sync with deterministic interval policy — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/MapViewPage.jsx`
    - WE-T802 Optimistic update rollback for verify/reclassify failures — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`
    - WE-T803 Duplicate suppression/reconciliation after refresh — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`
    - WE-T804 Preserve pagination/filter state across route changes — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/MapViewPage.jsx`
- Sub-epic WE-SE8.2 Incident API contract hardening (33%, `In Progress`)
  - Story WE-US8.2.1 Strict client/backend contract parity (33%, `In Progress`)
    - WE-T805 Canonical lifecycle enum mapping (`pending`, `verified`, `resolved`) — `Done`
      - Evidence: `src/data/api/incidents.api.js`, `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/MapViewPage.jsx`
    - WE-T806 Standardize error mapping across incident calls — `Done`
      - Evidence: `src/data/api/http.js`, `src/data/api/incidents.api.js`, `src/data/api/auth.api.js`, `src/data/api/location.api.js`
    - WE-T807 Contract tests for list/detail/with-ai/verify/reclassify — `Done`
      - Evidence: `src/data/api/incidents.api.contract.test.js`
    - WE-T808 Role-scoped behavior notes and ownership constraints — `Done`
      - Evidence: `src/core/constants/index.js`, `src/App.jsx`, `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`
- Sub-epic WE-SE8.3 Dispatcher action consistency (25%, `In Progress`)
  - Story WE-US8.3.1 Fast and correct post-action UI convergence (25%, `In Progress`)
    - WE-T809 Refresh dashboard cards/map markers after verify/reclassify — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/MapViewPage.jsx`, `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T810 Blockchain verification metadata refresh path — `Done`
      - Evidence: `src/presentation/pages/IncidentDetailsPage.jsx`
    - WE-T811 Client-to-backend correlation ID propagation in action logs — `Done`
      - Evidence: `src/data/api/http.js`, `src/data/api/incidents.api.js`, `Backend/src/app.js`
- Sub-epic WE-SE8.4 Hybrid sync roadmap and readiness gates (25%, `In Progress`)
  - Story WE-US8.4.1 Polling now, realtime migration next (25%, `In Progress`)
    - WE-T812 Pre-release backend contract checklist and dependency gates — `Done`
      - Evidence: `docs/backend-contract-checklist.md`
    - WE-T813 Fallback UX when event/notification channel is unavailable — `Done`
      - Evidence: `src/presentation/pages/DashboardPage.jsx`, `src/presentation/pages/MapViewPage.jsx`
    - WE-T814 Realtime migration design (SSE/WebSocket) with merge/de-dup policy — `Done`
      - Evidence: `docs/realtime-sync-design.md`

## Audit Notes
- Strongest area: rich dispatcher page and action surface.
- Primary risk: broad cross-page test depth and contract tests remain incomplete.
- New priority: WE-E8 to stabilize backend contract alignment and queue synchronization behavior.