# RescueLink – Multi-platform production deployment

Production target stack:

| Layer | Platform | Repo path |
|-------|----------|-----------|
| Dispatcher dashboard (Vite SPA) | Vercel | `Frontend/Web/dispatcher_dashboard` |
| API + WebSocket | Render Web Service (Node) | `Backend` |
| PostgreSQL | Supabase | — |
| AI (FastAPI) | Render Docker **or** [Google Cloud Run](GCP_AI.md) | `RescueLink AI` |

**Recommended regions (PH / SEA):** Supabase **`ap-southeast-1` (Singapore)**, Render web services **`singapore`**, Cloud Run **`asia-southeast1`**. Supabase region is fixed at project creation; moving regions means a new Supabase project and updating Render `DATABASE_URL`.

```mermaid
flowchart LR
  vercel["Vercel Vite SPA"] -->|"VITE_API_URL"| renderApi["Render Express API"]
  renderApi -->|"DATABASE_URL SSL"| supabase["Supabase Postgres"]
  renderApi -->|"AI_SERVICE_URL"| aiHost["AI Docker Render or Cloud Run"]
```

Mobile (Flutter) and blockchain are **not** part of this four-platform map. Keep `VITE_USE_BLOCKCHAIN=false` until a blockchain host exists.

**This guide is operator documentation.** The repo includes Dockerfile/`vercel.json`, Render `0.0.0.0` bind, shared DB SSL/migrations, and Firebase JSON env support. Upload persistence on Render is still open; see [Remaining before production](#remaining-before-production).

---

## Account setup order

Create accounts in this order so each dashboard has a real URL to paste into the next.

1. **Supabase** – Create a project. Copy the **session pooler** URI (IPv4-friendly) or direct URI from **Connect**. Never commit credentials.
2. **Render (Blueprint)** – New → Blueprint → this repo. [`render.yaml`](../../render.yaml) creates `resquelink-ai` (Docker, root `RescueLink AI`) and `resquelink-backend` (Node, root `Backend`). Paste `DATABASE_URL` and `FRONTEND_URL` when prompted. `AI_SERVICE_URL` is wired automatically to the AI service `hostport` on Render’s private network.
3. **Vercel** – Import the repo, **Root Directory** `Frontend/Web/dispatcher_dashboard`, framework **Vite**, build `npm run build`, output `dist`. Set `VITE_API_URL` to the Render **API** HTTPS origin (`https://resquelink-backend.onrender.com`, no trailing slash).

**After Vercel has a URL:** set Render backend `FRONTEND_URL` to that exact origin (one URL; the API does not read `CORS_ORIGIN`) and redeploy the API if you did not set it during Blueprint create.

---

## Supabase (database)

### Connection string

- **Session pooler** (IPv4-friendly): `postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:5432/postgres` — copy host from the dashboard Connect dialog.
- TLS is on when `NODE_ENV=production` or `DATABASE_SSL=true` (`Backend/src/config/pgPool.js`). By default the app uses encrypted connections without full chain verify (Supabase `sslmode=require` style). For verify-full, set `DATABASE_SSL_CA_PATH` to the dashboard root cert and `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.

### Schema and migrations

For a **new** empty database:

1. Apply [`Backend/schema.sql`](../../Backend/schema.sql) (Supabase SQL editor, or `psql` from a trusted machine).
2. Run **all** migrations in the order defined in [`Backend/migrations/migrationOrder.js`](../../Backend/migrations/migrationOrder.js) via `npm run migrate`.

From your laptop (with `Backend/.env` pointing at Supabase):

```bash
cd Backend
npm run setup-db   # fresh DB: schema + all migrations
# or, if schema already applied:
npm run migrate
```

There is no Supabase CLI migration history in this repo; re-running migration SQL on a live DB may error if objects already exist. Use a fresh project for the first apply.

### Backups

- Enable Supabase backups (or schedule `pg_dump` via [`Backend/scripts/backup-db.js`](../../Backend/scripts/backup-db.js) from a secure runner with `DATABASE_URL` set).
- Test restore periodically.

---

## Render Blueprint

Commit [`render.yaml`](../../render.yaml) at the repo root, then in Render: **New → Blueprint** and select this GitHub repo.

| Service | Runtime | Root directory | Plan |
|---------|---------|----------------|------|
| `resquelink-ai` | Docker | `RescueLink AI` | free |
| `resquelink-backend` | Node | `Backend` | free |

Blueprint prompts (`sync: false`): `DATABASE_URL`, `FRONTEND_URL`, and AI `HF_API_TOKEN`. `JWT_SECRET` is generated. `AI_SERVICE_URL` is the AI service `hostport` (backend adds `http://` if the scheme is missing). Optional hardening: set matching `AI_INTERNAL_TOKEN` (AI) and `AI_SERVICE_TOKEN` (API) if you enable service auth.

You can still create the two Web Services by hand using the tables below.

### Manual services (you imported `.env` at create time)

Blueprint/`render.yaml` **does not** push env to hand-created services. If you pasted a local `.env`, fix these before relying on audio or private AI routing.

**On `resquelink-ai` only — set or override**

| Variable | Production value | If you imported local AI `.env` |
|----------|------------------|----------------------------------|
| `ENVIRONMENT` | `production` | Change from `development` |
| `STT_PROVIDER` | `api` | Change from `local` |
| `STT_ENABLE_API_FALLBACK` | `false` | Change from `true` if present |
| `AI_STARTUP_WARMUP` | `false` | Optional; Dockerfile also defaults false |
| `AI_STARTUP_WARMUP_WHISPER` | `false` | Same |
| `HF_API_TOKEN` | Your HF token | **Required** for transcribe/classify-audio (not optional fallback on Render) |

**Delete on `resquelink-ai` (unused in API STT mode):** `STT_LOCAL_MODEL_SIZE`, `STT_DEVICE`, `STT_COMPUTE_TYPE`, `STT_CPU_THREADS`, `STT_BEAM_SIZE`, `STT_CACHE_DIR`, `STT_MODEL_PATH` — they only matter for local Faster-Whisper.

**Service settings (dashboard):** Health check path **`/health`** on the AI service. Root directory **`RescueLink AI`**, Docker, `./Dockerfile`.

**On `resquelink-backend` — verify (do not paste AI `.env` here)**

| Variable | Should be |
|----------|-----------|
| `AI_SERVICE_URL` | `https://resquelink-ai.onrender.com` **or** Render internal `host:port` for the AI service — **not** `http://localhost:8000` |
| `DATABASE_URL` | Supabase pooler URI |
| `FRONTEND_URL` | Your Vercel origin |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Strong secret (not dev placeholder) |

Optional: matching `AI_SERVICE_TOKEN` (backend) and `AI_INTERNAL_TOKEN` (AI). Clear `FIREBASE_SERVICE_ACCOUNT_PATH`; use `FIREBASE_SERVICE_ACCOUNT_JSON` on the backend if you need Firebase.

Redeploy **AI** after env fixes, then **backend**.

---

## Render (backend API)

### Service settings

| Setting | Value |
|---------|--------|
| Name | `resquelink-backend` |
| Root directory | `Backend` |
| Environment | Node |
| Build command | `npm install` (Blueprint) or `npm ci` |
| Start command | `npm start` |
| Health check path | `/health` |

Render injects `PORT`; the app listens on `0.0.0.0` and reads `process.env.PORT` (`Backend/src/server.js`).

### Environment variables (secrets)

Set these on the **API** Render service. See also [`Backend/.env.example`](../../Backend/.env.example).

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` (enables DB SSL) |
| `DATABASE_URL` | Yes | Supabase Postgres URI |
| `JWT_SECRET` | Yes | 32+ random bytes; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | Yes | Vercel origin, e.g. `https://your-app.vercel.app` — **only variable used for CORS** (`Backend/src/app.js`) |
| `AI_SERVICE_URL` | Yes | Blueprint sets this from `resquelink-ai` `hostport` (private network). Manual create: public origin `https://resquelink-ai.onrender.com` |
| `AI_SERVICE_TOKEN` | Optional | Same value as `AI_INTERNAL_TOKEN` on the AI service if you enable `x-ai-service-token` auth |
| `LOG_LEVEL` | No | `info` in production |
| `SMTP_*` | If using email | Password reset / notifications |
| `IPROG_*`, `RECAPTCHA_SECRET_KEY` | If using those flows | Server-side only |

**Not used by code today:** `CORS_ORIGIN` in `.env.example` is legacy; set `FRONTEND_URL` instead.

**Firebase:** On Render use `FIREBASE_SERVICE_ACCOUNT_JSON` (full service account JSON, one line). Do **not** set `FIREBASE_SERVICE_ACCOUNT_PATH` to a local file path — that file is not on the server. If Firebase is unset, the API still starts; phone/Firebase auth routes fail until you add JSON creds.

**Uploads:** Files go to local disk (`UPLOAD_DIR`). Render’s filesystem is **ephemeral**; incident media and avatars can disappear on restart until uploads move to Supabase Storage (deferred).

**Blockchain:** Optional `BLOCKCHAIN_SERVICE_URL`; leave unset unless you host that service.

### Local parity

```bash
cd Backend
npm ci
npm start
```

---

## Render (AI service — Docker)

Second Render Web Service for the FastAPI microservice.

### Service settings

| Setting | Value |
|---------|--------|
| Name | `resquelink-ai` |
| Root directory | `RescueLink AI` |
| Environment | **Docker** |
| Dockerfile | `Dockerfile` (repo default in that directory) |
| Health check path | `/health` |

Render builds from [`RescueLink AI/Dockerfile`](../../RescueLink%20AI/Dockerfile) (`requirements-prod.txt`, CPU `torch` only) and routes HTTPS to the container. Uvicorn listens on `0.0.0.0` and Render’s `PORT` (default `7860` locally) via [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh).

**Local AI (unchanged):** `cd "RescueLink AI" && pip install -r requirements.txt` then `python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000`. Keep `STT_PROVIDER=local` from [`.env.example`](../../RescueLink%20AI/.env.example). Do not use `requirements-prod.txt` on your laptop unless you are testing the Docker image.

**Production STT:** HF Inference API (`STT_PROVIDER=api`). Set `HF_API_TOKEN` on the AI service (Blueprint `sync: false`). `/health` reports `stt_ready` after the first audio request (Whisper client is lazy-loaded).

Free-tier RAM is 512Mi. Classifier + PyTorch may still OOM; upgrade `resquelink-ai` to Starter in the dashboard if the deploy is killed.

### Environment variables (Render AI service)

Set these on the **AI** Render service (not the API service). See [`RescueLink AI/.env.example`](../../RescueLink%20AI/.env.example).

| Variable | Notes |
|----------|--------|
| `AI_INTERNAL_TOKEN` | Optional; if set, API must send the same value as `AI_SERVICE_TOKEN` |
| `ENVIRONMENT` | `production` |
| `MODEL_WEIGHTS_URL` | Optional. Default: `https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt` (public HF repo; no token required) |
| `STT_PROVIDER` | `api` on Render (Blueprint). Local `.env.example` stays `local` |
| `STT_ENABLE_API_FALLBACK` | `false` on Render (local-first → API is dev-only here) |
| `STT_ENABLE_LOCAL_FALLBACK` | `false` on Render free tier; `true` on [Cloud Run](GCP_AI.md) |
| `HF_API_TOKEN` | **Required** for primary API STT on Render / Cloud Run |
| `AI_STARTUP_WARMUP` / `AI_STARTUP_WARMUP_WHISPER` | `false` on Render |
| `AI_CORS_ORIGINS` | Optional; leave empty so only the API calls this service server-to-server |

Classifier weights are gitignored in git; [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh) downloads them on startup if `models/emergency_model.pt` is missing (default URL above).

The API calls `AI_SERVICE_URL` + paths such as `/health`, `/v1/transcribe`, `/v1/classify-audio`, `/classify` (`Backend/src/services/aiService.js`).

**Note:** README YAML front matter (`sdk: docker`, `app_port: 7860`) in [`RescueLink AI/README.md`](../../RescueLink%20AI/README.md) is for Hugging Face Spaces only; Render ignores it.

---

## Vercel (dispatcher dashboard)

### Project settings

| Setting | Value |
|---------|--------|
| Root directory | `Frontend/Web/dispatcher_dashboard` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

### Environment variables (build time)

`VITE_*` values are **embedded at build time**. Changing them requires a new deployment.

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_API_URL` | Yes | Render **API** HTTPS origin (WebSocket uses `wss://` derived from this) |
| `VITE_MAPBOX_ACCESS_TOKEN` | If maps used | Public Mapbox token |
| `VITE_ONESIGNAL_APP_ID` | If push used | Same app id as backend |
| `VITE_USE_BLOCKCHAIN` | No | Keep `false` until blockchain is hosted |

**Do not set** `VITE_DEV_MODE` in production (bypasses auth).

Set production values in the **Vercel** project settings, not in committed `.env` files.

### Vercel repo notes

- Uses `package-lock.json` (npm). [`vercel.json`](../../Frontend/Web/dispatcher_dashboard/vercel.json) rewrites client routes to `/index.html`.

---

## Pre-go-live checklist

### Security

- [ ] `NODE_ENV=production` on Render API service
- [ ] Strong `JWT_SECRET`; never use example values
- [ ] `FRONTEND_URL` set to the real Vercel origin (single origin)
- [ ] (Optional) `AI_INTERNAL_TOKEN` on AI + `AI_SERVICE_TOKEN` on API, same value
- [ ] All secrets only in platform dashboards; never commit `.env`

### Database

- [ ] `schema.sql` applied, then full `npm run migrate` list (or `npm run setup-db` on empty DB)
- [ ] TLS works from Render to Supabase (pooler URI tested)

### Smoke tests

- [ ] `GET https://<render-api-host>/health` → `{ "status": "ok" }`
- [ ] `GET https://<render-ai-host>/health` after AI service is live
- [ ] Dashboard loads from Vercel; login/API calls hit Render API (browser network tab)
- [ ] WebSocket connects (`wss://<render-api-host>/ws`) when authenticated

---

## Remaining before production

Operator steps after accounts exist:

- Confirm the Render AI service can reach Hugging Face on first deploy (weights download). Override `MODEL_WEIGHTS_URL` only if you move the file off the default repo.
- Set `HF_API_TOKEN` on `resquelink-ai` (required for audio transcription). If the container is OOM-killed on free 512Mi, upgrade that service to Starter.
- Apply Supabase schema + migrations from a machine with `DATABASE_URL` (or `npm run setup-db` on a fresh DB).
- Set Render (API + AI), Vercel env vars from the tables above; redeploy Vercel after any `VITE_API_URL` change.

Still not in repo (optional follow-up):

- **Upload persistence** – Supabase Storage (or Render disk) for incident media; local `UPLOAD_DIR` is ephemeral on Render.

---

## Common issues

| Symptom | Likely cause |
|---------|----------------|
| Browser CORS errors | `FRONTEND_URL` missing or wrong; do not use `CORS_ORIGIN` |
| API still calls `localhost:8000` | Render API `AI_SERVICE_URL` unset (Blueprint should inject AI `hostport`) |
| AI health check fails on Render | Container not listening on Render `PORT`; check Dockerfile/entrypoint |
| Dashboard calls wrong API | Rebuild Vercel after changing `VITE_API_URL` |
| `JWT_SECRET must be set` | Set on Render API in production |
| DB connect / SSL errors | Use session pooler URI; check `NODE_ENV=production` and `DATABASE_SSL` |
| Token works after logout | Run migration `add_token_blacklist.sql` (included in `npm run migrate`) |
| Uploaded media missing after deploy | Expected on Render until Storage migration |

---

## Self-hosted alternative (not the primary path)

For VPS deployment you may use `npm start` with PM2 and nginx as a reverse proxy to the same Node process. HTTPS termination and env vars mirror the Render API table above. This repo does not ship Docker Compose for the full stack.
