# RescueLink

Emergency response and incident management system for Dagupan City. Enables citizens to report incidents (including audio), dispatchers to manage and assign responders, and AI-assisted classification of incident types and severity.

## Project structure

| Directory | Description |
|-----------|-------------|
| **Backend** | Node.js + Express API, PostgreSQL, authentication, incident handling, AI integration |
| **Frontend/Mobile** | Flutter app for citizens to report incidents |
| **Frontend/Web** | React dispatcher dashboard for managing incidents and responders |
| **Blockchain** | Ganache + Solidity service for tamper-proof incident verification |
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
- **Blockchain verification:** Verified incidents recorded on-chain for audit trail

## Recent session highlights

- AI pipeline updates: startup warmup controls, improved m4a reliability, and text-only long-report benchmark scenario.
- Backend updates: optional AI precheck gating, with-audio deep-scan deduplication, and richer blockchain verify metadata.
- Blockchain updates: gas metrics returned in API responses and duplicate verification write prevention (`already_recorded`).
