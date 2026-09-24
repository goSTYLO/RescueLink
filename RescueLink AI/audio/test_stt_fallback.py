"""Self-check: API-first STT falls back to local when HF API fails."""
import os
import sys
import tempfile
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    import soundfile  # noqa: F401
except ImportError:
    print("skip (install requirements.txt for full check)")
    raise SystemExit(0)

from audio.whisper_handler import WhisperHandler


def _make_silent_wav(path: str, seconds: float = 1.0) -> None:
    sample_rate = 16000
    frames = int(sample_rate * seconds)
    with wave.open(path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * frames)


def main() -> None:
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        _make_silent_wav(wav_path)

        class FakeApi:
            def transcribe(self, audio_path, language=None):
                raise RuntimeError("simulated HF API failure")

        class FakeLocal:
            def transcribe(self, audio_path, language=None):
                return {
                    "transcription": "fallback ok",
                    "confidence": 1.0,
                    "language": "en",
                    "provider": "local",
                }

        handler = WhisperHandler.__new__(WhisperHandler)
        handler.provider_mode = "api"
        handler.enable_local_fallback = True
        handler.enable_api_fallback = False
        handler.api_provider = FakeApi()
        handler.local_provider = FakeLocal()

        result = handler._transcribe_with_policy(wav_path, language=None)
        assert result["transcription"] == "fallback ok", result
        assert result.get("fallback_used") is True, result
        assert "simulated HF API failure" in result.get("fallback_reason", ""), result
        print("ok")
    finally:
        os.remove(wav_path)


if __name__ == "__main__":
    main()
