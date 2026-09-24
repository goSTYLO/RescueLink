# Changelog

## 2026-09-24

- Slim Render AI Docker image: `requirements-prod.txt` (no faster-whisper/librosa), CPU `torch` only, HF Whisper API as the container default.
- Local install is unchanged: `pip install -r requirements.txt` and `.env.example` still use `STT_PROVIDER=local`.
- Classifier inference builds from backbone config + checkpoint (no second Hugging Face weight download). Whisper handler lazy-loads; `/health` includes `stt_ready`.
