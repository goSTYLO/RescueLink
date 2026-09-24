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

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV ENVIRONMENT=production
ENV STT_PROVIDER=api
ENV STT_ENABLE_API_FALLBACK=false
ENV AI_STARTUP_WARMUP=false
ENV AI_STARTUP_WARMUP_WHISPER=false

EXPOSE 7860
ENTRYPOINT ["./docker-entrypoint.sh"]
