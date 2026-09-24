#!/usr/bin/env bash
# Build (Cloud Build) and/or deploy RescueLink AI to Cloud Run.
# Run from repo root or from "RescueLink AI/":
#   ./scripts/cloud-run-build-deploy.sh
#   ./scripts/cloud-run-build-deploy.sh --deploy-only
#   ./scripts/cloud-run-build-deploy.sh --build-only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-rescuelink-ai-509607}"
REGION="${REGION:-asia-southeast1}"
IMAGE="${IMAGE:-gcr.io/${PROJECT_ID}/rescuelink-ai:latest}"
SERVICE_NAME="${SERVICE_NAME:-rescuelink-ai}"

DO_BUILD=1
DO_DEPLOY=1
for arg in "$@"; do
  case "$arg" in
    --build-only) DO_DEPLOY=0 ;;
    --deploy-only) DO_BUILD=0 ;;
    -h|--help)
      echo "Usage: $0 [--build-only|--deploy-only]"
      echo "Env: PROJECT_ID REGION IMAGE SERVICE_NAME"
      exit 0
      ;;
  esac
done

if [[ "$IMAGE" != gcr.io/*/* && "$IMAGE" != *-docker.pkg.dev/*/* ]]; then
  echo "ERROR: IMAGE must be a full gcr.io/... or REGION-docker.pkg.dev/... reference."
  echo "  Got: IMAGE=$IMAGE"
  echo "  Example: export IMAGE=gcr.io/\${PROJECT_ID}/rescuelink-ai:latest"
  exit 1
fi

gcloud config set project "$PROJECT_ID"
echo "PROJECT_ID=$PROJECT_ID REGION=$REGION IMAGE=$IMAGE"

if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "==> Cloud Build: $IMAGE"
  gcloud builds submit --tag "$IMAGE" .
fi

if [[ "$DO_DEPLOY" -eq 1 ]]; then
  echo "==> Cloud Run deploy: $SERVICE_NAME"
  gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 1 \
    --timeout 300 \
    --concurrency 1 \
    --port 8080 \
    --set-env-vars "ENVIRONMENT=production,STT_PROVIDER=api,STT_ENABLE_LOCAL_FALLBACK=true,STT_ENABLE_API_FALLBACK=false,STT_LOCAL_MODEL_SIZE=tiny,STT_DEVICE=cpu,STT_COMPUTE_TYPE=int8,AI_STARTUP_WARMUP=true,AI_STARTUP_WARMUP_WHISPER=true,MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt" \
    --set-secrets "HF_API_TOKEN=hf-api-token:latest"

  echo "==> Health"
  curl -s "$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')/health"
  echo
fi
