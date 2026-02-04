"""
Hugging Face Inference API Handler for Whisper Large V3 Turbo
Handles speech-to-text transcription with file validation, error handling, and usage monitoring
"""

import os
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from huggingface_hub import InferenceClient
import librosa
import soundfile as sf

logger = logging.getLogger(__name__)


class WhisperHandler:
    """Handle Whisper transcription via Hugging Face Inference API"""
    
    def __init__(
        self,
        hf_api_token: str,
        model_id: str = "openai/whisper-large-v3-turbo",
        max_duration: int = 60,
        min_duration: int = 1,
        max_file_size_mb: int = 25,
        confidence_threshold: float = 0.7,
    ):
        """
        Initialize Whisper handler
        
        Args:
            hf_api_token: Hugging Face API token
            model_id: Model identifier on HF Hub
            max_duration: Maximum audio duration in seconds
            min_duration: Minimum audio duration in seconds
            max_file_size_mb: Maximum file size in MB
            confidence_threshold: Confidence threshold for flagging low-quality transcriptions
        """
        self.hf_api_token = hf_api_token
        self.model_id = model_id
        self.max_duration = max_duration
        self.min_duration = min_duration
        self.max_file_size_mb = max_file_size_mb
        self.confidence_threshold = confidence_threshold
        
        # Initialize InferenceClient with HF token
        self.client = InferenceClient(token=hf_api_token)
        
        # Usage statistics
        self.usage_stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_audio_duration": 0.0,
            "api_calls": [],
        }
        
        logger.info(f"✓ Whisper Handler initialized (Model: {model_id})")

    def validate_audio_file(self, audio_path: str) -> Dict[str, Any]:
        """
        Validate audio file for transcription
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            dict with validation results and audio metadata
        """
        audio_path = Path(audio_path)
        
        # Check file exists
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Check file size
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.max_file_size_mb:
            raise ValueError(
                f"File too large: {file_size_mb:.1f}MB (max: {self.max_file_size_mb}MB)"
            )
        
        # Load and check duration (path may already be WAV from conversion in transcribe_audio)
        try:
            y, sr = librosa.load(str(audio_path), sr=None)
            duration = librosa.get_duration(y=y, sr=sr)
        except Exception as e:
            raise ValueError(f"Could not process audio file: {e!r}")
        
        # Check duration constraints
        if duration < self.min_duration:
            raise ValueError(
                f"Audio too short: {duration:.1f}s (min: {self.min_duration}s)"
            )
        
        if duration > self.max_duration:
            raise ValueError(
                f"Audio too long: {duration:.1f}s (max: {self.max_duration}s)"
            )
        
        return {
            "valid": True,
            "duration": duration,
            "file_size_mb": file_size_mb,
            "sample_rate": sr,
            "num_samples": len(y),
        }
    
    def transcribe_audio(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio using HF Inference API
        
        Args:
            audio_path: Path to audio file
            language: Language code (optional, auto-detected if None)
            
        Returns:
            dict with transcription results
        """
        start_time = time.time()
        self.usage_stats["total_requests"] += 1
        
        path_to_use = Path(audio_path)
        
        try:
            # Validate audio file (duration, size)
            validation = self.validate_audio_file(str(path_to_use))
            
            # Call HF Inference API using official InferenceClient with path string
            logger.info(f"Sending audio to Whisper API (duration: {validation['duration']:.1f}s, model: {self.model_id})")
            
            result = self.client.automatic_speech_recognition(
                audio=str(path_to_use),
                model=self.model_id,
            )
            
            # Extract transcription from InferenceClient response
            if isinstance(result, dict):
                transcription = result.get("text") or ""
            elif isinstance(result, str):
                transcription = result
            else:
                raise ValueError(f"Unexpected API response format: {result}")
            
            if not transcription or not transcription.strip():
                raise ValueError("Empty transcription returned from API")
            
            elapsed_time = time.time() - start_time
            
            # Record usage
            self.usage_stats["successful_requests"] += 1
            self.usage_stats["total_audio_duration"] += validation["duration"]
            self.usage_stats["api_calls"].append({
                "timestamp": datetime.now().isoformat(),
                "duration": validation["duration"],
                "transcription_length": len(transcription),
                "latency_seconds": elapsed_time,
            })
            
            return {
                "success": True,
                "transcription": transcription,
                "duration": validation["duration"],
                "latency_seconds": elapsed_time,
                "confidence": 1.0,  # HF API doesn't return confidence; assume high
                "language": language or "auto",
            }
        
        except Exception as e:
            self.usage_stats["failed_requests"] += 1
            logger.error(f"Transcription failed: {e}")
            return {
                "success": False,
                "transcription": None,
                "error": str(e),
                "duration": 0.0,
                "latency_seconds": time.time() - start_time,
            }
    
    def transcribe_bytes(
        self, audio_bytes: bytes, filename: str = "audio.wav", language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio from bytes
        
        Args:
            audio_bytes: Audio data as bytes
            filename: Original filename (for format detection)
            language: Language code (optional)
            
        Returns:
            dict with transcription results
        """
        # Save bytes to temporary file
        temp_path = f"/tmp/{filename}"
        os.makedirs("/tmp", exist_ok=True)
        
        try:
            with open(temp_path, "wb") as f:
                f.write(audio_bytes)
            
            result = self.transcribe_audio(temp_path, language)
            return result
        finally:
            # Cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get API usage statistics"""
        return {
            "total_requests": self.usage_stats["total_requests"],
            "successful_requests": self.usage_stats["successful_requests"],
            "failed_requests": self.usage_stats["failed_requests"],
            "success_rate": (
                self.usage_stats["successful_requests"] / max(self.usage_stats["total_requests"], 1)
            ) * 100,
            "total_audio_duration_minutes": self.usage_stats["total_audio_duration"] / 60,
            "avg_latency_seconds": (
                sum(c["latency_seconds"] for c in self.usage_stats["api_calls"]) / 
                max(len(self.usage_stats["api_calls"]), 1)
            ),
            "recent_calls": self.usage_stats["api_calls"][-10:],  # Last 10 calls
        }
    
    def reset_usage_stats(self) -> None:
        """Reset usage statistics"""
        self.usage_stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_audio_duration": 0.0,
            "api_calls": [],
        }
        logger.info("Usage statistics reset")


# Lazy initialization
_whisper_handler: Optional[WhisperHandler] = None

def get_whisper_handler() -> WhisperHandler:
    """Get or create Whisper handler (singleton pattern)"""
    global _whisper_handler
    
    if _whisper_handler is None:
        from dotenv import load_dotenv
        
        load_dotenv()
        
        hf_token = os.getenv("HF_API_TOKEN")
        if not hf_token:
            raise ValueError("HF_API_TOKEN not set in environment")
        
        _whisper_handler = WhisperHandler(
            hf_api_token=hf_token,
            model_id=os.getenv("WHISPER_MODEL_ID", "openai/whisper-large-v3-turbo"),
            max_duration=int(os.getenv("MAX_AUDIO_DURATION_SECONDS", 60)),
            min_duration=int(os.getenv("MIN_AUDIO_DURATION_SECONDS", 1)),
            max_file_size_mb=int(os.getenv("MAX_AUDIO_FILE_SIZE_MB", 25)),
            confidence_threshold=float(os.getenv("WHISPER_CONFIDENCE_THRESHOLD", 0.7)),
        )
    
    return _whisper_handler
