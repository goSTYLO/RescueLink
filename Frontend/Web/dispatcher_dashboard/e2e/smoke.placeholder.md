# Web E2E Smoke Placeholder

This placeholder tracks critical route smoke checks until Playwright/Cypress is added.

## Critical path checks
- Login route loads: `/login`
- Root redirect works by role: `/` -> dashboard route based on stored role
- Dashboard route renders for super admin: `/dashboard`
- Department dashboard route renders for department admin: `/department/dashboard`
- Incident details route resolves report id: `/incidents/:id`

## Temporary execution
- Run unit/integration suites: `npm run test`
- Keep this checklist updated with each release candidate.
