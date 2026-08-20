# 🎤 Microphone Auto-Classification Testing Guide

## Version: 2.1.1
## Last Updated: January 27, 2026

---

## Overview

The new `/v1/classify-mic` endpoint provides **all-in-one microphone testing** with:
- 🎤 Real-time recording progress feedback
- 📝 Automatic transcription via Whisper API
- 🚨 Automatic emergency classification
- 📊 Formatted results with confidence scores
- ⚠️ Low confidence alerts

---

## Quick Start (30 seconds)

### Option 1: PowerShell (Windows - Recommended)

```powershell
cd "c:\Users\Aaron\GitHub Repos\RescueLink\RescueLink AI"
powershell -ExecutionPolicy Bypass -File TEST_MICROPHONE.ps1
```

### Option 2: Manual curl command

```bash
# Record for 30 seconds and auto-classify
curl -X POST http://localhost:8000/v1/classify-mic \
  -H "Content-Type: application/json" \
  -d '{"duration_seconds":30,"sample_rate":16000,"threshold":0.3}'
```

---

## Endpoint Details

### `/v1/classify-mic` - Microphone Record + Auto-Classify

**Method:** `POST`

**Request:**
```json
{
  "duration_seconds": 30,
  "sample_rate": 16000,
  "threshold": 0.3
}
```

**Parameters:**
| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `duration_seconds` | int | 45 | 15-60 | Recording duration in seconds |
| `sample_rate` | int | 16000 | 16000-48000 | Audio sample rate (Hz) |
| `threshold` | float | 0.3 | 0.1-0.9 | Classification confidence threshold |

**Response:**
```json
{
  "transcription": "There is a fire at my house",
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

---

## What Happens at Each Step

### Step 1: 🎤 Recording (Shows Progress)
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
```

### Step 2: 📝 Transcription (Auto via Whisper API)
```
📝 Transcribing audio from microphone...

✅ Transcription complete
   Text: There is a fire at my house
   Latency: 3.40s
   Duration: 30.00s
```

### Step 3: 🚨 Classification (Auto with Confidence Scores)
```
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

## Testing Scenarios

### Scenario 1: Fire Emergency
**What to say:** "There's a fire in my house, it's spreading quickly!"

**Expected Result:**
- Incident Type: Fire
- Severity: Red (🔴 Immediate)
- Fire Confidence: >95%

### Scenario 2: Traffic Accident
**What to say:** "There's been a bad car accident on EDSA highway"

**Expected Result:**
- Incident Type: Accident
- Severity: Red (🔴 Immediate)
- Accident Confidence: >90%

### Scenario 3: Medical Emergency
**What to say:** "My mother is having a heart attack, please send help immediately"

**Expected Result:**
- Incident Type: Medical
- Severity: Red (🔴 Immediate)
- Medical Confidence: >85%

### Scenario 4: Crime Report
**What to say:** "There's a robbery happening at the convenience store"

**Expected Result:**
- Incident Type: Crime
- Severity: Red (🔴 Immediate)
- Crime Confidence: >88%

---

## Threshold Values

The threshold determines which incident types are included in the response:

| Threshold | Use Case | Effect |
|-----------|----------|--------|
| **0.2** | Catch everything | May get false positives |
| **0.3** | Default (Recommended) | Good balance for emergency response |
| **0.5** | Balanced | Medium precision/recall |
| **0.7** | Strict | Only high-confidence predictions |

**How it works:**
```
incident_types = [
    type for type, confidence in scores.items() 
    if confidence >= threshold
]
```

---

## Troubleshooting

### Issue: "Microphone recording not available"
**Solution:**
- Verify `sounddevice` is installed: `pip install sounddevice soundfile`
- Check microphone is connected and working
- Restart the API server

### Issue: "No speech detected"
**Solution:**
- Speak louder into the microphone
- Reduce background noise
- Check microphone level in system settings
- Get closer to the microphone

### Issue: "Low confidence flag: true"
**Solution:**
- Speak more clearly
- Reduce background noise
- Use a better quality microphone
- Lower the threshold to 0.2 to catch edge cases

### Issue: "Transcription failed"
**Solution:**
- Check HuggingFace API is working: https://status.huggingface.co
- Verify HF_API_TOKEN in .env is valid
- Wait a few seconds and retry
- Use the text-only endpoint `/classify` as fallback

### Issue: "Recording takes too long"
**Solution:**
- This is normal - HF Whisper API takes 3-5 seconds for 30s audio
- Longer audio = longer transcription time
- Use shorter duration (15-20s) for faster feedback

---

## Comparing Endpoints

| Feature | `/v1/transcribe-mic` | `/v1/classify-mic` |
|---------|---------------------|-------------------|
| **Recording** | ✅ Records microphone | ✅ Records microphone |
| **Transcription** | ✅ Returns text only | ✅ + Transcribes |
| **Classification** | ❌ No | ✅ Auto-classifies |
| **Feedback** | ✅ Shows progress | ✅ + Shows all steps |
| **Use Case** | Testing transcription only | Full emergency testing |
| **Response Time** | ~5-10s | ~8-15s (includes classification) |

---

## API Monitoring

Check how many requests have been made:

```bash
curl http://localhost:8000/v1/audio/stats | python -m json.tool
```

Response:
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

Reset stats (admin):
```bash
curl http://localhost:8000/v1/audio/stats/reset
```

---

## Common Phrases to Test

**Emergency Phrases (English):**
- "There's a fire in my house"
- "There's been an accident on the highway"
- "Someone is injured, please send medical help"
- "There's a robbery happening right now"
- "There's a flood in the area"

**Emergency Phrases (Filipino):**
- "May fire sa bahay namin!"
- "May aksidente sa kalsada"
- "May tao na napalitaw, kailangan ng doctor"
- "May robbery sa store"
- "May baha na paparating"

---

## Performance Notes

- **Recording latency:** <100ms (instant)
- **Transcription latency:** 3-5s (depends on HF API load)
- **Classification latency:** ~200ms (on GPU)
- **Total latency:** 5-8 seconds end-to-end

---

## Next Steps

1. ✅ Test with the PowerShell script
2. ✅ Try different emergency scenarios
3. ✅ Adjust threshold if needed
4. ✅ Check statistics with `/v1/audio/stats`
5. ✅ Deploy to production when satisfied

---

## Support

- **Issues?** Check the README.md Troubleshooting section
- **Questions?** See the Error Handling & Resolution section in README.md
- **Logs?** Check the API server console for detailed error messages
