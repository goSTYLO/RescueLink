"""Decode audio for validation. Librosa if installed; else wave/soundfile + ffmpeg."""
import os
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any, Tuple


def decode_audio(path: str, prefer_librosa: bool = True) -> Tuple[Any, int, float]:
    """Return (samples, sample_rate, duration_seconds)."""
    if prefer_librosa:
        try:
            import librosa

            y, sr = librosa.load(str(path), sr=None)
            duration = float(len(y) / sr) if sr else 0.0
            return y, int(sr), duration
        except ImportError:
            pass
    return _decode_audio_without_librosa(path)


def _decode_audio_without_librosa(path: str) -> Tuple[Any, int, float]:
    suffix = Path(path).suffix.lower()
    if suffix == ".wav":
        return _read_wav(path)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        _ffmpeg_to_wav(path, tmp_path)
        return _read_wav(tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def _read_wav(path: str) -> Tuple[Any, int, float]:
    try:
        import soundfile as sf

        y, sr = sf.read(str(path), always_2d=False)
        if getattr(y, "ndim", 1) > 1:
            y = y.mean(axis=1)
        duration = float(len(y) / sr) if sr else 0.0
        return y, int(sr), duration
    except ImportError:
        pass

    with wave.open(str(path), "rb") as wav_file:
        sr = wav_file.getframerate()
        frames = wav_file.getnframes()
        y = wav_file.readframes(frames)
    duration = float(frames / sr) if sr else 0.0
    return y, int(sr), duration


def _ffmpeg_to_wav(src: str, dest: str) -> None:
    cmd = ["ffmpeg", "-y", "-i", str(src), "-acodec", "pcm_s16le", "-ac", "1", dest]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except FileNotFoundError as error:
        raise ValueError("ffmpeg not found; install ffmpeg or librosa") from error
    except subprocess.CalledProcessError as error:
        raise ValueError(f"ffmpeg failed: {error.stderr or error}") from error
