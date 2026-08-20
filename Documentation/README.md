# RescueLink Documentation

This folder is the consolidated entry point for project documentation.

## Core Documents

- [Final List of Features](FINAL_LIST_OF_FEATURES.md) — Compiled list of all implemented features across Mobile, Web, Backend, AI, and Blockchain
- [API Documentation](API_DOCUMENTATION.md) — Consolidated API reference, authentication flows, rate limiting, endpoint specifications
- [Security Documentation](SECURITY_DOCUMENTATION.md) — Multi-layered security architecture, authentication, authorization, encryption, audit logging
- [How To Run](HOW_TO_RUN.md) — Prerequisites, environment setup, startup procedures, health checks, VS Code tasks
- [Troubleshooting](TROUBLESHOOTING.md) — Diagnostic procedures, common issues with solutions for all services

## Guides

- [Manual Run & Test Guide](guides/MANUAL_RUN_TEST_GUIDE.md) — Primary runbook for full-stack startup, health checks, and test commands
- [Security Manual QA Checklist](guides/SECURITY_MANUAL_QA_CHECKLIST.md)
- [Security Checklist Presentation & Testing](guides/SECURITY_CHECKLIST_PRESENTATION_AND_TESTING.md)

## Backlogs

- [Master Backlog](backlogs/BACKLOG_MASTER.md)
- [Backend Backlog](backlogs/BACKLOG_BACKEND.md)
- [AI Backlog](backlogs/BACKLOG_AI.md)
- [Mobile Backlog](backlogs/BACKLOG_MOBILE.md)
- [Web Backlog](backlogs/BACKLOG_WEB.md)
- [AI Security & Upload Scan Backlog](backlogs/AI_SECURITY_AND_UPLOAD_SCAN_BACKLOG.md)
- [Performance Implementation Backlog](backlogs/PERFORMANCE_IMPLEMENTATION_BACKLOG.md)
- [Web Epic Task Touchpoints](backlogs/WEB_EPIC_TASK_TOUCHPOINTS.md)

## Backend

- [API Documentation (full)](backend/API_DOCUMENTATION.md)
- [Deployment](backend/DEPLOYMENT.md)
- [Security Runbook](backend/SECURITY_RUNBOOK.md)
- [RBAC Postman Guide](backend/RBAC_POSTMAN_GUIDE.md)
- [Test Accounts](backend/ACCOUNTS.md)
- [AI Integration Plan](backend/AI_INTEGRATION_PLAN.md)

## AI

- [How To Use](ai/HOW_TO_USE.md)
- [Implementation Summary](ai/IMPLEMENTATION_SUMMARY.md)
- [Microphone Testing Guide](ai/MICROPHONE_TESTING_GUIDE.md)
- [Root Cause Analysis](ai/ROOT_CAUSE_ANALYSIS.md)
- [Status Report](ai/STATUS_REPORT.md)
- [Training Results](ai/Training%20Results.md)
- [Content Type Fix](ai/CONTENT_TYPE_FIX.md)

## Web Dashboard

- [Setup Instructions](web/SETUP_INSTRUCTIONS.md)
- [Backend Contract Checklist](web/backend-contract-checklist.md)
- [Realtime Sync Design](web/realtime-sync-design.md)
- [Duplicate Management](web/duplicate-management.md)
- [Design Folder Copy Summary](web/DESIGN_FOLDER_COPY_SUMMARY.md)

## Performance

- [Session Results](performance/PERFORMANCE_SESSION_RESULTS.md)
- [Performance & Scalability Strategies](performance/Performance%20and%20Scalability%20Strategies.md)

## Academic & Standards

- [ITE 401 Final Manuscript](academic/ITE%20401_%20Platform%20Technologies%20_%20Final%20Manuscript.md)
- [UDPS Standards](academic/Universal%20Digital%20Product%20Standards%20(UDPS).md)

## Scope

These docs are practical and concise. They summarize current behavior and commands without replacing source-of-truth technical files.

## Source Of Truth References

- Root overview: [../README.md](../README.md)
- Backend setup: [../Backend/README.md](../Backend/README.md)
- OpenAPI spec: [../Backend/api-spec/swagger.json](../Backend/api-spec/swagger.json)
- Full-stack startup script: [../run-all.bat](../run-all.bat)
- Full-stack shutdown script: [../stop-all.bat](../stop-all.bat)

## Service READMEs (kept in component folders)

- [Mobile](../Frontend/Mobile/README.md)
- [Web Dashboard](../Frontend/Web/dispatcher_dashboard/README.md)
- [RescueLink AI](../RescueLink%20AI/README.md)
- [Blockchain](../Blockchain/README.md)

## Service Ports (Default)

- Backend API: `http://localhost:3000`
- RescueLink AI: `http://localhost:8000`
- Blockchain API: `http://localhost:8001`
- Web Dashboard (Vite): `http://localhost:5173`

## Notes

- For backend migration ordering and schema alignment issues, see repository memory note reflected in backend migration docs and scripts.
- Prefer root virtual environment consistency for Python services when possible to avoid package mismatch.
