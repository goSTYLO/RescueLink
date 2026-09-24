"""
Whisper STT handler with local quantized inference (Faster-Whisper) as primary
and optional Hugging Face API fallback for staged rollout.
"""

import os
import shutil
import tempfile
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

import soundfile as sf
from huggingface_hub import InferenceClient

try:
    from .decode import decode_audio
except ImportError:
    from decode import decode_audio

try:
    import imageio_ffmpeg
except Exception:
    imageio_ffmpeg = None

logger = logging.getLogger(__name__)


def _to_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: Optional[str]) -> Optional[int]:
    if value is None or value.strip() == "":
        return None
    return int(value)


def _detect_device(preferred: str) -> str:
    normalized = (preferred or "auto").strip().lower()
    if normalized in {"cpu", "cuda"}:
        return normalized

    # faster-whisper uses ctranslate2, not PyTorch; check ctranslate2's CUDA support
    try:
        import ctranslate2

        supported = ctranslate2.get_supported_compute_types("cuda")
        if supported:
            return "cuda"
        logger.info("CTranslate2 reports no CUDA compute types; using CPU")
    except Exception as e:
        logger.info("CTranslate2 CUDA unavailable (%s); using CPU", e)

    return "cpu"


def _resolve_compute_type(device: str, requested: str) -> str:
    normalized = (requested or "auto").strip().lower()
    if normalized != "auto":
        return normalized
    return "int8_float16" if device == "cuda" else "int8"


def _ensure_cuda_libs_on_path() -> None:
    """Add nvidia-cublas-cu12 bin dir to PATH so ctranslate2 can find cublas64_12.dll."""
    for p in __import__("sys").path:
        if "site-packages" in p:
            cublas_bin = Path(p) / "nvidia" / "cublas" / "bin"
            if cublas_bin.exists():
                current = os.environ.get("PATH", "")
                if str(cublas_bin) not in current.split(os.pathsep):
                    os.environ["PATH"] = str(cublas_bin) + os.pathsep + current
                    logger.info("✓ Added nvidia-cublas-cu12 to PATH for CUDA")
                break


def _ensure_ffmpeg_backend() -> None:
    if imageio_ffmpeg is None:
        logger.warning("imageio-ffmpeg not available; m4a decoding may fail without system ffmpeg")
        return

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = str(Path(ffmpeg_exe).parent)

        shim_dir = Path(tempfile.gettempdir()) / "rescuelink_ffmpeg"
        shim_dir.mkdir(parents=True, exist_ok=True)
        shim_exe = shim_dir / "ffmpeg.exe"
        if not shim_exe.exists():
            shutil.copy2(ffmpeg_exe, shim_exe)

        current_path = os.environ.get("PATH", "")
        path_entries = current_path.split(os.pathsep)

        new_entries = []
        if str(shim_dir) not in path_entries:
            new_entries.append(str(shim_dir))
        if ffmpeg_dir not in path_entries:
            new_entries.append(ffmpeg_dir)

        if new_entries:
            os.environ["PATH"] = os.pathsep.join(new_entries + [current_path])
            logger.info("✓ Added bundled ffmpeg backend from imageio-ffmpeg")
    except Exception as error:
        logger.warning(f"Failed to initialize bundled ffmpeg backend: {error}")


class _WhisperApiProvider:
    def __init__(self, hf_api_token: str, model_id: str):
        self.model_id = model_id
        self.client = InferenceClient(token=hf_api_token)

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        result = self.client.automatic_speech_recognition(
            audio=str(audio_path),
            model=self.model_id,
        )

        if isinstance(result, dict):
            transcription = result.get("text") or ""
        elif isinstance(result, str):
            transcription = result
        else:
            raise ValueError(f"Unexpected API response format: {result}")

        if not transcription.strip():
            raise ValueError("Empty transcription returned from API")

        return {
            "transcription": transcription,
            "confidence": 1.0,
            "language": language or "auto",
            "provider": "api",
        }


