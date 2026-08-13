# Final List of Features

> **Last compiled:** August 11, 2026  
> **Scope:** Implemented features only — features that exist in the codebase and are operational today. Planned or in-progress backlog items are excluded.

---

## 1. System Overview

RescueLink is an AI- and blockchain-capable emergency response and incident management system for Dagupan City. Citizens report incidents via a Flutter mobile app (audio, media, GPS). Dispatchers triage, verify, assign, and close incidents through a React web dashboard. A Python AI service transcribes and classifies incident audio. An optional Ganache blockchain module records verified incidents on-chain; when disabled, the system falls back to audit-trail logging.

| Platform | Technology | Role |
|----------|------------|------|
| **Mobile App** | Flutter (BLoC) | Citizen reporting, responder mode, notifications |
| **Web Dashboard** | React + Vite | Dispatcher operations, map, departments, audit |
| **Backend API** | Node.js + Express + PostgreSQL | Auth, incidents, dispatch, WebSocket, integrations |
| **AI Service** | Python + FastAPI | Audio transcription and incident classification |
| **Blockchain** | Python + FastAPI + Solidity (optional) | Tamper-proof incident verification on Ganache |

---

## 2. Functional Requirements Map

Mapped to manuscript FR-01–FR-09. Partial items document what is implemented; unbuilt capabilities are not listed as features.

| FR | Requirement | Status | Primary Delivery |
|----|-------------|--------|------------------|
| **FR-01** | User Registration & Authentication | Implemented | Mobile auth screens, Backend `/api/auth/*` |
| **FR-02** | Emergency Report Submission | Implemented | Mobile `emergency_report_screen.dart`, Backend `/api/incidents/emergency`, `/with-audio` |
| **FR-03** | GPS Location Capture | Implemented | Mobile geolocation service, Backend `/api/location/*` |
| **FR-04** | Multimedia Attachment | Implemented | Audio/photo/video upload pipeline, media download endpoints |
| **FR-05** | AI Incident Classification | Implemented | RescueLink AI `/classify`, `/classify-audio`; Backend AI orchestration |
| **FR-06** | False Report Detection | Partial | Low-confidence flags, keyword fallback, geospatial duplicate flagging — no dedicated fraud classifier |
| **FR-07** | Blockchain Logging | Implemented (optional) | Blockchain `/verify-incident`; audit-trail fallback when disabled |
| **FR-08** | Responder Dashboard | Implemented | Web dispatcher dashboard; mobile responder mode (Phase 3) |
| **FR-09** | Notification Service | Partial | In-app notifications (API + WebSocket); no SMS/push provider integration |

---

## 3. Mobile App — Citizen

### Authentication & Account

- Phone-based registration and login with OTP verification
- Password reset flow (forgot password, create new password)
- Firebase phone verification and Dagupan residency / service-area checks
- Biometric quick login (stored credentials via `local_auth`)
- Account created confirmation and identity error handling
- Logout with confirmation; end-all-sessions option
- Exit confirmation dialog when closing the app from home

### Emergency Reporting & Tracking

- Emergency report submission with GPS coordinates and barangay context
- Audio recording for incident reports (`createWithAudio` API)
- Photo and video attachment support with device-side capture
- Unified **Incident Details** screen (tracking-first: status, timeline, AI fields, evidence)
- Report history list with pull-to-refresh
- Reporter resolution confirmation after dispatcher marks incident resolved
- Inline voice playback and image preview; file download for evidence
- Potential-related-incident informational response from backend (no duplicate linking on mobile)

### Notifications (In-App, API-Driven)

- Backend-driven notifications via `/api/notifications`
- Unread badge on Home, Report History, and Incident Details
- Rich notification cards: collapsed preview (incident type, status); expanded details with View action
- Mark all as read (`POST /api/notifications/mark-all-read`)
- Pull-to-refresh, loading/error/empty states

### Profile, Settings & Verification

- Settings: profile, change password, change phone number (OTP flow)
- Privacy & security: biometric toggle with password confirmation
- Emergency contacts management
- Barangay information screen
- About screen

### Volunteer Responder Onboarding

- **Apply as First Responder** entry from Settings
- Four-tab onboarding flow: Terms, Role Overview, Requirements Checklist, Application Form
- Government ID upload (required); optional training certificates and supporting documents (images/PDF)
- Specialization field selection (Fire, Medical, Police, Disaster) with proof uploads
- Application status screen: Pending Review, Approved, Not Approved with reviewer notes
- **Admin revoke** (admin-only): revoke approved volunteer status with predefined operational reason, admin password confirmation, and in-app notification (`application_revoked`); citizen may re-apply with no cooldown

