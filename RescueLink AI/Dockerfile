FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt ./
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements-prod.txt

COPY models/label_meta.json models/label_meta.json
RUN python -c "import json; from transformers import AutoConfig, AutoTokenizer; name=json.load(open('models/label_meta.json')).get('backbone','xlm-roberta-base'); AutoConfig.from_pretrained(name); AutoTokenizer.from_pretrained(name)"

# Bake classifier weights (runtime entrypoint download blocked Cloud Run startup)
ARG MODEL_WEIGHTS_URL=https://huggingface.co/goSTYLO/resquelink-weights/resolve/main/emergency_model.pt
RUN mkdir -p models \
  && python -c "import urllib.request; url='${MODEL_WEIGHTS_URL}'; urllib.request.urlretrieve(url, 'models/emergency_model.pt'); print('weights:', url)"

# Prefetch medium Whisper for local-first STT (Cloud Run cold start)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('medium', device='cpu', compute_type='int8')"

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV ENVIRONMENT=production
ENV STT_PROVIDER=local
ENV STT_ENABLE_API_FALLBACK=true
ENV STT_ENABLE_LOCAL_FALLBACK=false
ENV STT_LOCAL_MODEL_SIZE=medium
ENV STT_DEVICE=cpu
ENV STT_COMPUTE_TYPE=int8
ENV AI_STARTUP_WARMUP=false
ENV AI_STARTUP_WARMUP_WHISPER=false

EXPOSE 7860
ENTRYPOINT ["./docker-entrypoint.sh"]
