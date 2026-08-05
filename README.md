# RescueLink

Emergency response and incident management system for Dagupan City. Enables citizens to report incidents (including audio), dispatchers to manage and assign responders, and AI-assisted classification of incident types and severity.

## Project structure

| Directory | Description |
|-----------|-------------|
| **Backend** | Node.js + Express API, PostgreSQL, authentication, incident handling, AI integration |
| **Frontend/Mobile** | Flutter app for citizens to report incidents |
| **Frontend/Web** | React dispatcher dashboard for managing incidents and responders |
| **Blockchain** | Ganache + Solidity service for tamper-proof incident verification (**optional module** — disabled by default) |
| **RescueLink AI** | Python AI services for audio transcription and incident classification |

## Documentation hub

Use this as the primary entry point for setup, run, and testing docs across the stack:

| Document | Scope |
|----------|-------|
| [MANUAL_RUN_TEST_GUIDE.md](MANUAL_RUN_TEST_GUIDE.md) | **Primary runbook** for manual startup order, environment setup, health checks, and test commands across all services |
| [Backend/README.md](Backend/README.md) | Backend setup, environment variables, upload/scan flow, auth, and deployment notes |
| [RescueLink AI/README.md](RescueLink%20AI/README.md) | AI architecture, audio pipeline, fallback behavior, warmup/performance updates, and API usage |
| [Blockchain/README.md](Blockchain/README.md) | Blockchain service setup, Ganache integration, verify endpoint behavior, and gas/duplicate-write handling |
| [Frontend/Mobile/README.md](Frontend/Mobile/README.md) | Flutter app setup and run instructions |
| [Frontend/Web/dispatcher_dashboard](Frontend/Web/dispatcher_dashboard/) | Dispatcher dashboard app source and local run context |
| [PERFORMANCE_SESSION_RESULTS.md](PERFORMANCE_SESSION_RESULTS.md) | Session performance outcomes, bottlenecks, and validation evidence |
| [PERFORMANCE_IMPLEMENTATION_BACKLOG.md](PERFORMANCE_IMPLEMENTATION_BACKLOG.md) | Implementation tracker and completion log for performance changes |

## Getting started

1. Start with [MANUAL_RUN_TEST_GUIDE.md](MANUAL_RUN_TEST_GUIDE.md) for full-stack local setup and test execution.
2. Configure and run backend using [Backend/README.md](Backend/README.md).
3. Configure and run AI service using [RescueLink AI/README.md](RescueLink%20AI/README.md).
4. Configure and run blockchain service using [Blockchain/README.md](Blockchain/README.md).
5. Run clients via [Frontend/Mobile/README.md](Frontend/Mobile/README.md) and [Frontend/Web/dispatcher_dashboard](Frontend/Web/dispatcher_dashboard/).

## Features

- **Citizen reporting:** Mobile app with phone auth, audio + media incident uploads, location-aware
- **Dispatcher workflow:** Web dashboard for incident triage, dispatch, and audit logs
- **AI classification:** Automatic transcription and severity/type classification for incident audio
- **Blockchain verification:** Optional module — verified incidents recorded on-chain when enabled; falls back to audit trail logging when disabled

## Recent session highlights

- **Mobile:** Notifications screen enhanced with richer collapsed preview (incident type, status update), expanded details (incident type, status updated to X), tap-to-expand with View button; smaller "Mark all as read"; exit confirmation on app close; notification badge on Report History and Incident Details.
- **Web:** Notification deduplication (by reportId + eventType); breadcrumb routing aligned with RBAC (department users navigate to correct home); `getDepartments` skipped for department roles (fixes 403); team/responder/unit refetch on `incident:updated` when incident closed; MapViewPage `wsConnected` fix.
- **Backend:** API rate limit relaxed (2000/15min dev, 500 prod; `API_RATE_LIMIT_MAX` env override); notifications now include `incident_type` and `incident_status` via join; `PATCH /incidents/:id/status` accepts `closed` for admin/dispatcher (force-close); resource release on resolved/closed confirmed.

## Feature flags

| Flag | Location | Default | Description |
|------|----------|---------|-------------|
| `USE_BLOCKCHAIN` | `Backend/.env` | `false` | Enable Ganache blockchain finalization. When `false`, incident finalization writes a UUID audit ID to `blockchain_records` and logs to `dispatcher_audit_logs` instead. |
| `VITE_USE_BLOCKCHAIN` | `Frontend/Web/dispatcher_dashboard/.env` | `false` | Mirrors the backend flag for the web UI. Relabels blockchain UI elements to audit-trail equivalents when `false`. |

To enable the blockchain module:
1. Start the Ganache blockchain service (`cd Blockchain && python main.py`).
2. Set `USE_BLOCKCHAIN=true` in `Backend/.env`.
3. Set `VITE_USE_BLOCKCHAIN=true` in `Frontend/Web/dispatcher_dashboard/.env`.
4. Restart the backend and web dashboard.

See [Blockchain/README.md](Blockchain/README.md) for full setup instructions.
