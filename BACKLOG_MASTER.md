# RescueLink Project Backlog Master

Last updated: 2026-02-27  
Scope source: `ITE 401_ Platform Technologies _ Final Manuscript.md` + codebase evidence

## Backlog Hierarchy
- Epic
- Sub-epic (feature group)
- User story
- Tickets

## Status and Scoring
- Status labels: `Done`, `In Progress`, `Blocked`, `Not Started`
- Weighting model: `Done = 1.0`, `In Progress = 0.5`, `Blocked = 0.25`, `Not Started = 0.0`
- Roll-up: Ticket -> Story -> Sub-epic -> Epic -> Component

## Component Snapshot
- Backend: 61% (`In Progress`) — API/security baseline is strong, but deep scan engine and notifications are incomplete.
- AI: 52% (`In Progress`) — Core endpoints are usable, but false-report detection and observability are still maturing.
- Mobile: 46% (`In Progress`) — Core auth/reporting works, but dashboard polish, tests, and backend-sync hardening remain.
- Web: 55% (`In Progress`) — Dispatcher UI breadth is high, but tests, env hardening, and backend-sync consistency need work.

## Component Backlogs
- [Backend Backlog](BACKLOG_BACKEND.md)
- [AI Backlog](BACKLOG_AI.md)
- [Mobile Backlog](BACKLOG_MOBILE.md)
- [Web Backlog](BACKLOG_WEB.md)

## Cross-Component Dependencies
- Mobile and Web incident history/queue UX depend on Backend incident API contract stability.
- Backend AI orchestration quality depends on AI service reliability for transcription/classification.
- Backend verification trust chain depends on blockchain write + persistence + web visibility.
- Security and performance acceptance requires all components to close test and hardening gaps.

## Program-Level Risks
- Deep file scan remains `stub` driven in backend default configuration.
- AI behavior still relies on fallback-heavy paths under model/provider constraints.
- Mobile and Web automated test coverage is limited.
- Web production environment configuration still needs hardening beyond localhost defaults.

## Near-Term Sprint Focus
- Sprint A (stabilization): backend security-critical completion, mobile/web backend integration hardening, contract alignment.
- Sprint B (operationalization): test coverage expansion, environment hardening, observability, and performance validation.