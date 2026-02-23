import torch
import json
import os
import sys
import logging
import uuid
from pathlib import Path
from typing import Optional

# Add parent directory to path to import models
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer
from dotenv import load_dotenv

from models.emergency_classifier import EmergencyClassifier
from audio.whisper_handler import get_whisper_handler
from utils.fallback_rules import apply_keyword_fallback, decide_fallback_reason

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Paths
MODEL_PATH = "models/emergency_model.pt"
META_PATH = "models/label_meta.json"
MAX_TEXT_LENGTH = int(os.getenv("AI_MAX_TEXT_LENGTH", "4000"))
LOW_CONFIDENCE_THRESHOLD = float(os.getenv("AI_LOW_CONFIDENCE_THRESHOLD", "0.7"))
AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

app = FastAPI(
    title="RescueLink Emergency Classification AI",
    description="Microservice for classifying emergency type and severity using XLM-RoBERTa",
    version="2.0.0"
)


def _preview_text_for_log(text: Optional[str], limit: int = 80) -> str:
    normalized = (text or "").replace("\n", " ").strip()
    if not normalized:
        return "[empty]"
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit]}..."


@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response

# Add CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Load Model & Metadata ----------

def load_metadata():
    if not os.path.exists(META_PATH):
        raise FileNotFoundError(f"Metadata not found at {META_PATH}")
    with open(META_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def load_model_and_tokenizer():
    try:
        meta = load_metadata()
        
        # GPU Detection and initialization
        if torch.cuda.is_available():
            device = torch.device("cuda")
            print(f"\n{'='*60}")
            print(f"🎮 GPU DETECTED - Using CUDA")
            print(f"{'='*60}")
            print(f"GPU Device: {torch.cuda.get_device_name(0)}")
            print(f"CUDA Version: {torch.version.cuda}")
            print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB")
            print(f"cuDNN Version: {torch.backends.cudnn.version()}")
            print(f"{'='*60}\n")
        else:
            device = torch.device("cpu")
            print(f"\n{'='*60}")
            print(f"⚠️  GPU NOT AVAILABLE - Using CPU")
            print(f"{'='*60}")
            print(f"Device: CPU")
            print(f"PyTorch Version: {torch.__version__}")
            print(f"{'='*60}\n")
        
        # Initialize model
        model = EmergencyClassifier(
            num_incident_types=len(meta["incident_type_labels"]),
            num_severity_classes=len(meta["severity_labels"]),
            backbone=meta.get("backbone", "xlm-roberta-base"),
        )
        
        # Load weights
        checkpoint = torch.load(MODEL_PATH, map_location=device)
        state_dict = checkpoint.get("model_state_dict") if isinstance(checkpoint, dict) else checkpoint
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(meta.get("backbone", "xlm-roberta-base"))
        
        return model, tokenizer, meta, device
    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e}")

# Load once at startup
model, tokenizer, meta, device = load_model_and_tokenizer()

# ---------- Schemas ----------

class EmergencyRequest(BaseModel):
    text: str
    threshold: float = 0.5  # Multi-label confidence threshold

class EmergencyResponse(BaseModel):
    incident_types: list[str]
    severity: str
    severity_color: str
    confidence_scores: dict[str, float]
    model_version: str
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    fallback_keywords: dict[str, list[str]] = Field(default_factory=dict)

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str

class TranscriptionResponse(BaseModel):
    transcription: Optional[str]
    duration: float
    latency_seconds: float
    confidence: float
    language: str
    error: Optional[str] = None

class AudioClassificationResponse(BaseModel):
    transcription: str
    duration: float
    transcription_latency_seconds: float
    incident_types: list[str]
    severity: str
    severity_color: str
    confidence_scores: dict[str, float]
    low_confidence_flag: bool
    model_version: str
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    fallback_keywords: dict[str, list[str]] = Field(default_factory=dict)

class UsageStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    total_audio_duration_minutes: float
    avg_latency_seconds: float