---

## 4. Mobile App — Responder Mode

Available to users with role `responder` (promoted upon application approval).

### Online Status & Alerts

- Role-gated 4th tab in bottom navigation (`Home | Reports | Responder | Settings`)
- Online/offline toggle persisted server-side (`PATCH /api/responders/me/online-status`)
- WebSocket **incident alert modal** on `responder:incident_alert` when online
- Accept/decline incident from alert modal
- Specialization-filtered alerts (responders only receive alerts matching their fields)

### On-Scene Operations

- Responder dashboard: active assignments with status indicators
- Responder incident detail: interactive map (OpenStreetMap), location pin
- Response progress stepper: Assigned → En Route → On Scene → Resolved
- Request backup (CDRRMO, nearby responders, or both)
- Status updates via `/api/incidents/:id/responder-status`

### Response History

- Paginated list of completed (resolved) incidents
- Extended notification categories: `application_approved`, `application_rejected`, `application_revoked`, `responder_assigned`, `responder_status_updated`, `backup_requested`

---

## 5. Dispatcher Web Dashboard

### Authentication, RBAC & Navigation

- Dispatcher login with email/password; optional OTP verification step
- Protected routes with role-based access (Super Admin, Dispatcher, Department Admin, Department Head, Personnel)
- Action-level permission checks on verify, reclassify, dispatch, and admin actions
- Role-scoped default routes and breadcrumb navigation aligned with RBAC
- Access denied notice for unauthorized routes
- Session persistence, logout, profile and password management
- Forgot password and reset password flows

### Incident Queue & Detail Operations

- Priority-based dashboard with summary cards, filters, and sorting
- Incident list API with search, type, barangay, status, severity filters
- Incident detail page: timeline, reporter info, AI classification, media access
- Verify incident (triggers blockchain or audit-trail finalization)
- Reclassify incident (manual override with reason governance)
- Status updates across lifecycle: pending → verified → in_progress → resolved → closed
- Force-close for admin/dispatcher
- Internal coordination notes (view and add)
- Optimistic update rollback on verify/reclassify failure
- Polling-first queue sync with duplicate suppression on refresh

### Duplicate Incident Management

- Geospatial **Possible Duplicate** flagging (`flagged_for_review`) — no auto-linking
- Manual link/unlink duplicate incidents with parent-child clusters
- Related Reports section on incident detail
- Browse-incidents dialog: search, filters, pagination for parent selection
- Mark as duplicate from dashboard row (Merge icon)
- Clear duplicate flag endpoint support

### Map & Geospatial Intelligence

- Live incident map with department and barangay filters
- Closest-unit / ETA suggestions
- Geofence and area alerting
- Heatmap / hotspot layers for incident density
- WebSocket-driven refresh on incident updates

### Dispatch, Departments, Teams & Admin

- Create dispatch: single responder or grouped team by department
- Department assignment and availability integration
- Undo department notification
- Department CRUD, details, metrics, units, vehicles, personnel, tasks
- Department-scoped dashboard and assigned incidents views
- Team management page
- Admin actions page (user/role management entry points)
- Settings, help & support pages

### Responder Application Review

- List volunteer responder applications
- Application detail: personal info, documents, specialization fields, proof uploads
- Approve or reject with reviewer notes
- Protected document download

### Audit Log & Notifications UI

- Audit log page with action/resource filters and export
- Blockchain vs audit-trail action labeling (feature-flag aware)
- In-app notification component with deduplication (reportId + eventType)
- Real-time refetch on `incident:updated` WebSocket events

---

## 6. Backend API & Services

Mounted routes: `/api/auth`, `/api/incidents`, `/api/dispatches`, `/api/responders`, `/api/departments`, `/api/notifications`, `/api/location`, `/api/audit-logs`, `/api/admin`, `/api/metrics`, `/api/responder-applications`.

### Authentication, RBAC & Sessions

- Mobile register/login; dispatcher login, signup, OTP verify
- Phone onboarding with Firebase token
- Forgot/reset password; profile get/update; change password
- Logout with JWT token blacklist
- Role-based authorization guards (User, Responder, Dispatcher, Admin, Supervisor, Department Admin, Department Head, Personnel)
- Ownership checks on incident resources
- Per-IP and per-account auth rate limiting; configurable general API rate limits

