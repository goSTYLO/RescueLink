# Changelog

## 2026-09-24 (continued)

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
