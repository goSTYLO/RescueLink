# Changelog

## 2026-09-24 (continued)

- Mobile release builds: `pubspec.yaml` version sync + `RescueLink_App_<version>_<build>.apk` via Gradle (`android/app/build.gradle.kts`) and optional `build_release.bat` / `run_release.bat`.
- Deployed integration smoke: `Backend/scripts/smoke-deployed-e2e-once.js` + [`Documentation/HOW_TO_RUN.md`](Documentation/HOW_TO_RUN.md) § deployed backend ↔ AI.
- Cloud Run AI: `/health` exposes `load_error` + `weights_bytes`; startup awaits classifier load; entrypoint logs weight file size; [`GCP_AI.md`](Documentation/backend/GCP_AI.md) deploy uses **4Gi**, **warmup enabled**, Cloud Shell verification section.
- Cloud Run deploy: [`RescueLink AI/scripts/cloud-run-build-deploy.sh`](RescueLink%20AI/scripts/cloud-run-build-deploy.sh) + GCP_AI **Cloud Shell cheat sheet** (`deploy_cloud_run` is not a built-in command).
- GCP_AI **One-time setup**: enable Secret Manager, create `hf-api-token`, grant Cloud Run SA `secretAccessor`; deploy script enables API and checks secret exists.
- STT: HF API first with optional local Faster-Whisper fallback (`STT_ENABLE_LOCAL_FALLBACK`). Production Docker restores `faster-whisper` + prefetches `tiny`; Render Blueprint keeps local fallback off for 512Mi.
- Cloud Run deploy runbook: [`Documentation/backend/GCP_AI.md`](Documentation/backend/GCP_AI.md) (AI on GCP; backend stays on Render).
- Cloud Run startup: classifier loads after uvicorn binds (background thread); prod image bakes `emergency_model.pt` at build time so the container listens on `PORT` within the startup timeout.
- Production DB moved to Supabase **`ap-southeast-1`** (`RescueLink DB Singapore`); Render **`resquelink-backend`** already **`singapore`** — `DATABASE_URL` + `AI_SERVICE_URL` (Cloud Run) synced via Render MCP.
- Render `FRONTEND_URL` set to production dashboard [`https://rescue-link-front.vercel.app`](https://rescue-link-front.vercel.app) for CORS.
- Production uploads: private Supabase bucket `rescuelink-media` (Singapore) with local `uploads/` fallback; incident photos and avatars convert to WebP. Application IDs stay original files.
- Backend uses **pnpm** (`Backend/pnpm-lock.yaml`); Render build runs `corepack enable && pnpm install --frozen-lockfile`.
- `/health` reports Supabase Storage reachability; `pnpm check:storage` / `tests/storageIntegration.test.js` for local round-trip checks.

## 2026-09-24

- Slim Render AI Docker image: `requirements-prod.txt`, CPU `torch` only, HF Whisper API as the container default.
- Local install is unchanged: `pip install -r requirements.txt` and `.env.example` still use `STT_PROVIDER=local`.
- Classifier inference builds from backbone config + checkpoint (no second Hugging Face weight download). Whisper handler lazy-loads; `/health` includes `stt_ready`.