FALLBACK_INCIDENT_KEYWORDS = {
    "Fire": ["sunog", "fire", "usok", "smoke", "apoy", "nasusunog"],
    "Crime": ["nakaw", "theft", "holdap", "robbery", "baril", "shooting", "crime", "assault"],
    "Accident": ["aksidente", "accident", "bangga", "collision", "nahulog", "crash"],
    "Medical": ["dugo", "bleeding", "hika", "asthma", "atake", "heart attack", "medical", "hinimatay"],
    "Natural Disaster": ["baha", "flood", "bagyo", "storm", "landslide", "lindol", "earthquake", "disaster"],
}

FALLBACK_SEVERITY_KEYWORDS = {
    "Red": ["hindi humihinga", "not breathing", "critical", "critical condition", "malubha", "severe bleeding", "unconscious"],
    "Yellow": ["nasugatan", "injured", "urgent", "kailangan agad", "delayed"],
    "Green": ["minor", "gasgas", "stable", "kalmado", "non urgent"],
    "Black": ["deceased", "patay", "no pulse"],
}


def _normalize_text(text: str) -> str:
    return (text or "").strip().lower()


def _validate_internal_token(request: Request):
    if not AI_INTERNAL_TOKEN:
        return

    received_token = request.headers.get("x-ai-service-token")
    if not received_token or received_token != AI_INTERNAL_TOKEN:
        logger.warning(f"[{request.state.request_id}] Unauthorized AI access attempt: missing/invalid x-ai-service-token")
        raise HTTPException(status_code=401, detail="Unauthorized AI service access")


def _resolve_label(label: str, available_labels: list[str]) -> str:
    if label in available_labels:
        return label

    target = "".join(label.lower().split())
    for candidate in available_labels:
        if "".join(candidate.lower().split()) == target:
            return candidate

    return available_labels[0] if available_labels else label


def _apply_keyword_fallback(text: str) -> tuple[list[str], str, dict[str, list[str]]]:
    return apply_keyword_fallback(
        text,
        incident_labels=meta.get("incident_type_labels", []),
        severity_labels=meta.get("severity_labels", []),
    )


def _predict_text(text: str, threshold: float):
    encoding = tokenizer(
        text,
        truncation=True,
        padding=True,
        max_length=128,
        return_tensors="pt"
    )

    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)

    with torch.no_grad():
        outputs = model(input_ids, attention_mask)
        type_probs = torch.sigmoid(outputs["type_logits"]).cpu().numpy()[0]
        predicted_types = [
            meta["incident_type_labels"][i]
            for i, prob in enumerate(type_probs)
            if prob >= threshold
        ]

        severity_idx = torch.argmax(outputs["severity_logits"], dim=1).item()
        predicted_severity = meta["severity_labels"][severity_idx]

    confidence_scores = {
        meta["incident_type_labels"][i]: round(float(prob), 4)
        for i, prob in enumerate(type_probs)
    }
    max_confidence = max(confidence_scores.values()) if confidence_scores else 0.0
    no_types_above_threshold = len(predicted_types) == 0

    return predicted_types, predicted_severity, confidence_scores, max_confidence, no_types_above_threshold

# ---------- Endpoints ----------

@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(device)
    }

