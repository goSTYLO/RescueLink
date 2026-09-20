# Thesis vs System Inconsistencies

**Source thesis:** Compiled Chapter 1–3 PDF (`Compiled Chapter 1-3.pdf`, RescueLink: AI-Powered Smart Emergency Response System)  
**Rule:** The **implemented system is correct**. Every row below is a thesis fix target — update the manuscript to match the system, not the reverse.  
**Compared against:** RescueLink repo as of this document’s creation (code + `Documentation/FINAL_LIST_OF_FEATURES.md` and related guides).

## How to use

1. Find the chapter/topic in the left column.
2. Replace the thesis claim with the **Current system** wording.
3. Use **Evidence** paths if you need to verify before rewriting.

Research-only claims (e.g. survey acceptability scores in Ch3 SoP #3) are out of scope here.

---

## 1. Clients and UX

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch3 — Features / Proposed use case | “Citizen Mobile **Web** Application” / “mobile web client” | Native **Flutter** mobile app for citizens and responders | `Frontend/Mobile/lib/main.dart`, `Frontend/Mobile/pubspec.yaml`, `Documentation/FINAL_LIST_OF_FEATURES.md` |
| Ch3 — 8-layer Client / Application layers | Instant Chat; Communication (chat/voice bridging) | **No chat or voice-bridge**. WebSocket carries incident/alert events only; voice is emergency **report recording**, not live call | `Backend/src/services/websocketManager.js`, `Frontend/Mobile/lib/services/websocket_service.dart`, `Frontend/Mobile/lib/screens/home/emergency_report_screen.dart` |
| Ch3 — Client Layer (responder web) | “Smart Routing” on the Emergency Responders Web Interface | Maps are **display / OSM** only; no route-optimization or directions engine | `Frontend/Web/dispatcher_dashboard/src/presentation/pages/MapViewPage.jsx`, `Frontend/Web/dispatcher_dashboard/src/presentation/components/common/IncidentMap.jsx` |

---

## 2. External integrations and software requirements

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch3 — External Services / Software Requirements | Google Maps SDK (geocoding & routing) | **OpenStreetMap** tiles via `flutter_map` / Leaflet; Dagupan-scoped location APIs — no Google Maps SDK | `Frontend/Mobile/lib/widgets/app_map_tile_layer.dart`, `Frontend/Web/dispatcher_dashboard/src/presentation/components/common/IncidentMap.jsx`, `Backend/src/routes/location.js` |
| Ch3 — External Services / Software Requirements | SMS Gateways (Twilio) | **No Twilio / no SMS**. Auth OTP and mail use **email** (`nodemailer`); alerts use **OneSignal** push | `Backend/src/services/email.js`, `Backend/src/controllers/auth.js`, `Backend/src/services/oneSignalService.js` |
| Ch3 — External Services | Push via Firebase FCM | Push is **OneSignal** (mobile, web, backend). Firebase is used for **phone auth**, not `firebase_messaging` | `Backend/src/services/oneSignalService.js`, `Frontend/Mobile/lib/services/onesignal_service.dart`, `Frontend/Mobile/pubspec.yaml` |
| Ch3 — External Services | Weather Services | **No weather API** integration | (absent from codebase; weather appears only as an AI training label in `RescueLink AI/data/`) |
| Ch3 — External Services / Ch1–2 delimitation | 911 Emergency Services integration | **Not integrated**. Explicitly excluded from scope; “Call 911” is tip/UI text only | `Documentation/FINAL_LIST_OF_FEATURES.md` (Excluded), `Documentation/ai/HOW_TO_USE.md` |
| Ch3 — Software Requirements | AWS SDK for Python (Boto3) | **Not used** | No `boto3` / AWS SDK dependency in AI or backend packages |
| Ch3 — Software Requirements | PostgreSQL **or MySQL 8.0+** | **PostgreSQL only** (`pg` Pool) | `Backend/src/config/db.js`, `Documentation/HOW_TO_RUN.md` |
| Ch3 — Software Requirements | Docker Engine, Docker Compose, and Nginx as required | **Not required**. Run via Node/PM2; Nginx is an optional reverse-proxy example in deploy docs; no project Dockerfile/compose as a hard dependency | `Documentation/backend/DEPLOYMENT.md`, `Documentation/HOW_TO_RUN.md` |

---

## 3. AI and validation

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch1 framework / Ch3 AI Engine | Dedicated fake-report / fraudulent submission filtering | AI does **type + severity classification** (and low-confidence flags). **No dedicated fraud/prank classifier**. Proxies: low confidence, keyword fallback, geospatial duplicate flags | `Documentation/FINAL_LIST_OF_FEATURES.md` (FR-06 Partial + Excluded), `RescueLink AI/api/main.py`, `Backend/src/services/aiService.js` |
| Ch1 inputs / Ch3 AI stages | AI analyzes multimedia **metadata** / photos for classification | AI analyzes **text and audio** (Whisper STT + XLM-RoBERTa). Photos/videos are **attachments**, not EXIF/metadata classification inputs | `RescueLink AI/api/main.py`, `Backend/src/controllers/incident.js` (`createWithAudio`), `Documentation/FINAL_LIST_OF_FEATURES.md` §7 |
| Ch2–3 duplicate detection | Duplicate reports auto-grouped into master clusters | System **flags** duplicates (`flagged_for_review`); **never auto-links**. Manual link/unlink on the web dashboard | `Backend/src/services/duplicateDetectionService.js`, `Backend/src/services/duplicateBackgroundAnalyzer.js`, `Documentation/web/duplicate-management.md` |

---

## 4. Security and integrity

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch1 Significance (Institution) | Blockchain provides the immutable audit trail for incident records | Blockchain is **optional**, feature-flagged (`USE_BLOCKCHAIN`, default **`false`**). Verification falls back to an **audit-trail UUID** when off | `Backend/src/services/blockchainService.js`, `Documentation/FINAL_LIST_OF_FEATURES.md` §8 / §10, `Blockchain/README.md` |
| Ch1–2 independent variables | Multi-factor authentication as a system-wide security control | MFA is **dispatcher email OTP** only (`DISPATCHER_MFA_ENABLED`). Not applied to all admin/staff or citizens | `Backend/src/controllers/auth.js`, `Documentation/guides/SECURITY_CHECKLIST_PRESENTATION_AND_TESTING.md` §1.3 |
| Ch3 — Software Architecture | **8-layered** architecture including chat, Twilio, weather, 911, Google Maps, FCM | Actual stack is a **multi-service** client–server design (Flutter + React + Express + FastAPI AI + optional blockchain). Docs describe security layers / service boundaries — **not** that 8-layer model with those external services | `Documentation/SECURITY_DOCUMENTATION.md`, `Documentation/academic/ITE 401_ Platform Technologies _ Final Manuscript.md`, `README.md` |

---

## 5. Roles, agencies, and dispatch

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch2 Scope; Ch3 FR-1 | Two primary user groups (citizens + responders) **or** only three FR actors: Citizens, Registered Volunteers, Authorized Responders | Full RBAC: `user`, `volunteer`, `responder`, `dispatcher`, `supervisor`, `admin`, `department-admin`, `department-head` | `Backend/src/config/roles.js`, `Backend/src/middleware/rbac.js`, `Documentation/backend/ACCOUNTS.md` |
| Ch3 — Department Entity | Agencies such as CDRRMO, **BFP**, PNP, **EMS** as peer seeded departments | Seeded operational departments are **PNP** and **CDRRMO (`drrmo`)** (teams/units under those) | `Backend/scripts/seed-db.js`, `Documentation/backend/ACCOUNTS.md` |
| Ch1 Scope and Limitations | System does **not** include actual automated rescue asset deployment / emergency vehicle dispatching | System **does** hybrid **auto-team** assignment (`maybeAutoDispatch`) by incident type/availability. Vehicles are inventory/managed; they are **not** GPS-routed auto-dispatched assets. Rewrite scope to: no live 911/vehicle fleet control; **team** auto-dispatch **is** in scope | `Backend/src/services/autoDispatchService.js`, `Documentation/guides/AUTO_TEAM_DISPATCH_MANUAL_TEST_GUIDE.md` |

---

## 6. Data model wording

| Thesis location | Thesis claim | Current system | Evidence |
| --- | --- | --- | --- |
| Ch3 — Incident Report Entity | Lifecycle statuses: `pending`, `accepted`, `resolved`, `archived` | Primary incident statuses: **`pending` → `verified` → `in_progress` → `resolved` → `closed`**. Archive is a separate flag / `archived_at`. “Accepted” belongs to **responder/volunteer** acceptance flow, not the primary incident status enum | `Backend/src/controllers/incident.js`, `Backend/src/models/incident.js` |
| Ch1 Definition of Terms — Real-Time Notification | Instant alerts via **push or SMS** | Push via **OneSignal** + in-app notifications + WebSocket. **No SMS**. Ch3 notification entity already names OneSignal — align Ch1 with that | `Backend/src/services/oneSignalService.js`, `Backend/src/services/notificationPersistence.js` |

---

## 7. Internal thesis contradictions

These are places Chapters 1–3 disagree with each other; both sides should be reconciled to the **system**.

| Conflict | What to write instead |
| --- | --- |
| Ch1 Scope lists **three** user groups (citizens, volunteers, responders/dispatch); Ch2 Scope Delimitation says **two** (citizens + authorized responders) | Document all RBAC roles; at minimum name citizens, volunteers, dispatchers, department staff, and admins as implemented |
| Ch1 calls the client a **mobile application**; Ch3 calls it a **Mobile Web** / web client | **Native Flutter mobile application** + **React web dispatcher dashboard** |
| Ch1 Institution benefits emphasize always-on **blockchain** immutability; Ch3 DB section correctly allows optional paths and OneSignal | Blockchain **optional**; default integrity via server-side audit logs / verify UUID |
| Ch1 Real-Time Notification includes **SMS**; Ch3 notifications entity cites **OneSignal/WebPush** | Drop SMS; keep OneSignal + WebSocket + in-app |

---

## 8. Aligned items (do not “correct” these)

The thesis already matches the system on these points — leave them alone unless polishing wording:

| Topic | Alignment |
| --- | --- |
| Voice / audio reporting | Full reports use required **audio** + optional photo/video; AI transcribes and classifies (`POST /api/incidents/with-audio`) |
| GPS + Dagupan focus | Automatic GPS capture; operational geography is Dagupan (boundary / barangay) |
| Field-level encryption | Sensitive fields use AES-GCM at rest in the backend encryption helpers (full-disk TDE remains a deployment concern) |
| PostgreSQL | Primary database is PostgreSQL (do not add MySQL as an equal alternative) |
| Ch3 notification entity | Correctly references **OneSignal/WebPush** — keep; fix earlier SMS/FCM wording only |
| Ch3 core entities | Names such as `incident_reports`, `responder_applications`, `duplicate_clusters`, `dispatches`, `dispatcher_audit_logs` match the implemented schema direction |
| Secure audit logging | Dispatcher audit logs and restricted write paths exist regardless of blockchain flag |
| No live Unified 911 replacement | Correct delimitation — system is a pilot digital reporting/dispatch platform, not a national hotline replacement |

---

## Revision priority (suggested)

1. **High (architecture / false claims):** Mobile web → Flutter; remove Instant Chat, Twilio, Google Maps, Weather, 911 API, Boto3, MySQL option, Docker-as-required; FCM → OneSignal; 8-layer diagram.
2. **High (capabilities):** Fake-report AI → classification + duplicate flags; multimedia-metadata AI → audio/text; duplicate auto-link → flag + manual link; blockchain always-on → optional; MFA scope → dispatcher OTP.
3. **Medium (ops model):** Full RBAC roles; PNP + CDRRMO (not BFP/EMS as peers); incident status enum; auto-team dispatch vs “no automated dispatch” scope wording.
4. **Low:** Internal Ch1 vs Ch2 user-group count; Definition of Terms SMS line.
)
