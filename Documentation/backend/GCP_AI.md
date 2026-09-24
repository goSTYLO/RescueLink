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

## One-time setup

```bash
export PROJECT_ID=your-gcp-project
export REGION=asia-southeast1
gcloud config set project "$PROJECT_ID"

gcloud artifacts repositories create rescuelink \
  --repository-format=docker \
  --location="$REGION"

# Store HF token (paste when prompted)
echo -n "YOUR_HF_TOKEN" | gcloud secrets create hf-api-token --data-file=-
```

## Build and deploy

From repo root:

```bash
cd "RescueLink AI"
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/rescuelink/resquelink-ai:latest" .

gcloud run deploy resquelink-ai \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/rescuelink/resquelink-ai:latest" \
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
```

Cloud Run sets **`PORT=8080`**; [`docker-entrypoint.sh`](../../RescueLink%20AI/docker-entrypoint.sh) listens on `$PORT`.

If the service OOMs, raise memory to **4Gi** or CPU to **2**.

## Wire Render backend

On **resquelink-backend** (Render):

- `AI_SERVICE_URL` = `https://<cloud-run-service-url>` (no trailing slash)
- Optional: same `AI_SERVICE_TOKEN` / `AI_INTERNAL_TOKEN` on both services

Redeploy the backend after changing `AI_SERVICE_URL`.

## Smoke tests

```bash
curl -s "https://<cloud-run-url>/health"
# classify / audio: use Backend flows or curl with x-ai-service-token if configured
```

## Backend on GCP

Deferred. This doc covers **AI only**. Postgres remains Supabase; API remains Render until a separate migration plan exists.

See also [`DEPLOYMENT.md`](DEPLOYMENT.md) for Vercel, Render backend, and Supabase.
