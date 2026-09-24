#!/bin/sh
set -e

MODEL_PATH="models/emergency_model.pt"
DEFAULT_WEIGHTS_URL="https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt"
WEIGHTS_URL="${MODEL_WEIGHTS_URL:-$DEFAULT_WEIGHTS_URL}"
PORT="${PORT:-7860}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "Downloading classifier weights to $MODEL_PATH"
  mkdir -p models
  MODEL_WEIGHTS_URL="$WEIGHTS_URL" python -c "
import os, urllib.request
url = os.environ['MODEL_WEIGHTS_URL']
urllib.request.urlretrieve(url, '$MODEL_PATH')
print('Downloaded weights from', url)
"
fi

exec uvicorn api.main:app --host 0.0.0.0 --port "$PORT"
