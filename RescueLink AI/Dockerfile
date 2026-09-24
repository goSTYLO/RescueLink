FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY requirements-space.txt ./
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements-space.txt

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV STT_LOCAL_MODEL_SIZE=base
ENV ENVIRONMENT=production

EXPOSE 7860
ENTRYPOINT ["./docker-entrypoint.sh"]