@app.post("/classify", response_model=EmergencyResponse)
def classify_emergency(request: EmergencyRequest, http_request: Request):
    """Classify emergency report into incident types and severity"""
    _validate_internal_token(http_request)

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    if len(request.text.strip()) > MAX_TEXT_LENGTH:
        raise HTTPException(status_code=400, detail=f"Text too long. Max length is {MAX_TEXT_LENGTH} characters")
    
    severity_colors = {
        "Green": "🟢 Non-urgent",
        "Yellow": "🟡 Delayed",
        "Red": "🔴 Immediate",
        "Black": "⚫ Deceased"
    }

    fallback_used = False
    fallback_reason = None
    fallback_keywords: dict[str, list[str]] = {}

    try:
        predicted_types, predicted_severity, confidence_scores, max_confidence, no_types_above_threshold = _predict_text(
            request.text,
            request.threshold
        )

        if no_types_above_threshold or max_confidence < LOW_CONFIDENCE_THRESHOLD:
            fallback_used = True
            fallback_reason = decide_fallback_reason(
                max_confidence=max_confidence,
                no_types_above_threshold=no_types_above_threshold,
                threshold=LOW_CONFIDENCE_THRESHOLD,
            )
            predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(request.text)
            logger.warning(f"[{http_request.state.request_id}] Keyword fallback applied in /classify ({fallback_reason})")
        elif not predicted_types:
            predicted_types = ["Other"]

    except Exception as error:
        logger.error(f"[{http_request.state.request_id}] Model prediction failed, applying fallback: {error}")
        fallback_used = True
        fallback_reason = "model_error"
        confidence_scores = {}
        predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(request.text)

    return {
        "incident_types": predicted_types,
        "severity": predicted_severity,
        "severity_color": severity_colors.get(predicted_severity, "⚪ Unknown"),
        "confidence_scores": confidence_scores,
        "model_version": "2.1.3-xlm-roberta-fallback",
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "fallback_keywords": fallback_keywords,
    }

@app.get("/labels")
def get_labels():
    """Get all available incident type and severity labels"""
    return {
        "incident_types": meta["incident_type_labels"],
        "severities": meta["severity_labels"]
    }

# ---------- Audio Endpoints ----------

@app.post("/v1/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_endpoint(request: Request, file: UploadFile = File(...)):
    """
    Transcribe audio file using Whisper Large V3 Turbo via HF Inference API
    
    Supported formats: .wav, .mp3, .m4a, .flac
    Duration: 30-60 seconds
    Max file size: 25MB
    """
    try:
        _validate_internal_token(request)
        whisper = get_whisper_handler()
        
        # Validate file size
        contents = await file.read()
        file_size_mb = len(contents) / (1024 * 1024)
        
        if file_size_mb > whisper.max_file_size_mb:
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {file_size_mb:.1f}MB (max: {whisper.max_file_size_mb}MB)"
            )
        
        # Save and transcribe
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            result = whisper.transcribe_audio(tmp_path)
            
            if not result["success"]:
                # Fallback to text-only endpoint if transcription fails
                logger.warning(f"[{request.state.request_id}] Transcription failed: {result.get('error')}")
                return TranscriptionResponse(
                    transcription=None,
                    duration=result.get("duration", 0.0),
                    latency_seconds=result.get("latency_seconds", 0.0),
                    confidence=0.0,
                    language="unknown",
                    error=result.get("error", "Transcription failed. Please try again or use text-only endpoint.")
                )
            
            return TranscriptionResponse(
                transcription=result["transcription"],
                duration=result["duration"],
                latency_seconds=result["latency_seconds"],
                confidence=result["confidence"],
                language=result["language"],
            )
        
        finally:
            # Cleanup
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{request.state.request_id}] Transcription endpoint error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription error: {str(e)}"
        )

