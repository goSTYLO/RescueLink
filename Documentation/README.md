# RescueLink Documentation

This folder is the consolidated entry point for project documentation.

## Documents

- [API Documentation](API_DOCUMENTATION.md) — Complete API reference, authentication flows, rate limiting, endpoint specifications
- [Security Documentation](SECURITY_DOCUMENTATION.md) — Multi-layered security architecture, authentication, authorization, encryption, audit logging
- [How To Run](HOW_TO_RUN.md) — Prerequisites, environment setup, startup procedures, health checks, VS Code tasks
- [Troubleshooting](TROUBLESHOOTING.md) — Diagnostic procedures, common issues with solutions for all services

## Scope

These docs are practical and concise. They summarize current behavior and commands without replacing source-of-truth technical files.

## Source Of Truth References

- Root overview: [../README.md](../README.md)
- Backend API detail: [../Backend/API_DOCUMENTATION.md](../Backend/API_DOCUMENTATION.md)
- OpenAPI spec: [../Backend/api-spec/swagger.json](../Backend/api-spec/swagger.json)
- Security runbook: [../Backend/SECURITY_RUNBOOK.md](../Backend/SECURITY_RUNBOOK.md)
- Security QA checklist: [../SECURITY_MANUAL_QA_CHECKLIST.md](../SECURITY_MANUAL_QA_CHECKLIST.md)
- Manual full-stack run guide: [../MANUAL_RUN_TEST_GUIDE.md](../MANUAL_RUN_TEST_GUIDE.md)
- Full-stack startup script: [../run-all.bat](../run-all.bat)
- Full-stack shutdown script: [../stop-all.bat](../stop-all.bat)

## Service Ports (Default)

- Backend API: `http://localhost:3000`
- RescueLink AI: `http://localhost:8000`
- Blockchain API: `http://localhost:8001`
- Web Dashboard (Vite): `http://localhost:5173`

## Notes

- For backend migration ordering and schema alignment issues, see repository memory note reflected in backend migration docs and scripts.
- Prefer root virtual environment consistency for Python services when possible to avoid package mismatch.
