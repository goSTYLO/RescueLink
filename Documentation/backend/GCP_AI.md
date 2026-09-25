# RescueLink AI on Google Cloud Run (CPU)

Deploy the FastAPI microservice from [`RescueLink AI/Dockerfile`](../../RescueLink%20AI/Dockerfile). The **Node backend stays on Render** for this pass; point Render `AI_SERVICE_URL` at the Cloud Run HTTPS URL.

## STT on Cloud Run

| Variable | Value |
|----------|--------|
| `STT_PROVIDER` | `local` (Faster-Whisper `medium` first) |
| `STT_ENABLE_API_FALLBACK` | `true` (HF Inference API if local STT fails) |
| `STT_LOCAL_MODEL_SIZE` | `medium` (baked in Dockerfile) |
| `STT_DEVICE` | `cpu` |
| `STT_COMPUTE_TYPE` | `int8` |
| `HF_API_TOKEN` | Secret Manager → env (fallback STT only; 401 does not block local-first) |
| `AI_INTERNAL_TOKEN` | Optional; match Render `AI_SERVICE_TOKEN` |
| `AI_STARTUP_WARMUP` | **`true`** on Cloud Run (4Gi); **`false`** on Render free tier |
| `AI_STARTUP_WARMUP_WHISPER` | **`true`** on Cloud Run with local STT fallback; **`false`** on Render |
| `MODEL_WEIGHTS_URL` | `https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt` (runtime fallback if `.pt` missing in image) |

Render free tier: keep `STT_ENABLE_LOCAL_FALLBACK=false` and warmup **false** (see [`render.yaml`](../../render.yaml)). Dockerfile defaults warmup to **false** for the same reason; Cloud Run overrides via deploy env below.

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI authenticated
- APIs: Cloud Run, Artifact Registry, Cloud Build, Secret Manager

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## Cloud Shell cheat sheet (every new session)

Cloud Shell **does not** define `deploy_cloud_run` for you. That name is only a **Bash function in this doc** unless you paste it or use the repo script below.