@app.post("/v1/classify-audio", response_model=AudioClassificationResponse)
async def classify_audio_endpoint(request: Request, file: UploadFile = File(...), threshold: float = 0.5):
    """
    End-to-end audio classification pipeline:
    1. Transcribe audio (Whisper Large V3 Turbo)
    2. Classify transcription (Emergency Classifier)
    
    Returns: Transcription + Incident Types + Severity
    """
    try:
        _validate_internal_token(request)
        whisper = get_whisper_handler()
        
        # Step 1: Validate and transcribe audio
        contents = await file.read()
        file_size_mb = len(contents) / (1024 * 1024)
        
        if file_size_mb > whisper.max_file_size_mb:
            raise HTTPException(
                status_code=400,
                detail=f"File too large: {file_size_mb:.1f}MB (max: {whisper.max_file_size_mb}MB)"
            )
        
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            transcription_result = whisper.transcribe_audio(tmp_path)
            
            if not transcription_result["success"]:
                # Fallback to text-only
                logger.warning(f"[{request.state.request_id}] Transcription failed, returning 503")
                raise HTTPException(
                    status_code=503,
                    detail=f"Speech-to-text service unavailable: {transcription_result.get('error')}. "
                           "Please use text-only endpoint (/classify) or try again."
                )
            
            transcription = transcription_result["transcription"].strip()
            
            if not transcription:
                raise HTTPException(
                    status_code=400,
                    detail="No speech detected in audio. Please provide clear audio."
                )
            
            transcription_latency = transcription_result["latency_seconds"]
            duration = transcription_result["duration"]
            
            # Step 2: Classify transcription
            if not transcription.strip():
                raise HTTPException(status_code=400, detail="Empty transcription from audio")

            fallback_used = False
            fallback_reason = None
            fallback_keywords: dict[str, list[str]] = {}

            try:
                predicted_types, predicted_severity, confidence_scores, max_confidence, no_types_above_threshold = _predict_text(
                    transcription,
                    threshold
                )

                if no_types_above_threshold or max_confidence < LOW_CONFIDENCE_THRESHOLD:
                    fallback_used = True
                    fallback_reason = decide_fallback_reason(
                        max_confidence=max_confidence,
                        no_types_above_threshold=no_types_above_threshold,
                        threshold=LOW_CONFIDENCE_THRESHOLD,
                    )
                    predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(transcription)
                    logger.warning(f"[{request.state.request_id}] Keyword fallback applied in /v1/classify-audio ({fallback_reason})")
                elif not predicted_types:
                    predicted_types = ["Other"]
            except Exception as error:
                logger.error(f"[{request.state.request_id}] Audio classification model error, applying fallback: {error}")
                fallback_used = True
                fallback_reason = "model_error"
                confidence_scores = {}
                predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(transcription)
                max_confidence = 0.0
            
            # Severity color mapping
            severity_colors = {
                "Green": "🟢 Non-urgent",
                "Yellow": "🟡 Delayed",
                "Red": "🔴 Immediate",
                "Black": "⚫ Deceased"
            }
            
            # Check if any incident type confidence is low
            low_confidence_flag = max_confidence < whisper.confidence_threshold
            
            if low_confidence_flag:
                logger.warning(
                    f"Low confidence classification: {max_confidence:.2f} "
                    f"(threshold: {whisper.confidence_threshold})"
                )
            
            return AudioClassificationResponse(
                transcription=transcription,
                duration=duration,
                transcription_latency_seconds=transcription_latency,
                incident_types=predicted_types,
                severity=predicted_severity,
                severity_color=severity_colors.get(predicted_severity, "⚪ Unknown"),
                confidence_scores=confidence_scores,
                low_confidence_flag=low_confidence_flag,
                model_version="2.1.3-xlm-roberta-whisper-fallback",
                fallback_used=fallback_used,
                fallback_reason=fallback_reason,
                fallback_keywords=fallback_keywords,
            )
        
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{request.state.request_id}] Audio classification endpoint error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Classification error: {str(e)}"
        )