class _WhisperLocalProvider:
    def __init__(
        self,
        model_size_or_path: str,
        device: str,
        compute_type: str,
        cpu_threads: Optional[int],
        cache_dir: Optional[str],
        beam_size: int,
    ):
        self.model_size_or_path = model_size_or_path
        self.device = device
        self.compute_type = compute_type
        self.cpu_threads = cpu_threads
        self.cache_dir = cache_dir
        self.beam_size = beam_size
        self.model = self._load_model(device=self.device, compute_type=self.compute_type)

    def _load_model(self, device: str, compute_type: str):
        from faster_whisper import WhisperModel

        init_kwargs: Dict[str, Any] = {
            "device": device,
            "compute_type": compute_type,
        }
        if self.cpu_threads:
            init_kwargs["cpu_threads"] = self.cpu_threads
        if self.cache_dir:
            init_kwargs["download_root"] = self.cache_dir
        return WhisperModel(self.model_size_or_path, **init_kwargs)

    def _try_cuda_int8_fallback(self, error: Exception) -> bool:
        """Try CUDA with int8 (no float16) before giving up on GPU."""
        if self.device != "cuda" or self.compute_type != "int8_float16":
            return False
        error_text = str(error).lower()
        if "cuda" not in error_text and "cublas" not in error_text and "cudnn" not in error_text:
            return False
        try:
            logger.info(
                "int8_float16 failed on CUDA (%s); retrying with int8 on CUDA",
                error,
            )
            self.compute_type = "int8"
            self.model = self._load_model(device="cuda", compute_type="int8")
            return True
        except Exception:
            return False

    def _try_cpu_fallback(self, error: Exception) -> bool:
        if self.device != "cuda":
            return False

        error_text = str(error).lower()
        cuda_error_markers = ("cublas", "cudnn", "cuda", "libcudart", "cannot be loaded")
        if not any(marker in error_text for marker in cuda_error_markers):
            return False

        # Try CUDA with int8 (no float16) before falling back to CPU
        if self._try_cuda_int8_fallback(error):
            return True

        logger.warning(
            "Local Whisper CUDA runtime unavailable; switching to CPU int8 fallback. Error: %s",
            error,
        )
        self.device = "cpu"
        self.compute_type = "int8"
        self.model = self._load_model(device=self.device, compute_type=self.compute_type)
        return True

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        try:
            segments, info = self.model.transcribe(
                str(audio_path),
                language=language,
                beam_size=self.beam_size,
            )
        except Exception as error:
            if self._try_cpu_fallback(error):
                segments, info = self.model.transcribe(
                    str(audio_path),
                    language=language,
                    beam_size=self.beam_size,
                )
            else:
                raise

        transcription = " ".join((segment.text or "").strip() for segment in segments).strip()
        if not transcription:
            raise ValueError("Empty transcription returned from local model")

        detected_language = language or getattr(info, "language", None) or "auto"
        language_probability = float(getattr(info, "language_probability", 0.0) or 0.0)

        return {
            "transcription": transcription,
            "confidence": max(0.0, min(language_probability, 1.0)) if language_probability else 1.0,
            "language": detected_language,
            "provider": "local",
        }


