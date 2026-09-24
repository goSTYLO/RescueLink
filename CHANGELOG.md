# Changelog

## 2026-09-24 (continued)

- STT: HF API first with optional local Faster-Whisper fallback (`STT_ENABLE_LOCAL_FALLBACK`). Production Docker restores `faster-whisper` + prefetches `tiny`; Render Blueprint keeps local fallback off for 512Mi.
- Cloud Run deploy runbook: [`Documentation/backend/GCP_AI.md`](Documentation/backend/GCP_AI.md) (AI on GCP; backend stays on Render).

## 2026-09-24

- Slim Render AI Docker image: `requirements-prod.txt`, CPU `torch` only, HF Whisper API as the container default.
- Local install is unchanged: `pip install -r requirements.txt` and `.env.example` still use `STT_PROVIDER=local`.
- Classifier inference builds from backbone config + checkpoint (no second Hugging Face weight download). Whisper handler lazy-loads; `/health` includes `stt_ready`.
