# Web Epic Task Touchpoints

Source backlog: `BACKLOG_WEB.md` (tasks marked `In Progress` or `Not Started`).

## WE-E8 Backend Contract, Queue Sync, and Operational Consistency
- `WE-T801` / `WE-T803` / `WE-T804`: `Frontend/Web/dispatcher_dashboard/src/presentation/pages/DashboardPage.jsx`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/MapViewPage.jsx`
- `WE-T802` / `WE-T809`: `Frontend/Web/dispatcher_dashboard/src/presentation/pages/IncidentDetailsPage.jsx`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/DashboardPage.jsx`
- `WE-T805` / `WE-T806` / `WE-T807`: `Frontend/Web/dispatcher_dashboard/src/data/api/incidents.api.js`, `Frontend/Web/dispatcher_dashboard/src/data/api/http.js`
- `WE-T808`: `Frontend/Web/dispatcher_dashboard/src/App.jsx`, `Frontend/Web/dispatcher_dashboard/src/core/auth/session.js`
- `WE-T810` / `WE-T811` / `WE-T812`: `Frontend/Web/dispatcher_dashboard/src/data/api/incidents.api.js`, `Backend/src/routes/incident.js`, `Backend/src/controllers/incident.js`, `Backend/src/app.js`
- `WE-T813` / `WE-T814`: `Frontend/Web/dispatcher_dashboard/src/presentation/pages/MapViewPage.jsx`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/DashboardPage.jsx`

## WE-E7 Testing, Configuration, and Production Readiness
- `WE-T701` / `WE-T807`: `Frontend/Web/dispatcher_dashboard/src/data/api/incidents.api.contract.test.js`, `Frontend/Web/dispatcher_dashboard/src/data/api/auth.api.contract.test.js`
- `WE-T702`: `Frontend/Web/dispatcher_dashboard/src/App.routes.test.jsx`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/Login.interaction.test.jsx`
- `WE-T703`: `Frontend/Web/dispatcher_dashboard/e2e/smoke.placeholder.md`
- `WE-T704`: `Frontend/Web/dispatcher_dashboard/src/core/config/app.config.js`
- `WE-T705`: `Frontend/Web/dispatcher_dashboard/package.json` (`test:ci`, `test:e2e:smoke`)
- `WE-T706`: `MANUAL_RUN_TEST_GUIDE.md`

## WE-E6 Audit, Security, and Compliance UX
- `WE-T603`: `Frontend/Web/dispatcher_dashboard/src/presentation/pages/AuditLogPage.jsx`
- `WE-T604`: `Frontend/Web/dispatcher_dashboard/src/core/config/app.config.js`
- `WE-T605`: `Frontend/Web/dispatcher_dashboard/src/core/auth/session.js`, `Frontend/Web/dispatcher_dashboard/src/App.jsx`
- `WE-T606`: `Frontend/Web/dispatcher_dashboard/src/App.jsx`, `Frontend/Web/dispatcher_dashboard/src/core/auth/session.test.js`, `Backend/tests/rbac.test.js`

## Other in-progress tasks (secondary pass)
- `WE-T206`: `Frontend/Web/dispatcher_dashboard/src/data/api/incidents.api.js`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/DashboardPage.jsx`
- `WE-T305` / `WE-T306` / `WE-T307`: `Frontend/Web/dispatcher_dashboard/src/presentation/pages/IncidentDetailsPage.jsx`
- `WE-T404` / `WE-T405` / `WE-T406`: `Frontend/Web/dispatcher_dashboard/src/data/api/location.api.js`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/MapViewPage.jsx`
- `WE-T503`: `Frontend/Web/dispatcher_dashboard/src/data/api/departments.api.js`, `Frontend/Web/dispatcher_dashboard/src/presentation/pages/DepartmentsPage.jsx`
- `WE-T105`: `Frontend/Web/dispatcher_dashboard/src/App.jsx`, `Frontend/Web/dispatcher_dashboard/src/core/auth/session.js`
