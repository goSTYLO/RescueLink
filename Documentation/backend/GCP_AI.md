# RescueLink AI on Google Cloud Run (CPU)

Deploy the FastAPI microservice from [`RescueLink AI/Dockerfile`](../../RescueLink%20AI/Dockerfile). The **Node backend stays on Render** for this pass; point Render `AI_SERVICE_URL` at the Cloud Run HTTPS URL.

## STT on Cloud Run

| Variable | Value |
|----------|--------|
| `STT_PROVIDER` | `api` (HF Inference API first) |
| `STT_ENABLE_LOCAL_FALLBACK` | `true` (Faster-Whisper `tiny` if API fails) |
| `STT_LOCAL_MODEL_SIZE` | `tiny` (Dockerfile default) |
| `STT_DEVICE` | `cpu` |
| `STT_COMPUTE_TYPE` | `int8` |
| `HF_API_TOKEN` | Secret Manager → env (required for primary STT) |
| `AI_INTERNAL_TOKEN` | Optional; match Render `AI_SERVICE_TOKEN` |

Render free tier: keep `STT_ENABLE_LOCAL_FALLBACK=false` (see [`render.yaml`](../../render.yaml)).

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI authenticated
- APIs: Cloud Run, Artifact Registry, Cloud Build, Secret Manager

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

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

Shared deploy flags (first deploy and after pull):

```bash
# Bash — save as a function or paste before each `gcloud run deploy`
deploy_cloud_run() {
  gcloud run deploy resquelink-ai \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 1 \
    --port 8080 \
    --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=api,STT_ENABLE_LOCAL_FALLBACK=true,STT_ENABLE_API_FALLBACK=false,STT_LOCAL_MODEL_SIZE=tiny,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=false,AI_STARTUP_WARMUP_WHISPER=false,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" \
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
  --memory 2Gi `
  --cpu 1 `
  --timeout 300 `
  --concurrency 1 `
  --port 8080 `
  --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=api,STT_ENABLE_LOCAL_FALLBACK=true,STT_ENABLE_API_FALLBACK=false,STT_LOCAL_MODEL_SIZE=tiny,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=false,AI_STARTUP_WARMUP_WHISPER=false,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" `
  --set-secrets "HF_API_TOKEN=hf-api-token:latest"
```

Cloud Run sets **`PORT=8080`**; [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh) listens on `$PORT`. Re-running `deploy` keeps env and secrets; you only need to pass them again if you changed variables in the doc.

If the service OOMs, raise memory to **4Gi** or CPU to **2** on the deploy command.

---

## Troubleshooting build tag

| Symptom | Fix |
|---------|-----|
| `Tag value must be in the gcr.io or pkg.dev namespace` | Run `echo "$IMAGE"`. Set `IMAGE` to a full `gcr.io/PROJECT/NAME:tag` or `REGION-docker.pkg.dev/...` path (see above). Do not run `gcloud builds submit --tag "$IMAGE"` until `echo` looks correct. |
| `PROJECT_ID` still `your-gcp-project` | Export real id: `rescuelink-ai-509607`. |
| Build OK, deploy uses wrong image | `gcloud run deploy` `--image` must match the same string you passed to `--tag`. |
| Container failed to start / listen on `PORT=8080` | Usually the old image blocked on **weight download** + **import-time model load** before uvicorn bound. **Rebuild** after pulling latest (`lazy classifier` + weights baked in Dockerfile). Use env names from this doc (`STT_LOCAL_MODEL_SIZE`, not `WHISPER_MODEL`). Prefer `deploy_cloud_run` (includes `--timeout 300`). After deploy, `curl …/health` may show `"status":"starting"` until `model_loaded` is true. |

---

## One-time setup

Artifact Registry (Option B only) and HF secret (skip if already created):

```bash
gcloud artifacts repositories create rescuelink \
  --repository-format=docker \
  --location="$REGION" \
  2>/dev/null || true

# Only if secret does not exist yet:
echo -n "YOUR_HF_TOKEN" | gcloud secrets create hf-api-token --data-file=-
# To rotate token later:
# echo -n "NEW_TOKEN" | gcloud secrets versions add hf-api-token --data-file=-
```

---

## First deploy

From repo root, after shell variables are set:

```bash
git pull
cd "RescueLink AI"    # directory name has a space — quote it
echo "$IMAGE"         # sanity check before build
gcloud builds submit --tag "$IMAGE" .
deploy_cloud_run   # or paste the full gcloud run deploy block from above
cd ..
```

Note the service URL from the deploy output. Set Render **`AI_SERVICE_URL`** to that HTTPS URL (no trailing slash).

---

## After you pull updates (redeploy)

Use this whenever `main` (or your branch) has new AI code — Dockerfile, `api/`, models config, etc.

```bash
# From repo root
git pull

cd "RescueLink AI"
gcloud builds submit --tag "$IMAGE" .
deploy_cloud_run
cd ..
```

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