### Incident Lifecycle, Media & Duplicates

- `POST /emergency` — quick location-based incident
- `POST /with-audio` — audio + optional media; triggers AI and file scan
- Full lifecycle: pending → verified → in_progress → resolved → closed
- Reporter resolution confirmation (`confirm-resolution`)
- Verify and reclassify with audit logging
- Audio and indexed media download (blocked when quarantined)
- `GET /with-ai` — incident plus transcription and classification
- Geospatial duplicate detection with confidence scoring
- Background duplicate analyzer service
- Manual link/unlink/clear-flag; duplicate cluster and potential-duplicate queries
- Field encryption for sensitive incident descriptions

### Dispatch & Responders

- Single-responder and grouped team dispatch creation
- Dispatch list, update, cancel; undo department notification
- Responder CRUD, availability status, online status, specialization fields
- Team CRUD and member management
- Incident acceptance workflow: accept, decline, responder status updates, backup requests
- Active assignments and response history for responders

### Departments

- Department CRUD with operational metrics
- Units/vehicles CRUD and incident assignment
- Personnel management per department

### Notifications & WebSocket

- User-scoped notification list, unread count, mark read, mark-all-read, delete
- Notification persistence with incident type/status joins
- WebSocket manager: broadcast to authenticated clients
- Events include `incident:created`, `incident:status_updated`, `incident:updated`, `responder:incident_alert`
- Responder alerts filtered by specialization match

### Location Intelligence

- Coordinate boundary check (Dagupan operational area)
- Barangay reverse geocode; address search and reverse geocode
- Closest units with ETA; geofence alerts; incident heatmap data

### Responder Applications

- Citizen submit application with multipart document upload
- Specialization fields and field proof paths
- List, detail, approve/reject status updates
- Access-controlled document serving

### Upload Security

- Lightweight signature-based file scan on upload
- Quarantine workflow for detected threats
- File scan retry background service
- Fail-open mode when scanner unavailable (configurable)

### Admin, Audit & Metrics

- User management: list, create, role update, deactivate, delete
- System-wide statistics
- Dispatcher audit logs (action, resource, actor, timestamp)
- Request timing middleware and metrics routes
- Health check endpoint

### AI & Blockchain Integration

- AI classify/transcribe clients with timeout and retry policies
- AI classification retry background service
- Optional blockchain verification on incident verify
- Audit-trail UUID fallback when `USE_BLOCKCHAIN=false`

---

## 7. RescueLink AI Service

### Classification Endpoints

- `POST /classify` — text-only incident classification
- `POST /classify-audio` — full audio → transcription → classification pipeline
- `POST /transcribe`, `/transcribe-mic`, `/classify-mic` — transcription and all-in-one mic flows
- Six incident types: Fire, Crime, Accident, Medical, Natural Disaster, Other
- START protocol severity: Green, Yellow, Red, Black
- Multi-label confidence scores with configurable threshold (default 0.3)
- Low-confidence flag when max confidence &lt; 0.7

### Audio Pipeline

- Local quantized Whisper STT (primary path) with legacy Hugging Face cloud toggle
- Supported formats: .wav, .mp3, .m4a, .flac, .ogg
- Duration guardrails (30–60 seconds), 25MB size limit, silence detection
- Startup model warmup; lazy load and offline mode flag
- Automatic English/Filipino language detection

### Validation, Fallbacks & Monitoring

- Strict input validation with detailed 400 error messages
- Keyword fallback for emergency terms when model confidence is low
- Transcription failure returns 503 with text-only fallback guidance
- Usage stats endpoint (`/v1/audio/stats`) with success rate and latency metrics
- Internal API token authentication
- CORS enabled for frontend integration

---

## 8. Blockchain Module (Optional, Feature-Flagged)

Disabled by default. Enable via `USE_BLOCKCHAIN=true` (Backend) and `VITE_USE_BLOCKCHAIN=true` (Web).

### On-Chain Verification

- `GET /health` — Ganache connection check
- `POST /verify-incident` — record incident hash on IncidentRegistry contract
- Auto-compile and deploy contract on first run if no address configured
- Response: hash, tx_hash, block_number, gas_used, effective_gas_price, gas_cost_wei

### Gas Optimization & Duplicate Prevention

