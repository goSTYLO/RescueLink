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

## Getting started

1. **Backend:** See [Backend/README.md](Backend/README.md) for setup, env vars, migrations, and deployment.
2. **Mobile app:** See [Frontend/Mobile/README.md](Frontend/Mobile/README.md).
3. **Dispatcher dashboard:** See [Frontend/Web/dispatcher_dashboard/](Frontend/Web/dispatcher_dashboard/).
4. **Blockchain:** See [Blockchain/README.md](Blockchain/README.md).
5. **AI services:** See [RescueLink AI/README.md](RescueLink%20AI/README.md).

## Features

- **Citizen reporting:** Mobile app with phone auth, audio + media incident uploads, location-aware
- **Dispatcher workflow:** Web dashboard for incident triage, dispatch, and audit logs
- **AI classification:** Automatic transcription and severity/type classification for incident audio
- **Blockchain verification:** Verified incidents recorded on-chain for audit trail
