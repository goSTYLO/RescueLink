# RescueLink AI - Audio Pipeline & Emergency Classification Microservice

**Version**: 2.1.1  
**Status**: Full audio pipeline with microphone feedback & auto-classification

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What's New (Audio Pipeline)](#whats-new-audio-pipeline)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Current Limitations (Testing Phase)](#️-current-limitations-testing-phase)
6. [Setup Instructions](#setup-instructions)
7. [Configuration](#configuration)
8. [API Endpoints](#api-endpoints)
9. [Testing](#testing)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Cloud Deployment](#cloud-deployment)

---

## Overview

RescueLink AI is a multilingual emergency classification microservice that:
- **Classifies emergency reports** by incident type (6 categories) and severity (4 levels)
- **Transcribes emergency audio** using OpenAI Whisper Large V3 Turbo (via HF Inference API)
- **Chains both models** for end-to-end audio→classification pipeline
- **Validates input** with strict audio constraints (30-60 seconds, <25MB)
- **Handles failures gracefully** with fallback mechanisms
- **Monitors performance** with usage statistics & confidence tracking

### Supported Languages
- **Filipino** (Priority - 64% of training data)
- **English** (Secondary - 36% of training data)
- **Auto-detection** via Whisper

---

## What's New (Audio Pipeline)

### v2.1.1 - Human Verification & Enhanced Classification

**Latest improvements:**
- ✅ **Human Verification**: Original message text included in all classification responses
- ✅ **Threshold Optimized**: Default confidence threshold adjusted from 0.5 → 0.3 for more accurate multi-label classification
- ✅ **Enhanced Display**: Formatted classification output with visual confidence bars
- ✅ **Microphone Feedback**: Real-time recording status with progress bars
- ✅ **Auto-Classification**: New `/v1/classify-mic` endpoint records + transcribes + classifies in one step
- ✅ **End-to-End Testing**: Complete microphone→transcription→classification pipeline validated

### v2.1.0 - Audio Integration

This release adds **complete audio-to-emergency-classification** capabilities:

#### New Endpoints
| Endpoint | Method | Purpose | Input | Status |
|----------|--------|---------|-------|--------|
| `/v1/transcribe` | POST | Transcribe audio to text | Audio file (.wav, .mp3, .m4a, .flac) | ✅ |
| `/v1/transcribe-mic` | POST | Record microphone + transcribe | Duration (15-60s) | ✅ with feedback |
| `/v1/classify-audio` | POST | Full audio→classification pipeline | Audio file + optional threshold | ✅ |
| `/v1/classify-mic` | POST | **NEW**: Record mic + auto-classify | Duration + threshold | ✅ all-in-one |
| `/v1/audio/stats` | GET | Get API usage & monitoring metrics | None | ✅ |
| `/v1/audio/stats/reset` | GET | Reset usage statistics (admin) | None | ✅ |

#### New Modules
- **`audio/whisper_handler.py`** - Hugging Face Whisper integration with validation & monitoring
- **`AudioPipelineTest.ipynb`** - Comprehensive testing notebook for operational considerations

#### Key Files Modified
- **`requirements.txt`** - Added audio processing dependencies
- **`api/main.py`** - Extended with 4 new audio endpoints + error handling
- **`.env.example`** - Configuration template for HF API token & audio constraints

---

## Architecture

### Pipeline Diagram

```
Audio File (30-60s, <25MB)
         ↓
    [Validation]
         ↓
[Whisper Large V3 Turbo] ← HF Inference API (no GPU needed)
         ↓
  Transcription Text
         ↓
[XLM-RoBERTa Classifier]
         ↓
┌─────────────────────────────┐
│ Incident Types (multi-label)│
│ Severity Level (single)     │
│ Confidence Scores           │
│ Low Confidence Flag         │
└─────────────────────────────┘
```

### Model Stack

| Component | Model | Size | Type |
|-----------|-------|------|------|
| **Speech-to-Text** | Whisper Large V3 Turbo | ~10GB | Cloud (HF API) |
| **Text Classification** | XLM-RoBERTa Base | ~550MB | Local GPU/CPU |
| **Tokenizer** | XLM-RoBERTa Fast | ~100MB | Bundled |

### Decision: Hugging Face Inference API

**Why HF API for Testing?**
- ✅ No local downloads (~10GB Whisper)
- ✅ RTX 4050 Laptop GPU compatible
- ✅ Immediate access to Whisper Large V3 Turbo
- ✅ Free tier for testing (~100 req/day)
- ⚠️ Paid tier ($9/month) for production scale

**Future: Cloud Deployment**
- For production, containerize Whisper in cloud (AWS ECS, GCP Cloud Run, Azure ACI, K8s)
- Use same API structure (drop-in replacement)

---

## Features

### 1. **Audio Classification Pipeline**
- End-to-end: audio → transcription → incident classification
- Supports multiple audio formats: .wav, .mp3, .m4a, .flac, .ogg
- Automatic language detection (English/Filipino)

### 2. **Strict Input Validation**
- **Duration**: 30-60 seconds (prevents edge cases)
- **File Size**: Maximum 25MB (API limits)
- **Format**: Supported formats only
- **Content Check**: Detects empty/silent audio

### 3. **Multi-Label Incident Classification**
- **6 Incident Types**: Fire, Crime, Accident, Medical, Natural Disaster, Other
- **Confidence Scores**: Per-incident-type probability
- **Threshold Support**: Configurable multi-label threshold (optimized default 0.3)
- **Human Verification**: Original message included in all responses for operator review

### 4. **Severity Triage (START Protocol)**
- 🟢 **Green** - Non-urgent
- 🟡 **Yellow** - Delayed (30-60 mins)
- 🔴 **Red** - Immediate (life-threatening)
- ⚫ **Black** - Deceased

### 5. **Error Handling & Fallbacks**
- **Validation Failure (400)**: Detailed error messages, specific fix recommendations
- **Transcription Failure (503)**: Service unavailable; users can use text-only endpoint
- **Classification Failure (500)**: Internal error; suggest retry
- **Low Confidence Flag**: Alerts when max confidence < 0.7

### 6. **Monitoring & Analytics**
- **Usage Tracking**: Total calls, success rate, average latency
- **Confidence Metrics**: Distribution, low-confidence alerts
- **Performance Metrics**: Per-stage latency, duration analysis
- **Admin Reset**: Clear stats for new test cycles

### 7. **CORS Enabled**
- Cross-Origin requests allowed (frontend integration)
- Configurable origins (set to specific domains in production)

---

## ⚠️ Current Limitations (Testing Phase)

### Hugging Face Inference API Constraints

**Free Tier Limits:**
- **Rate Limit**: ~1,000 requests/day (burst: 100 req/hour)
- **Inference Time**: 5-30 seconds per request (varies by model load)
- **Concurrent Requests**: 1 request at a time (queued if busy)
- **Model Availability**: Subject to HF server load (can be slow during peak hours)

**Quota Exceeded Behavior:**
- API returns `429 Too Many Requests` error
- Fallback to text-only endpoint (`/classify`) with manual transcription
- Monitoring endpoint (`/v1/audio/stats`) tracks usage to prevent hitting limits

**Upgrading Options:**

| Plan | Cost | Limits | Best For |
|------|------|--------|----------|
| **Free** | $0/month | ~1,000 req/day | Testing ✅ |
| **Pro** | $9/month | ~30,000 req/day | Small pilots |
| **Enterprise** | Custom | Unlimited | Production |

**For Production:**
- **Recommendation**: Deploy self-hosted Whisper Large V3 Turbo in cloud (AWS/GCP/Azure)
- **Why**: No API rate limits, faster inference (<2s), full control, lower long-term cost
- **When**: Before public beta or when exceeding 500+ daily audio reports

**Monitoring Your Usage:**
```bash
# Check current API call count
curl http://localhost:8000/v1/audio/stats

# Response shows:
{
  "total_requests": 47,
  "successful_requests": 45,
  "failed_requests": 2,
  "success_rate": 95.74,
  "total_audio_duration_minutes": 35.2,
  "avg_latency_seconds": 8.3
}
```

**Rate Limit Alerts:**
The API automatically logs warnings at 80% quota (800 calls/day) and errors at 100%.

---

## Setup Instructions

### Prerequisites
- Python 3.9+
- Hugging Face account (free)
- 2GB RAM (for model loading)
- Internet connection (for HF API)

### Step 1: Install Dependencies

```bash
cd "RescueLink AI"
pip install -r requirements.txt
```

**What gets installed:**
- PyTorch (deep learning)
- Transformers (Hugging Face models)
- FastAPI, Uvicorn (API server)
- Librosa, Soundfile (audio processing)
- Requests (HTTP calls)
- Python-dotenv (environment management)

### Step 2: Get HF API Token

1. Go to [huggingface.co](https://huggingface.co)
2. Sign up (free) if you don't have an account
3. Navigate to Settings → Access Tokens
4. Create new token (read access is sufficient)
5. Copy token to clipboard

### Step 3: Create `.env` File

```bash
# Copy example config
cp .env.example .env

# Edit .env and add your token
```

**`.env` file:**
```
HF_API_TOKEN=hf_your_token_here_1234567890

# Audio Settings (already set, no changes needed)
MAX_AUDIO_DURATION_SECONDS=60
MIN_AUDIO_DURATION_SECONDS=30
MAX_AUDIO_FILE_SIZE_MB=25
WHISPER_CONFIDENCE_THRESHOLD=0.7

# Whisper Model
WHISPER_MODEL_ID=openai/whisper-large-v3-turbo

# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### Step 4: Verify Setup

```bash
# Check Python version
python --version  # Should be 3.9+

# Check GPU availability (optional)
python -c "import torch; print(f'GPU Available: {torch.cuda.is_available()}')"

# Verify environment variables
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(f'HF Token: {os.getenv(\"HF_API_TOKEN\")[:10]}...')"
```

### Step 5: Start API Server

```bash
uvicorn api.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
============================================================
RescueLink AI - Emergency Classifier API (v2.1.0)
============================================================
Model: xlm-roberta-base
Incident Types: ['Fire', 'Crime', 'Accident', 'Medical', 'Natural Disaster', 'Other']
Severities: ['Green', 'Yellow', 'Red', 'Black']
Device: cuda (or cpu)
Threshold: 0.5

✓ Emergency Classifier loaded
✓ Whisper Handler initialized (HF Inference API)
  - Max duration: 60s
  - Min duration: 30s
  - Max file size: 25MB
  - Confidence threshold: 0.7
============================================================
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Required
HF_API_TOKEN=hf_your_huggingface_api_token

# Audio Constraints (modify as needed)
MIN_AUDIO_DURATION_SECONDS=30      # Minimum valid audio length
MAX_AUDIO_DURATION_SECONDS=60      # Maximum valid audio length
MAX_AUDIO_FILE_SIZE_MB=25          # Maximum file size

# Whisper Configuration (leave as-is for Large V3 Turbo)
WHISPER_MODEL_ID=openai/whisper-large-v3-turbo

# Logging
ENVIRONMENT=development            # 'development' or 'production'
LOG_LEVEL=INFO                     # DEBUG, INFO, WARNING, ERROR
```

### Classification Threshold (Runtime)

Control multi-label incident classification confidence:

```bash
# Default: 0.3 (any predicted incident ≥ 30% confidence)
# Optimized for recall - catches more incidents with acceptable precision
curl -X POST http://localhost:8000/v1/classify-audio \
  -F "file=@emergency.wav" \
  -F "threshold=0.5"  # Stricter: Only return incidents ≥ 50% confidence
```

**Threshold Guidelines:**
- **0.3** (default) - Catch all potential incidents, good for emergency response
- **0.5** - Balanced precision/recall
- **0.7** - Higher precision, fewer false positives

---

## API Endpoints

### 1. Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda"
}
```

---

### 2. Text Classification (Existing)

```bash
POST /classify
Content-Type: application/json

{
  "text": "May fire sa bahay, medyo malaki na!",
  "threshold": 0.5
}
```

**Response (with human verification message):**
```json
{
  "message": "May fire sa bahay, medyo malaki na!",
  "incident_types": ["Fire"],
  "severity": "Red",
  "severity_color": "\ud83d\udd34 Immediate",
  "confidence_scores": {
    "Fire": 0.9812,
    "Crime": 0.0234,
    "Accident": 0.1456,
    "Medical": 0.0891,
    "Natural Disaster": 0.0123,
    "Other": 0.0456
  },
  "model_version": "2.0.0-xlm-roberta-filipino"
}
```

*Note: `message` field enables human verification of AI classification accuracy*

---

### 3. Audio Transcription Only

```bash
POST /v1/transcribe
Content-Type: multipart/form-data

file: emergency_audio.wav
```

**Response:**
```json
{
  "transcription": "There is a fire in my house, it's quite large!",
  "duration": 45.2,
  "latency_seconds": 3.4,
  "confidence": 1.0,
  "language": "auto",
  "error": null
}
```

**Error (if audio invalid):**
```json
{
  "detail": "File too large: 30.2MB (max: 25MB)"
}
```

**Error (if HF API down):**
```json
{
  "transcription": null,
  "duration": 45.2,
  "latency_seconds": 60.0,
  "confidence": 0.0,
  "language": "unknown",
  "error": "HF API error 503: Service Unavailable. Please use text-only endpoint (/classify) or try again."
}
```

---

### 4. Full Audio→Classification Pipeline

```bash
POST /v1/classify-audio
Content-Type: multipart/form-data

file: emergency_audio.wav
threshold: 0.5
```

**Response:**
```json
{
  "transcription": "There is a fire in my house, it's quite large!",
  "duration": 45.2,
  "transcription_latency_seconds": 3.4,
  "incident_types": ["Fire"],
  "severity": "Red",
  "severity_color": "🔴 Immediate",
  "confidence_scores": {
    "Fire": 0.9812,
    "Crime": 0.0234,
    "Accident": 0.1456,
    "Medical": 0.0891,
    "Natural Disaster": 0.0123,
    "Other": 0.0456
  },
  "low_confidence_flag": false,
  "model_version": "2.0.0-xlm-roberta-whisper"
}
```

**Error (fallback):**
```json
{
  "detail": "Speech-to-text service unavailable: HF API timeout after 60s. Please use text-only endpoint (/classify) or try again."
}
```

---

### 5. Microphone Recording + Auto-Classification (All-in-One)

🆕 **NEW ENDPOINT** - Combined recording, transcription, and classification in a single request with live feedback.

```bash
POST /v1/classify-mic
Content-Type: application/json

{
  "duration_seconds": 30,
  "sample_rate": 16000,
  "threshold": 0.3
}
```

**Features:**
- 🎤 Real-time recording progress feedback (progress bar)
- ✅ Automatic transcription via Whisper API
- 🚨 Automatic classification with incident detection
- 📊 Formatted output with confidence bars
- ⚠️ Low confidence alerts

**Response:**
```json
{
  "transcription": "May fire sa bahay, malaki na!",
  "duration": 30.0,
  "transcription_latency_seconds": 3.4,
  "incident_types": ["Fire"],
  "severity": "Red",
  "severity_color": "🔴 Immediate",
  "confidence_scores": {
    "Fire": 0.9812,
    "Crime": 0.0234,
    "Accident": 0.1456,
    "Medical": 0.0891,
    "Natural Disaster": 0.0123,
    "Other": 0.0456
  },
  "low_confidence_flag": false,
  "model_version": "2.0.0-xlm-roberta-whisper"
}
```

**Console Feedback Example:**
```
======================================================================
🎤 MICROPHONE RECORDING STARTED
======================================================================
Duration: 30 seconds
Sample Rate: 16000 Hz
Channels: 1 (Mono)
Status: Recording in progress...
======================================================================
  Recording: [██████████████░░░░░░░░░░░░░░░░░░] 15.0s / 30s

✅ Recording complete: 30s captured

📝 Transcribing audio from microphone...

✅ Transcription complete
   Text: There is a fire at my house
   Latency: 3.40s
   Duration: 30.00s

🚨 Classifying emergency incident...

✅ Classification complete

======================================================================
CLASSIFICATION RESULTS
======================================================================

📋 Original Message:
   There is a fire at my house

🚨 Incident Types: Fire
🔴 Immediate Severity Level

🤖 Model: xlm-roberta-base
⚠️  Threshold: 0.3 | Max Confidence: 98.12%

📊 Confidence Scores:
  Fire..................... 98.12% ████████████████████
  Crime.................... 2.34% 
  Accident................. 14.56% ██
  Medical.................. 8.91% █
  Natural Disaster......... 1.23% 
  Other.................... 4.56% 

======================================================================
```

---

### 6. Usage Statistics & Monitoring

```bash
GET /v1/audio/stats
```

**Response:**
```json
{
  "total_requests": 42,
  "successful_requests": 39,
  "failed_requests": 3,
  "success_rate": 92.86,
  "total_audio_duration_minutes": 31.25,
  "avg_latency_seconds": 3.8
}
```

---

### 7. Reset Statistics (Admin)

```bash
GET /v1/audio/stats/reset
```

**Response:**
```json
{
  "status": "success",
  "message": "Audio statistics reset"
}
```

---

### 7. Get Labels

```bash
GET /labels
```

**Response:**
```json
{
  "incident_types": ["Fire", "Crime", "Accident", "Medical", "Natural Disaster", "Other"],
  "severities": ["Green", "Yellow", "Red", "Black"]
}
```

---

## Testing

### Quick Start Tests

#### Test 1: Health Check
```bash
curl http://localhost:8000/health
```

#### Test 2: Text Classification
```bash
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"text":"May fire sa bahay!"}'
```

#### Test 3: Create Test Audio

```bash
# Install audio generation tools (if not already installed)
pip install scipy

# Python script to generate test audio
python3 << 'EOF'
import numpy as np
from scipy.io import wavfile

# Create 45-second emergency-like audio
duration = 45
sr = 16000
t = np.linspace(0, duration, sr * duration)

# Simulate speech with tone + noise
tone = 0.3 * np.sin(2 * np.pi * 150 * t)
noise = 0.1 * np.random.normal(0, 1, len(t))
audio = tone + noise

# Normalize
audio = audio / (np.max(np.abs(audio)) + 1e-8) * 0.8

# Save
wavfile.write('emergency_test.wav', sr, (audio * 32767).astype(np.int16))
print("✓ Test audio created: emergency_test.wav")
EOF
```

#### Test 4: Transcribe Audio
```bash
curl -X POST http://localhost:8000/v1/transcribe \
  -F "file=@emergency_test.wav"
```

#### Test 5: Full Audio Classification (File)
```bash
curl -X POST http://localhost:8000/v1/classify-audio \
  -F "file=@emergency_test.wav"
```

#### Test 6: 🆕 Microphone Recording + Auto-Classification
**This is the all-in-one endpoint - records, transcribes, and classifies in one call**

```bash
# 30-second recording with auto-classification (shows real-time feedback)
curl -X POST http://localhost:8000/v1/classify-mic \
  -H "Content-Type: application/json" \
  -d '{"duration_seconds":30,"sample_rate":16000,"threshold":0.3}'
```

**What happens:**
1. 🎤 Starts recording from microphone (shows progress bar)
2. ✅ After 30s, saves audio and begins transcription
3. 📝 Transcribes audio to text via Whisper API
4. 🚨 Automatically classifies the transcription
5. 📊 Returns formatted results with confidence scores

**Expected Output:**
```
======================================================================
🎤 MICROPHONE RECORDING STARTED
======================================================================
Duration: 30 seconds
Sample Rate: 16000 Hz
Channels: 1 (Mono)
Status: Recording in progress...
======================================================================
  Recording: [██████████████░░░░░░░░░░░░░░░░░░] 15.0s / 30s

✅ Recording complete: 30s captured

📝 Transcribing audio from microphone...

✅ Transcription complete
   Text: There is a fire at my house
   Latency: 3.40s
   Duration: 30.00s

🚨 Classifying emergency incident...

✅ Classification complete

======================================================================
CLASSIFICATION RESULTS
======================================================================

📋 Original Message:
   There is a fire at my house

🚨 Incident Types: Fire
🔴 Immediate Severity Level

📊 Confidence Scores:
  Fire..................... 98.12% ████████████████████
  Crime.................... 2.34% 
  Accident................. 14.56% ██
```

#### Test 7: Check Monitoring Stats
```bash
curl http://localhost:8000/v1/audio/stats
```

---

### Interactive Testing Notebook

```bash
# Open the testing notebook
jupyter notebook AudioPipelineTest.ipynb
```

**Notebook sections:**
1. **Monitoring** - Track API calls, latency, confidence
2. **Validation** - Test audio constraints
3. **Fallback Handling** - Test error scenarios
4. **Edge Cases** - Noisy/silent/mixed-language audio

---

### Test with Postman/Thunder Client

**Import this collection:**

```json
{
  "collection": "RescueLink Audio API",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:8000/health"
    },
    {
      "name": "Transcribe Audio",
      "method": "POST",
      "url": "http://localhost:8000/v1/transcribe",
      "body": "form-data",
      "file": "emergency_test.wav"
    },
    {
      "name": "Classify Audio",
      "method": "POST",
      "url": "http://localhost:8000/v1/classify-audio",
      "body": "form-data",
      "file": "emergency_test.wav"
    },
    {
      "name": "Get Stats",
      "method": "GET",
      "url": "http://localhost:8000/v1/audio/stats"
    }
  ]
}
```

---

## Monitoring

### Usage Statistics Dashboard

```bash
# Get current stats
curl http://localhost:8000/v1/audio/stats | python -m json.tool
```

**Metrics tracked:**
- **Total Requests**: All API calls
- **Success Rate**: % successful vs failed
- **Average Latency**: Time from request to response
- **Total Audio Duration**: Sum of all processed audio
- **Low Confidence Count**: Predictions below 0.7 confidence

### Real-Time Monitoring

The `AudioPipelineTest.ipynb` notebook includes a `MonitoringTracker` class that:
- Logs every API call with latency & confidence
- Generates metrics summary & visualization
- Exports call history to JSON for external monitoring systems

### Alert Thresholds

⚠️ **Alerts trigger when:**
- **Confidence < 0.7** - Low confidence prediction
- **Latency > 60s** - Slow transcription (HF API timeout)
- **Success Rate < 80%** - High error rate
- **Failed Calls > 5/hour** - Service degradation

### Integration with External Monitoring

**Example: Send metrics to monitoring service**
```python
import requests

stats = requests.get("http://localhost:8000/v1/audio/stats").json()

# Push to Prometheus, DataDog, or custom service
requests.post(
    "https://monitoring.example.com/metrics",
    json={
        "service": "rescuelink-audio",
        "success_rate": stats["success_rate"],
        "avg_latency": stats["avg_latency_seconds"]
    }
)
```

---

## Error Handling & Resolution

### Classification Errors (All Resolved)

| Error | Status | Resolution | Details |
|-------|--------|-----------|----------|
| **HTTP 410 Gone** | ✅ Resolved | Migrated to InferenceClient SDK | Raw HTTP requests to HF API deprecated; now using official Python SDK |
| **Content-Type None** | ✅ Resolved | Changed to string path parameter | InferenceClient auto-detects file type from extension |
| **BufferedReader Rejection** | ✅ Resolved | Pass file path string, not object | `client.automatic_speech_recognition(audio=str(path))` |
| **Missing Human Verification** | ✅ Resolved | Added `message` field to responses | All endpoints now return original input for operator review |
| **Suboptimal Threshold** | ✅ Resolved | Updated default 0.5 → 0.3 | Better recall for emergency detection; still high precision |

### Technical Changes Made

**Audio Pipeline Improvements:**
- ✅ Integrated HuggingFace InferenceClient SDK (stable, maintained)
- ✅ Fixed audio file handling (path string vs bytes/file object)
- ✅ Enabled microphone recording with 15-60s duration validation
- ✅ Added original message to all API responses
- ✅ Optimized classification threshold for emergency scenarios

**Code Changes:**
- `audio/whisper_handler.py` - InferenceClient integration
- `api/main.py` - Human verification + threshold adjustment
- `models/label_meta.json` - Updated default threshold (0.5 → 0.3)
- `inference/predict.py` - Threshold defaults aligned

**Testing Artifacts:**
- `AudioPipelineTest.ipynb` - Full pipeline validation
- All integration tests passing (3/3 ✅)

---

## Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'dotenv'`

**Solution:**
```bash
pip install python-dotenv
```

---

### Issue: `HF_API_TOKEN not set in environment`

**Solution:**
1. Verify `.env` file exists in `RescueLink AI/` directory
2. Check `.env` contains: `HF_API_TOKEN=hf_...`
3. Restart API server: `Ctrl+C` then `uvicorn api.main:app --reload`

---

### Issue: `Error 401: Invalid HF API Token`

**Solution:**
1. Go to https://huggingface.co/settings/tokens
2. Regenerate your access token
3. Update `.env` with new token
4. Restart server

---

### Issue: `Audio too short: 15.2s (min: 30s)`

**Solution:**
- Provide audio at least 30 seconds long
- Or modify `MIN_AUDIO_DURATION_SECONDS` in `.env` (not recommended)

---

### Issue: `HF API error 429: Rate Limited`

**Solution:**
- Free tier has ~100 requests/day
- Upgrade to paid tier ($9/month): https://huggingface.co/pricing
- Or wait for rate limit to reset (24 hours)

---

### Issue: `Error 503: Service Unavailable`

**Solution:**
- HF Whisper API is temporarily down
- **Fallback**: Use text-only `/classify` endpoint with manual transcription
- Check HF status: https://status.huggingface.co

---

### Issue: Low Confidence Predictions

**Solution:**
1. Check audio quality (SNR, background noise)
2. Ensure audio is emergency-related content
3. Adjust threshold based on requirements:
   - **threshold=0.2** → More sensitive, catches edge cases
   - **threshold=0.3** → Default, optimized for emergency response
   - **threshold=0.5** → Balanced precision/recall
   - **threshold=0.7+** → Stricter, fewer false positives
4. Review `low_confidence_flag` in response
5. Check original message in response for verification

---

### Issue: CORS Errors in Frontend

**Solution:**
The API has CORS enabled for all origins (`allow_origins=["*"]`). If still failing:
```python
# In api/main.py, line ~26-31
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],  # Set to specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Cloud Deployment

### Local Testing → Production Pipeline

**This implementation uses HF Inference API for testing. For production cloud deployment:**

1. **Containerize with Docker** (included in structure)
2. **Deploy to Cloud** (AWS ECS, GCP Cloud Run, Azure ACI, K8s)
3. **Run Whisper locally** (instead of HF API) for cost savings
4. **Scale horizontally** with load balancing
5. **Add authentication** (API keys, OAuth2)
6. **Enable HTTPS** (TLS/SSL)
7. **Monitor with APM** (DataDog, New Relic, etc.)

### Recommended Cloud Platforms

| Platform | Cost | Setup Time | Scale | Best For |
|----------|------|-----------|-------|----------|
| **AWS ECS** | $0.20/hr + compute | 30 min | Excellent | Production, high traffic |
| **GCP Cloud Run** | $0.00024/request | 10 min | Good | Bursty traffic |
| **Azure Container Instances** | $0.0000247/sec | 15 min | Good | MS ecosystem |
| **Kubernetes** | ~$100/mo cluster | 1 hour | Excellent | Multi-service, complex |

### Next Steps for Deployment

1. Create `Dockerfile` for containerization
2. Create `docker-compose.yml` for local multi-container testing
3. Set up CI/CD (GitHub Actions, GitLab CI)
4. Configure secrets management (AWS Secrets Manager, etc.)
5. Add API authentication (FastAPI Security, JWT)
6. Enable rate limiting (Slowapi, Redis)
7. Add request logging (ELK Stack, Splunk)

---

## Project Structure

```
RescueLink AI/
├── api/
│   └── main.py                    # FastAPI server (v2.1.0)
├── audio/
│   ├── __init__.py
│   └── whisper_handler.py         # HF Whisper integration
├── models/
│   ├── emergency_classifier.py    # XLM-RoBERTa model
│   ├── emergency_model.pt         # Trained weights (~550MB)
│   └── label_meta.json            # Config & labels
├── training/
│   ├── train.py                   # Training pipeline
│   └── __init__.py
├── data/
│   ├── emergency_dataset.csv      # 15k synthetic rows
│   └── [other datasets]
├── inference/
│   ├── predict.py                 # Standalone inference
│   └── __init__.py
├── RescueLinkAi.ipynb             # Training notebook
├── AudioPipelineTest.ipynb        # Testing & operations
├── requirements.txt               # Python dependencies
├── .env.example                   # Config template
├── README.md                       # This file
└── [other files]
```

---

## Performance Metrics

### Benchmark Results (RTX 4050 Laptop)

| Component | Model | Latency | Device |
|-----------|-------|---------|--------|
| **Text Classification** | XLM-RoBERTa | ~200ms | GPU (batch=1) |
| **Transcription** | Whisper Large V3 Turbo | ~3-5s | HF API (cloud) |
| **Total Pipeline** | Whisper + Classifier | ~3.5-5.2s | Mixed |

### Model Accuracy (Validation Set)

| Metric | Score |
|--------|-------|
| Incident Type F1 | 99.43% |
| Severity Accuracy | 100% |
| Hamming Loss | 0.24% |

---

## License & Attribution

- **RescueLink AI**: Custom implementation
- **XLM-RoBERTa**: Meta AI Research ([License](https://huggingface.co/xlm-roberta-base))
- **Whisper**: OpenAI ([License](https://github.com/openai/whisper))
- **FastAPI**: Sebastián Ramírez ([License](https://github.com/tiangolo/fastapi))

---

## Support & Contributing

For issues, questions, or contributions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review error messages in server logs
3. Test with `AudioPipelineTest.ipynb`
4. Check HF API status: https://status.huggingface.co

---

## Quick Reference

```bash
# Setup
pip install -r requirements.txt
cp .env.example .env
# [Edit .env and add HF_API_TOKEN]

# Run
uvicorn api.main:app --reload --port 8000

# Test
curl http://localhost:8000/health

# Text classification (with optimized 0.3 threshold)
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"text":"Fire at the mall","threshold":0.3}'

# Audio classification
curl -X POST http://localhost:8000/v1/classify-audio \
  -F "file=@audio.wav" \
  -F "threshold=0.3"

# Check stats
curl http://localhost:8000/v1/audio/stats

# Monitor
jupyter notebook AudioPipelineTest.ipynb
```

---

## Changelog

### v2.1.1 (Jan 27, 2026)
- ✅ Added human verification message to all responses
- ✅ Optimized classification threshold (0.5 → 0.3)
- ✅ Enhanced notebook display with formatted output
- ✅ Updated documentation with error resolution
- ✅ Tested end-to-end audio pipeline

### v2.1.0 (Jan 27, 2026)
- ✅ HuggingFace InferenceClient integration
- ✅ Audio transcription via Whisper API
- ✅ Full audio→classification pipeline
- ✅ Microphone recording support

---

**Last Updated**: January 27, 2026  
**Maintained by**: RescueLink Development Team