**One-time per GCP project** (before first deploy): enable Secret Manager, create HF secret, grant Cloud Run access — [One-time setup](#one-time-setup).

**Recommended — [`scripts/cloud-run-build-deploy.sh`](../../RescueLink%20AI/scripts/cloud-run-build-deploy.sh):**

Run from [`RescueLink AI/`](../../RescueLink%20AI/) (directory name has a space). The script sets `PROJECT_ID`, enables APIs, verifies `hf-api-token` exists on deploy, runs Cloud Build when needed, deploys with the [Shared deploy flags](#shared-deploy-flags), and curls `/health`.

| Mode | Command | Build image? | New Cloud Run revision? | Use when |
|------|---------|--------------|-------------------------|----------|
| **Default** (full) | `./scripts/cloud-run-build-deploy.sh` | Yes (`gcloud builds submit`) | Yes | Dockerfile or AI code changed; first deploy after clone |
| **Deploy only** | `./scripts/cloud-run-build-deploy.sh --deploy-only` | No | Yes | Rotated `hf-api-token` (new secret version); re-apply env/secrets without rebuilding |
| **Build only** | `./scripts/cloud-run-build-deploy.sh --build-only` | Yes | No | Push `:latest` to GCR; deploy later with `--deploy-only` |

Optional env overrides (same shell session): `PROJECT_ID`, `REGION`, `IMAGE`, `SERVICE_NAME` (defaults: `rescuelink-ai-509607`, `asia-southeast1`, `gcr.io/${PROJECT_ID}/rescuelink-ai:latest`, `resquelink-ai`).

```bash
cd ~/RescueLink/"RescueLink AI"
chmod +x scripts/cloud-run-build-deploy.sh   # once per clone

# Full rebuild + deploy (most code changes)
./scripts/cloud-run-build-deploy.sh

# New HF token in Secret Manager only — no Docker rebuild
echo -n "YOUR_NEW_HF_TOKEN" | gcloud secrets versions add hf-api-token --data-file=-
./scripts/cloud-run-build-deploy.sh --deploy-only

# Or token-only without the script (same revision roll, mounts latest secret):
# gcloud run services update resquelink-ai --region asia-southeast1 \
#   --update-secrets "HF_API_TOKEN=hf-api-token:latest"

# Build now, deploy after you verify IMAGE
./scripts/cloud-run-build-deploy.sh --build-only
export IMAGE="gcr.io/${PROJECT_ID}/rescuelink-ai:latest"
./scripts/cloud-run-build-deploy.sh --deploy-only
```

Deploy always re-applies STT env vars and `--set-secrets "HF_API_TOKEN=hf-api-token:latest"` from the script; manual Cloud Run console edits to those vars are overwritten on the next deploy.

**Manual — set variables, then build and deploy:**

```bash
export PROJECT_ID=rescuelink-ai-509607
export REGION=asia-southeast1
export IMAGE="gcr.io/${PROJECT_ID}/rescuelink-ai:latest"
gcloud config set project "$PROJECT_ID"
echo "IMAGE=$IMAGE"   # MUST show gcr.io/rescuelink-ai-509607/resquelink-ai:latest (not gcr.io/-ai-509607/...)

cd ~/RescueLink/"RescueLink AI"
gcloud builds submit --tag "$IMAGE" .

# Paste the deploy_cloud_run function from [Shared deploy flags](#shared-deploy-flags) below, then:
deploy_cloud_run
```

If you see **`deploy_cloud_run: command not found`**, you skipped defining the function — run `./scripts/cloud-run-build-deploy.sh --deploy-only` or paste the `gcloud run deploy ...` block from [Shared deploy flags](#shared-deploy-flags).

Persist helpers in Cloud Shell (optional, once):

```bash
grep -q 'deploy_cloud_run' ~/.bashrc 2>/dev/null || cat >> ~/.bashrc <<'EOF'

# RescueLink Cloud Run (edit PROJECT_ID if needed)
export PROJECT_ID=rescuelink-ai-509607
export REGION=asia-southeast1
export IMAGE="gcr.io/${PROJECT_ID}/rescuelink-ai:latest"
deploy_cloud_run() {
  gcloud run deploy resquelink-ai \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 1 \
    --port 8080 \
    --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=local,STT_ENABLE_LOCAL_FALLBACK=false,STT_ENABLE_API_FALLBACK=true,STT_LOCAL_MODEL_SIZE=medium,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=true,AI_STARTUP_WARMUP_WHISPER=true,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" \
    --set-secrets "HF_API_TOKEN=hf-api-token:latest"
}
EOF
```

Open a **new** Cloud Shell tab (or `source ~/.bashrc`) before calling `deploy_cloud_run`.

## Shell variables (reuse every deploy)

`gcloud builds submit --tag` requires a full registry path: **`gcr.io/...`** or **`REGION-docker.pkg.dev/...`**. A bare name like `rescuelink-ai` or an empty `$IMAGE` causes:

`Invalid value for [--tag]: Tag value must be in the *gcr.io* or *pkg.dev* namespace.`

Set **`PROJECT_ID`**, **`REGION`**, and **`IMAGE`** in **every new Cloud Shell session** (variables do not persist after you close the tab).

### Option A — Container Registry (GCR, simple / Gemini-style)

Cloud Shell example for project **`rescuelink-ai-509607`**:

```bash
export PROJECT_ID=rescuelink-ai-509607
export REGION=asia-southeast1
export IMAGE="gcr.io/${PROJECT_ID}/rescuelink-ai:latest"
gcloud config set project "$PROJECT_ID"
echo "IMAGE=$IMAGE"   # must print gcr.io/rescuelink-ai-509607/resquelink-ai:latest
```

One-time (GCR + Cloud Build):

```bash
gcloud services enable containerregistry.googleapis.com cloudbuild.googleapis.com
```

### Option B — Artifact Registry (recommended long-term)

```bash
export PROJECT_ID=rescuelink-ai-509607
export REGION=asia-southeast1
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/rescuelink/resquelink-ai:latest"
gcloud config set project "$PROJECT_ID"
echo "IMAGE=$IMAGE"
```

Create the repo once (see [One-time setup](#one-time-setup)).

**Windows PowerShell** (Artifact Registry example):

```powershell
$env:PROJECT_ID = "rescuelink-ai-509607"
$env:REGION = "asia-southeast1"
$env:IMAGE = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/rescuelink/resquelink-ai:latest"
gcloud config set project $env:PROJECT_ID
```

### Shared deploy flags

Not a system command — define this function in your shell, add it to `~/.bashrc` (see [cheat sheet](#cloud-shell-cheat-sheet-every-new-session)), or use [`scripts/cloud-run-build-deploy.sh`](../../RescueLink%20AI/scripts/cloud-run-build-deploy.sh).

```bash
# Bash — paste and run once per session, or use the repo script
deploy_cloud_run() {
  gcloud run deploy resquelink-ai \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 1 \
    --port 8080 \
    --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=local,STT_ENABLE_LOCAL_FALLBACK=false,STT_ENABLE_API_FALLBACK=true,STT_LOCAL_MODEL_SIZE=medium,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=true,AI_STARTUP_WARMUP_WHISPER=true,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" \
    --set-secrets "HF_API_TOKEN=hf-api-token:latest"
}
```

PowerShell equivalent (run after `$env:IMAGE` is set):

```powershell
gcloud run deploy resquelink-ai `
  --image $env:IMAGE `
  --region $env:REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 4Gi `
  --cpu 1 `
  --timeout 300 `
  --concurrency 1 `
  --port 8080 `
  --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=local,STT_ENABLE_LOCAL_FALLBACK=false,STT_ENABLE_API_FALLBACK=true,STT_LOCAL_MODEL_SIZE=medium,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=true,AI_STARTUP_WARMUP_WHISPER=true,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" `
  --set-secrets "HF_API_TOKEN=hf-api-token:latest"
```

Cloud Run sets **`PORT=8080`**; [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh) listens on `$PORT`. Re-running `deploy` keeps env and secrets; you only need to pass them again if you changed variables in the doc.

Default deploy above uses **4Gi** RAM and **startup warmup** (classifier + Whisper). If logs still show OOM, try **`--memory 8Gi`** or **`--cpu 2`**.

---

## Live verification (Cloud Shell)

After `export PROJECT_ID=rescuelink-ai-509607` and `export REGION=asia-southeast1`:

**Env (expect `MODEL_WEIGHTS_URL`, warmup true, HF secret):**

```bash
gcloud run services describe rescuelink-ai --region "$REGION" \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Memory / CPU:**

```bash
gcloud run services describe rescuelink-ai --region "$REGION" \
  --format="yaml(spec.template.spec.containers[0].resources)"
```

**Classifier load / OOM logs:**

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="rescuelink-ai" AND (textPayload:"Classifier load failed" OR textPayload:"Failed to load model" OR textPayload:"Killed" OR textPayload:"OOM")' \
  --limit 30 --format="value(textPayload)" --freshness=7d
```

**Weights in image** (from deploy output image ref, use Cloud Run console “Test” or a one-off job):

```bash
gcloud run services describe rescuelink-ai --region "$REGION" \
  --format='value(spec.template.spec.containers[0].image)'
# Expect models/emergency_model.pt ~500MB+ in container logs:
# "Classifier weights ready: models/emergency_model.pt … bytes"
```

**HTTP health** (after deploy):

```bash
curl -s "$(gcloud run services describe rescuelink-ai --region "$REGION" --format='value(status.url)')/health"
```

Pass: `"model_loaded":true`, `"status":"healthy"`. If stuck: check `"load_error"` and `"weights_bytes"` (new fields from [`api/main.py`](../../RescueLink%20AI/api/main.py)).

---

## Troubleshooting build tag

| Symptom | Fix |
|---------|-----|
| `deploy_cloud_run: command not found` | The function is not installed by default. Run [`RescueLink AI/scripts/cloud-run-build-deploy.sh`](../../RescueLink%20AI/scripts/cloud-run-build-deploy.sh) or paste `deploy_cloud_run() { ... }` from [Shared deploy flags](#shared-deploy-flags), then call it again. |
| `invalid reference format` / `gcr.io/-ai-509607/...` | `PROJECT_ID` was empty when you set `IMAGE`. Run `export PROJECT_ID=rescuelink-ai-509607` and `export IMAGE="gcr.io/${PROJECT_ID}/rescuelink-ai:latest"`, then `echo "$IMAGE"` before build. |
| `Tag value must be in the gcr.io or pkg.dev namespace` | Run `echo "$IMAGE"`. Set `IMAGE` to a full `gcr.io/PROJECT/NAME:tag` or `REGION-docker.pkg.dev/...` path (see above). Do not run `gcloud builds submit --tag "$IMAGE"` until `echo` looks correct. |
| `PROJECT_ID` still `your-gcp-project` | Export real id: `rescuelink-ai-509607`. |
| Build OK, deploy uses wrong image | `gcloud run deploy` `--image` must match the same string you passed to `--tag`. |
| Container failed to start / listen on `PORT=8080` | Usually the old image blocked on **weight download** + **import-time model load** before uvicorn bound. **Rebuild** after pulling latest (`lazy classifier` + weights baked in Dockerfile). Use env names from this doc (`STT_LOCAL_MODEL_SIZE`, not `WHISPER_MODEL`). Prefer `deploy_cloud_run` (includes `--timeout 300`). After deploy, `curl …/health` may show `"status":"starting"` until `model_loaded` is true. |
| `/health` stuck at `model_loaded: false` | Check `load_error` and `weights_bytes` on `/health`. OOM at 2Gi is common — redeploy with **4Gi** + rebuild image. Confirm entrypoint log shows weights size. See [Live verification](#live-verification-cloud-shell). |
| `Secret Manager API has not been used... or it is disabled` | Run `gcloud services enable secretmanager.googleapis.com` on the project, wait ~2 minutes, complete [One-time setup](#one-time-setup) (`hf-api-token` secret + IAM), retry `./scripts/cloud-run-build-deploy.sh --deploy-only`. |
| `Secret ... hf-api-token was not found` | Create the secret per [One-time setup](#one-time-setup). Do not paste tokens into git or chat. |

---

## One-time setup

Run once per GCP project **`rescuelink-ai-509607`** before `./scripts/cloud-run-build-deploy.sh` (deploy mounts `HF_API_TOKEN` from Secret Manager).

```bash
export PROJECT_ID=rescuelink-ai-509607
export REGION=asia-southeast1
gcloud config set project "$PROJECT_ID"

# Required for --set-secrets on Cloud Run deploy
gcloud services enable secretmanager.googleapis.com run.googleapis.com cloudbuild.googleapis.com

# Artifact Registry (Option B only):
gcloud artifacts repositories create rescuelink \
  --repository-format=docker \
  --location="$REGION" \
  2>/dev/null || true

# Hugging Face token for STT API (replace with your token; never commit it)
echo -n "YOUR_HF_TOKEN" | gcloud secrets create hf-api-token --data-file=-
# If secret already exists, add a new version instead:
# echo -n "NEW_TOKEN" | gcloud secrets versions add hf-api-token --data-file=-

# Cloud Run default runtime SA must read the secret
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding hf-api-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Wait **1–2 minutes** after enabling Secret Manager API, then deploy.

---

## First deploy

From repo root, after shell variables are set:

```bash
git pull
cd "RescueLink AI"    # directory name has a space — quote it
./scripts/cloud-run-build-deploy.sh
cd ..
```

Or manual build + deploy: see [Cloud Shell cheat sheet](#cloud-shell-cheat-sheet-every-new-session).

Note the service URL from the deploy output. Set Render **`AI_SERVICE_URL`** to that HTTPS URL (no trailing slash).

---

## After you pull updates (redeploy)

Use this whenever `main` (or your branch) has new AI code — Dockerfile, `api/`, models config, classifier load visibility, etc. **Required** after changes to [`api/main.py`](../../RescueLink%20AI/api/main.py) or [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh): rebuild the image and run `deploy_cloud_run` so Cloud Run gets **4Gi**, warmup env, and new `/health` fields (`load_error`, `weights_bytes`).

```bash
# From repo root
git pull

cd "RescueLink AI"
./scripts/cloud-run-build-deploy.sh
cd ..
```

Or: `gcloud builds submit --tag "$IMAGE" .` then `./scripts/cloud-run-build-deploy.sh --deploy-only` (after exporting `IMAGE`).

Optional: tag the image with the git commit for rollback:

```bash
export GIT_SHA=$(git rev-parse --short HEAD)
export IMAGE_SHA="$REGION-docker.pkg.dev/$PROJECT_ID/rescuelink/resquelink-ai:$GIT_SHA"
gcloud builds submit --tag "$IMAGE_SHA" .
gcloud builds submit --tag "$IMAGE" .   # also update :latest
deploy_cloud_run
# Rollback: gcloud run deploy resquelink-ai --image "$IMAGE_SHA" --region "$REGION" ...
```

You do **not** need to recreate the secret or Artifact Registry on each pull. Change Render backend env only if the Cloud Run **URL** changed (rare).

**Smoke test after deploy:**

```bash
curl -s "https://$(gcloud run services describe resquelink-ai --region "$REGION" --format='value(status.url)')/health"
```

---

## Wire Render backend

On **resquelink-backend** (Render):

- `AI_SERVICE_URL` = Cloud Run HTTPS URL (no trailing slash)
- Optional: same `AI_SERVICE_TOKEN` / `AI_INTERNAL_TOKEN` on both services

Redeploy the backend only when `AI_SERVICE_URL` or auth tokens change — not required for every AI image update if the URL is unchanged.

## Backend on GCP

Deferred. This doc covers **AI only**. Postgres remains Supabase; API remains Render until a separate migration plan exists.

See also [`DEPLOYMENT.md`](DEPLOYMENT.md) for Vercel, Render backend, and Supabase.