@app.post("/v1/classify-mic", response_model=AudioClassificationResponse)
async def classify_microphone(request: Request, duration_seconds: int = 30, sample_rate: int = 16000, threshold: float = 0.3):
    """
    Combined microphone recording + auto-classification endpoint.
    
    Records from microphone, transcribes, and automatically classifies.
    Provides live feedback at each step.
    """
    try:
        _validate_internal_token(request)
        import sounddevice as sd
        import soundfile as sf
        import tempfile
        import time
        
        whisper = get_whisper_handler()
        
        if duration_seconds < whisper.min_duration or duration_seconds > whisper.max_duration:
            raise HTTPException(
                status_code=400,
                detail=f"Duration {duration_seconds}s out of bounds ({whisper.min_duration}-{whisper.max_duration}s)"
            )
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        
        # === STEP 1: RECORD AUDIO ===
        logger.info(f"🎤 RECORDING STARTED - Duration: {duration_seconds}s")
        print(f"\n{'='*70}")
        print(f"🎤 MICROPHONE RECORDING STARTED")
        print(f"{'='*70}")
        print(f"Duration: {duration_seconds} seconds")
        print(f"Sample Rate: {sample_rate} Hz")
        print(f"Channels: 1 (Mono)")
        print(f"Status: Recording in progress...")
        print(f"{'='*70}")
        
        # Record with progress feedback
        audio = sd.rec(int(duration_seconds * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
        start_time = time.time()
        
        while sd.get_stream().active:
            elapsed = time.time() - start_time
            if elapsed >= duration_seconds:
                break
            progress = int((elapsed / duration_seconds) * 50)
            bar = "█" * progress + "░" * (50 - progress)
            print(f"  Recording: [{bar}] {elapsed:.1f}s / {duration_seconds}s", end="\r")
            time.sleep(0.1)
        
        sd.wait()
        print(f"\n✅ Recording complete: {duration_seconds}s captured\n")
        
        sf.write(tmp_path, audio, sample_rate)
        logger.info(f"✅ Audio saved to {tmp_path}")
        
        # === STEP 2: TRANSCRIBE AUDIO ===
        logger.info(f"📝 Transcribing audio...")
        print(f"📝 Transcribing audio from microphone...\n")
        
        transcription_result = whisper.transcribe_audio(tmp_path)
        
        if not transcription_result.get("success", False):
            error_msg = transcription_result.get("error", "Transcription failed")
            logger.error(f"❌ Transcription error: {error_msg}")
            print(f"❌ Transcription failed: {error_msg}\n")
            raise HTTPException(
                status_code=503,
                detail=f"Transcription failed: {error_msg}"
            )
        
        transcription = transcription_result.get("transcription", "").strip()
        transcription_latency = transcription_result.get("latency_seconds", 0.0)
        duration_recorded = transcription_result.get("duration", float(duration_seconds))
        
        logger.info(f"[{request.state.request_id}] ✅ Transcription preview: {_preview_text_for_log(transcription)}")
        print(f"✅ Transcription complete")
        print(f"   Text Preview: {_preview_text_for_log(transcription, 120)}")
        print(f"   Latency: {transcription_latency:.2f}s")
        print(f"   Duration: {duration_recorded:.2f}s\n")
        
        if not transcription:
            raise HTTPException(
                status_code=400,
                detail="No speech detected in microphone audio."
            )
        
        # === STEP 3: CLASSIFY TRANSCRIPTION ===
        logger.info(f"🚨 Classifying transcription...")
        print(f"🚨 Classifying emergency incident...\n")

        fallback_used = False
        fallback_reason = None
        fallback_keywords: dict[str, list[str]] = {}

        try:
            predicted_types, predicted_severity, confidence_scores, max_confidence, no_types_above_threshold = _predict_text(
                transcription,
                threshold
            )

            if no_types_above_threshold or max_confidence < LOW_CONFIDENCE_THRESHOLD:
                fallback_used = True
                fallback_reason = decide_fallback_reason(
                    max_confidence=max_confidence,
                    no_types_above_threshold=no_types_above_threshold,
                    threshold=LOW_CONFIDENCE_THRESHOLD,
                )
                predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(transcription)
                logger.warning(f"[{request.state.request_id}] Keyword fallback applied in /v1/classify-mic ({fallback_reason})")
            elif not predicted_types:
                predicted_types = ["Other"]
        except Exception as error:
            logger.error(f"[{request.state.request_id}] Microphone model error, applying fallback: {error}")
            fallback_used = True
            fallback_reason = "model_error"
            confidence_scores = {}
            predicted_types, predicted_severity, fallback_keywords = _apply_keyword_fallback(transcription)
            max_confidence = 0.0
        
        # Severity color mapping
        severity_colors = {
            "Green": "🟢 Non-urgent",
            "Yellow": "🟡 Delayed",
            "Red": "🔴 Immediate",
            "Black": "⚫ Deceased"
        }
        
        # Check if any incident type confidence is low
        low_confidence_flag = max_confidence < whisper.confidence_threshold
        
        # === DISPLAY RESULTS ===
        logger.info(f"[{request.state.request_id}] ✅ Classification complete: {predicted_types} / {predicted_severity}")
        print(f"✅ Classification complete\n")
        print(f"{'='*70}")
        print(f"CLASSIFICATION RESULTS")
        print(f"{'='*70}")
        print(f"\n📋 Original Message:")
        print(f"   {_preview_text_for_log(transcription, 180)}")
        print(f"\n🚨 Incident Types: {', '.join(predicted_types)}")
        print(f"{severity_colors.get(predicted_severity, '⚪ Unknown')} Severity Level")
        print(f"\n🤖 Model: {meta.get('backbone', 'xlm-roberta-base')}")
        print(f"⚠️  Threshold: {threshold} | Max Confidence: {max_confidence:.2%}")
        print(f"\n📊 Confidence Scores:")
        for incident_type, score in confidence_scores.items():
            bar = "█" * int(score * 20)
            print(f"  {incident_type:.<20} {score:>6.2%} {bar}")
        
        if low_confidence_flag:
            print(f"\n⚠️  LOW CONFIDENCE FLAG: Max confidence {max_confidence:.2%} < {whisper.confidence_threshold:.2%}")
        
        print(f"\n{'='*70}\n")
        
        if low_confidence_flag:
            logger.warning(
                f"Low confidence classification: {max_confidence:.2f} "
                f"(threshold: {whisper.confidence_threshold})"
            )
        
        return AudioClassificationResponse(
            transcription=transcription,
            duration=duration_recorded,
            transcription_latency_seconds=transcription_latency,
            incident_types=predicted_types,
            severity=predicted_severity,
            severity_color=severity_colors.get(predicted_severity, "⚪ Unknown"),
            confidence_scores=confidence_scores,
            low_confidence_flag=low_confidence_flag,
            model_version="2.1.3-xlm-roberta-whisper-fallback",
            fallback_used=fallback_used,
            fallback_reason=fallback_reason,
            fallback_keywords=fallback_keywords,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[{request.state.request_id}] Microphone classification failed: {e}")
        print(f"\n❌ Error: {e}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Microphone classification failed: {str(e)}"
        )

@app.get("/v1/audio/stats", response_model=UsageStatsResponse)
def get_audio_stats():
    """Get Whisper API usage statistics (monitoring)"""
    try:
        whisper = get_whisper_handler()
        stats = whisper.get_usage_stats()
        return UsageStatsResponse(
            total_requests=stats["total_requests"],
            successful_requests=stats["successful_requests"],
            failed_requests=stats["failed_requests"],
            success_rate=stats["success_rate"],
            total_audio_duration_minutes=stats["total_audio_duration_minutes"],
            avg_latency_seconds=stats["avg_latency_seconds"],
        )
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/audio/stats/reset")
def reset_audio_stats():
    """Reset usage statistics (admin only)"""
    try:
        whisper = get_whisper_handler()
        whisper.reset_usage_stats()
        return {"status": "success", "message": "Audio statistics reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Startup ----------

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("RescueLink AI - Emergency Classifier API (v2.1.0)")
    print("=" * 60)
    print(f"Model: {meta.get('backbone', 'xlm-roberta-base')}")
    print(f"Incident Types: {meta['incident_type_labels']}")
    print(f"Severities: {meta['severity_labels']}")
    print(f"Device: {device}")
    print(f"Threshold: {meta.get('threshold', 0.5)}")
    print("")
    print("✓ Emergency Classifier loaded")

    if not AI_INTERNAL_TOKEN and ENVIRONMENT != "development":
        logger.warning("⚠️ AI_INTERNAL_TOKEN is not set outside development environment")
    
    # Initialize Whisper handler
    try:
        whisper = get_whisper_handler()
        print(f"✓ Whisper Handler initialized (HF Inference API)")
        print(f"  - Max duration: {whisper.max_duration}s")
        print(f"  - Min duration: {whisper.min_duration}s")
        print(f"  - Max file size: {whisper.max_file_size_mb}MB")
        print(f"  - Confidence threshold: {whisper.confidence_threshold}")
    except Exception as e:
        print(f"⚠ Whisper Handler NOT available: {e}")
        print("  - Audio endpoints will return errors until configured")
    
    print("=" * 60)