class WhisperHandler:
    """Handle Whisper transcription with local-first provider strategy."""

    def __init__(
        self,
        hf_api_token: Optional[str] = None,
        model_id: str = "openai/whisper-large-v3-turbo",
        max_duration: int = 60,
        min_duration: int = 1,
        max_file_size_mb: int = 25,
        confidence_threshold: float = 0.7,
        stt_provider: Optional[str] = None,
        enable_api_fallback: Optional[bool] = None,
        enable_local_fallback: Optional[bool] = None,
    ):
        self.hf_api_token = hf_api_token or os.getenv("HF_API_TOKEN")
        self.model_id = model_id
        self.max_duration = max_duration
        self.min_duration = min_duration
        self.max_file_size_mb = max_file_size_mb
        self.confidence_threshold = confidence_threshold

        self.provider_mode = (stt_provider or os.getenv("STT_PROVIDER", "local")).strip().lower()
        self.enable_api_fallback = (
            enable_api_fallback
            if enable_api_fallback is not None
            else _to_bool(os.getenv("STT_ENABLE_API_FALLBACK"), default=False)
        )
        self.enable_local_fallback = (
            enable_local_fallback
            if enable_local_fallback is not None
            else _to_bool(os.getenv("STT_ENABLE_LOCAL_FALLBACK"), default=False)
        )

        self.local_provider: Optional[_WhisperLocalProvider] = None
        self.api_provider: Optional[_WhisperApiProvider] = None

        _ensure_ffmpeg_backend()
        if self._wants_local_provider():
            _ensure_cuda_libs_on_path()
        self._initialize_providers()

        self.usage_stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_audio_duration": 0.0,
            "api_calls": [],
            "provider_counts": {"local": 0, "api": 0},
            "api_fallback_count": 0,
        }

        active_providers = []
        if self.local_provider:
            active_providers.append("local")
        if self.api_provider:
            active_providers.append("api")
        logger.info(
            "✓ Whisper Handler initialized (mode=%s, providers=%s, api_fallback=%s, local_fallback=%s)",
            self.provider_mode,
            ",".join(active_providers) if active_providers else "none",
            self.enable_api_fallback,
            self.enable_local_fallback,
        )

    def _wants_local_provider(self) -> bool:
        if self.provider_mode in {"local", "auto"}:
            return True
        return self.provider_mode == "api" and self.enable_local_fallback

    def _initialize_providers(self) -> None:
        wants_local = self._wants_local_provider()
        wants_api = self.provider_mode == "api" or self.enable_api_fallback or self.provider_mode == "auto"

        if wants_local:
            device = _detect_device(os.getenv("STT_DEVICE", "auto"))
            compute_type = _resolve_compute_type(device, os.getenv("STT_COMPUTE_TYPE", "auto"))
            model_size = os.getenv("STT_LOCAL_MODEL_SIZE", "medium")
            model_path = os.getenv("STT_MODEL_PATH", "").strip() or None
            cache_dir = os.getenv("STT_CACHE_DIR", "").strip() or None
            cpu_threads = _to_int(os.getenv("STT_CPU_THREADS"))
            beam_size = int(os.getenv("STT_BEAM_SIZE", "5"))

            try:
                self.local_provider = _WhisperLocalProvider(
                    model_size_or_path=model_path or model_size,
                    device=device,
                    compute_type=compute_type,
                    cpu_threads=cpu_threads,
                    cache_dir=cache_dir,
                    beam_size=beam_size,
                )
                logger.info(
                    "✓ Local Whisper ready (model=%s, device=%s, compute_type=%s)",
                    model_path or model_size,
                    device,
                    compute_type,
                )
            except Exception as error:
                self.local_provider = None
                logger.warning(f"Local Whisper initialization failed: {error}")

        if wants_api and self.hf_api_token:
            try:
                self.api_provider = _WhisperApiProvider(self.hf_api_token, self.model_id)
                logger.info("✓ HF Whisper API fallback provider ready")
            except Exception as error:
                self.api_provider = None
                logger.warning(f"HF Whisper API provider initialization failed: {error}")

        if self.provider_mode == "api" and not self.api_provider and not self.local_provider:
            raise ValueError(
                "STT_PROVIDER=api requires HF_API_TOKEN or working local fallback (STT_ENABLE_LOCAL_FALLBACK=true)"
            )
        if self.provider_mode == "api" and not self.api_provider and self.local_provider:
            logger.warning("HF API token missing or invalid; local Whisper will serve STT requests")

        if self.provider_mode in {"local", "auto"} and not self.local_provider and not self.api_provider:
            raise ValueError(
                "No STT provider available. Install faster-whisper for local mode or configure HF_API_TOKEN for API fallback."
            )

    def validate_audio_file(self, audio_path: str) -> Dict[str, Any]:
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.max_file_size_mb:
            raise ValueError(f"File too large: {file_size_mb:.1f}MB (max: {self.max_file_size_mb}MB)")

        try:
            y, sr, duration = decode_audio(str(audio_path))
        except Exception as error:
            raise ValueError(f"Could not process audio file: {error!r}")

        if duration < self.min_duration:
            raise ValueError(f"Audio too short: {duration:.1f}s (min: {self.min_duration}s)")

        if duration > self.max_duration:
            raise ValueError(f"Audio too long: {duration:.1f}s (max: {self.max_duration}s)")

        return {
            "valid": True,
            "duration": duration,
            "file_size_mb": file_size_mb,
            "sample_rate": sr,
            "num_samples": len(y),
        }

    def _transcribe_with_policy(self, audio_path: str, language: Optional[str]) -> Dict[str, Any]:
        local_error: Optional[Exception] = None

        local_first = self.provider_mode in {"local", "auto"}
        if local_first and self.local_provider is not None:
            try:
                return self.local_provider.transcribe(audio_path, language=language)
            except Exception as error:
                local_error = error
                logger.warning(f"Local transcription failed: {error}")

        if self.provider_mode == "api":
            api_error: Optional[Exception] = None
            if self.api_provider is not None:
                try:
                    api_result = self.api_provider.transcribe(audio_path, language=language)
                    api_result["fallback_used"] = False
                    return api_result
                except Exception as error:
                    api_error = error
                    logger.warning(f"HF API transcription failed: {error}")
            if self.local_provider is not None and self.enable_local_fallback:
                local_result = self.local_provider.transcribe(audio_path, language=language)
                local_result["fallback_used"] = api_error is not None
                if api_error is not None:
                    local_result["fallback_reason"] = str(api_error)
                return local_result
            if api_error is not None:
                raise api_error
            raise RuntimeError("No available STT provider for transcription")

        can_fallback_to_api = self.enable_api_fallback and self.api_provider is not None
        if can_fallback_to_api:
            api_result = self.api_provider.transcribe(audio_path, language=language)
            api_result["fallback_used"] = local_error is not None
            if local_error is not None:
                api_result["fallback_reason"] = str(local_error)
            return api_result

        if local_error is not None:
            raise local_error

        raise RuntimeError("No available STT provider for transcription")

    def transcribe_audio(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        start_time = time.time()
        self.usage_stats["total_requests"] += 1

        path_to_use = Path(audio_path)
        temp_wav_path: Optional[Path] = None

        try:
            if path_to_use.suffix.lower() != ".wav":
                file_size_mb = path_to_use.stat().st_size / (1024 * 1024)
                if file_size_mb > self.max_file_size_mb:
                    raise ValueError(f"File too large: {file_size_mb:.1f}MB (max: {self.max_file_size_mb}MB)")

                try:
                    y, sr, duration = decode_audio(str(path_to_use))
                except Exception as error:
                    raise ValueError(f"Could not process audio file: {error!r}")

                if duration < self.min_duration:
                    raise ValueError(f"Audio too short: {duration:.1f}s (min: {self.min_duration}s)")
                if duration > self.max_duration:
                    raise ValueError(f"Audio too long: {duration:.1f}s (max: {self.max_duration}s)")

                validation = {
                    "valid": True,
                    "duration": duration,
                    "file_size_mb": file_size_mb,
                    "sample_rate": sr,
                    "num_samples": len(y),
                }

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
                    temp_wav_path = Path(tmp_wav.name)
                sf.write(str(temp_wav_path), y, sr)
                path_to_use = temp_wav_path
            else:
                validation = self.validate_audio_file(str(path_to_use))

            provider_result = self._transcribe_with_policy(str(path_to_use), language=language)
            elapsed_time = time.time() - start_time

            self.usage_stats["successful_requests"] += 1
            self.usage_stats["total_audio_duration"] += validation["duration"]

            provider_name = provider_result.get("provider", "local")
            if provider_name in self.usage_stats["provider_counts"]:
                self.usage_stats["provider_counts"][provider_name] += 1

            if provider_result.get("fallback_used"):
                self.usage_stats["api_fallback_count"] += 1

            self.usage_stats["api_calls"].append(
                {
                    "timestamp": datetime.now().isoformat(),
                    "duration": validation["duration"],
                    "transcription_length": len(provider_result["transcription"]),
                    "latency_seconds": elapsed_time,
                    "provider": provider_name,
                    "fallback_used": bool(provider_result.get("fallback_used", False)),
                }
            )

            return {
                "success": True,
                "transcription": provider_result["transcription"],
                "duration": validation["duration"],
                "latency_seconds": elapsed_time,
                "confidence": float(provider_result.get("confidence", 1.0)),
                "language": str(provider_result.get("language", language or "auto")),
                "provider": provider_name,
                "fallback_used": bool(provider_result.get("fallback_used", False)),
                "fallback_reason": provider_result.get("fallback_reason"),
            }

        except Exception as error:
            self.usage_stats["failed_requests"] += 1
            logger.error(f"Transcription failed: {error}")
            return {
                "success": False,
                "transcription": None,
                "error": str(error),
                "duration": 0.0,
                "latency_seconds": time.time() - start_time,
            }
        finally:
            if temp_wav_path and temp_wav_path.exists():
                try:
                    temp_wav_path.unlink()
                except Exception:
                    pass

    def transcribe_bytes(self, audio_bytes: bytes, filename: str = "audio.wav", language: Optional[str] = None) -> Dict[str, Any]:
        suffix = Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        try:
            return self.transcribe_audio(temp_path, language=language)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def get_usage_stats(self) -> Dict[str, Any]:
        local_runtime = None
        if self.local_provider is not None:
            local_runtime = {
                "device": self.local_provider.device,
                "compute_type": self.local_provider.compute_type,
                "beam_size": self.local_provider.beam_size,
                "model_size_or_path": self.local_provider.model_size_or_path,
            }

        return {
            "total_requests": self.usage_stats["total_requests"],
            "successful_requests": self.usage_stats["successful_requests"],
            "failed_requests": self.usage_stats["failed_requests"],
            "success_rate": (
                self.usage_stats["successful_requests"] / max(self.usage_stats["total_requests"], 1)
            ) * 100,
            "total_audio_duration_minutes": self.usage_stats["total_audio_duration"] / 60,
            "avg_latency_seconds": (
                sum(call["latency_seconds"] for call in self.usage_stats["api_calls"])
                / max(len(self.usage_stats["api_calls"]), 1)
            ),
            "recent_calls": self.usage_stats["api_calls"][-10:],
            "provider_counts": self.usage_stats["provider_counts"],
            "api_fallback_count": self.usage_stats["api_fallback_count"],
            "provider_mode": self.provider_mode,
            "local_runtime": local_runtime,
        }

    def reset_usage_stats(self) -> None:
        self.usage_stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_audio_duration": 0.0,
            "api_calls": [],
            "provider_counts": {"local": 0, "api": 0},
            "api_fallback_count": 0,
        }
        logger.info("Usage statistics reset")