- Events-only contract design (~24k gas per verification)
- Duplicate-write check: returns `already_recorded: true` with zero gas if report already on-chain
- Solidity optimizer enabled (200 runs)

### Audit-Trail Fallback

- When blockchain disabled: verification writes UUID audit ID to `blockchain_records` and logs to `dispatcher_audit_logs`
- Web UI relabels blockchain elements to audit-trail equivalents

---

## 9. Cross-Cutting Security & Reliability

### Security (Implemented)

- **Layer 1 — Auth:** JWT bearer tokens, bcrypt password hashing, token blacklist, dispatcher OTP/MFA path, login throttling
- **Layer 2 — Authorization:** RBAC across all routes, ownership protection, role-scoped audit log visibility
- **Layer 3 — Encryption:** TLS for API traffic; encrypted sensitive fields at rest; secure file storage paths
- **Layer 4 — Validation:** Request body validation/sanitization utilities; pagination and enum guards
- **Layer 5 — Upload scan:** Signature scan, quarantine, scan retry service; sensitive key redaction in logs
- Helmet security headers; CORS policy; request ID correlation (`x-request-id`)
- Incident report rate limiting per user

### Reliability & Testing

- Master integration test runner (`run_master_integration_tests.ps1`) for Backend, Web, AI, Blockchain phases
- Backend: security, RBAC, location, upload middleware, WebSocket, duplicate detection test suites
- Web: API contract tests, route tests, login interaction tests
- AI: endpoint contract tests, fallback rule unit tests
- Blockchain: Ganache connection and verify-incident Mocha harness
- Performance-validated paths documented in `PERFORMANCE_SESSION_RESULTS.md` (AI audio, blockchain verify, backend with-audio)

---

## 10. Feature Flags & Optional Modules

| Flag | Location | Default | Effect |
|------|----------|---------|--------|
| `USE_BLOCKCHAIN` | `Backend/.env` | `false` | Enable Ganache blockchain finalization on verify |
| `VITE_USE_BLOCKCHAIN` | `Frontend/Web/dispatcher_dashboard/.env` | `false` | Show blockchain UI vs audit-trail labels |
| `API_RATE_LIMIT_MAX` | `Backend/.env` | 2000 (dev) / 500 (prod) | General API rate limit override |
| `AI_HEALTH_PRECHECK_ENABLED` | RescueLink AI `.env` | off | Per-request AI health check (adds latency) |
| `FILE_DEEP_SCAN_ENGINE` | `Backend/.env` | `stub` | Deep scan engine (stub only — not a production feature) |

---

## 11. References

| Document | Description |
|----------|-------------|
| [API Documentation](API_DOCUMENTATION.md) | Consolidated API reference |
| [Security Documentation](SECURITY_DOCUMENTATION.md) | Multi-layer security architecture |
| [How To Run](HOW_TO_RUN.md) | Setup and startup procedures |
| [../README.md](../README.md) | Project overview and feature flags |
| [../BACKLOG_MASTER.md](../BACKLOG_MASTER.md) | Program backlog and component progress |
| [../Frontend/Mobile/README.md](../Frontend/Mobile/README.md) | Mobile app features and architecture |
| [../RescueLink AI/README.md](../RescueLink%20AI/README.md) | AI pipeline and endpoints |
| [../Blockchain/README.md](../Blockchain/README.md) | Blockchain setup and gas optimization |
| [../PERFORMANCE_SESSION_RESULTS.md](../PERFORMANCE_SESSION_RESULTS.md) | Performance validation results |
| [../Frontend/Web/dispatcher_dashboard/docs/duplicate-management.md](../Frontend/Web/dispatcher_dashboard/docs/duplicate-management.md) | Duplicate incident flow |
| [../Frontend/Web/dispatcher_dashboard/docs/realtime-sync-design.md](../Frontend/Web/dispatcher_dashboard/docs/realtime-sync-design.md) | Realtime sync design |
| [../ITE 401_ Platform Technologies _ Final Manuscript.md](../ITE%20401_%20Platform%20Technologies%20_%20Final%20Manuscript.md) | Academic FR-01–FR-09 source |

---

## Excluded from This List

The following are **not** implemented and are intentionally omitted:

- SMS/push notification provider integration (FCM/APNs)
- Dedicated false-report / fraud classifier module
- Production deep-scan antivirus engine (stub only)
- Offline incident draft/queue on mobile
- Mobile automated test suite (no baseline `test/` directory)
- E2E smoke tests for web (placeholder only)