_whisper_handler: Optional[WhisperHandler] = None


def get_whisper_handler() -> WhisperHandler:
    global _whisper_handler

    if _whisper_handler is None:
        from dotenv import load_dotenv

        load_dotenv()

        _whisper_handler = WhisperHandler(
            hf_api_token=os.getenv("HF_API_TOKEN"),
            model_id=os.getenv("WHISPER_MODEL_ID", "openai/whisper-large-v3-turbo"),
            max_duration=int(os.getenv("MAX_AUDIO_DURATION_SECONDS", 60)),
            min_duration=int(os.getenv("MIN_AUDIO_DURATION_SECONDS", 1)),
            max_file_size_mb=int(os.getenv("MAX_AUDIO_FILE_SIZE_MB", 25)),
            confidence_threshold=float(os.getenv("WHISPER_CONFIDENCE_THRESHOLD", 0.7)),
            stt_provider=os.getenv("STT_PROVIDER", "local"),
            enable_api_fallback=_to_bool(os.getenv("STT_ENABLE_API_FALLBACK"), default=False),
            enable_local_fallback=_to_bool(os.getenv("STT_ENABLE_LOCAL_FALLBACK"), default=False),
        )

    return _whisper_handler


def is_whisper_handler_ready() -> bool:
    return _whisper_handler is not None
