# Content-Type Fix for Audio Transcription

## Issue
When testing microphone recording via `/v1/transcribe-mic`, the HuggingFace Inference API returned an error:

```
Bad request: Content type "None" not supported.
Supported content types are: application/json, audio/wav, audio/mpeg, etc.
```

## Root Cause
In [audio/whisper_handler.py](audio/whisper_handler.py#L133-L140), we were reading the audio file as raw bytes and passing them to the InferenceClient:

```python
# BEFORE (broken):
with open(audio_path, "rb") as f:
    audio_data = f.read()  # Raw bytes, no filename

result = self.client.automatic_speech_recognition(
    audio=audio_data,  # ❌ No content-type information
    model=self.model_id,
)
```

When passing raw bytes, the InferenceClient cannot determine the audio format (WAV, MP3, FLAC, etc.) and sends the request without a proper `Content-Type` header, causing the API to reject it.

## Solution
Pass the **file object** instead of raw bytes, which preserves the filename and allows the InferenceClient to detect the content type from the file extension:

```python
# AFTER (fixed):
with open(audio_path, "rb") as audio_file:
    result = self.client.automatic_speech_recognition(
        audio=audio_file,  # ✅ File object includes filename with .wav extension
        model=self.model_id,
    )
```

The file object includes metadata like the filename (`emergency_audio.wav`), which allows InferenceClient to automatically set the correct `Content-Type: audio/wav` header.

## Implementation
**File Modified:** [audio/whisper_handler.py](audio/whisper_handler.py#L129-L142)

**Changes:**
1. Removed the separate `f.read()` call that extracted raw bytes
2. Kept the file open and passed the file handle directly to `automatic_speech_recognition()`
3. Added comment explaining why we use the file object

## Testing
**Server Status:** ✅ Running on http://127.0.0.1:8000

**Ready to test:**
1. Open [AudioPipelineTest.ipynb](AudioPipelineTest.ipynb)
2. Run cell 13 to record 15 seconds from microphone
3. Audio will be transcribed with proper content-type headers
4. Transcription will be stored in `CLASSIFY_TEXT` variable
5. Run cell 14 to classify the transcription

**Expected Result:**
- ✅ Recording completes successfully (15 seconds)
- ✅ API returns HTTP 200 with transcription
- ✅ No content-type errors
- ✅ Transcription appears in output

## Technical Details

### Why File Objects Work
When you pass a file object to InferenceClient:
1. The file object has a `.name` attribute containing the full path
2. InferenceClient extracts the filename: `emergency_audio.wav`
3. It detects the `.wav` extension
4. It sets the HTTP header: `Content-Type: audio/wav`
5. The HuggingFace API accepts the request

### Alternative Approaches Considered
1. **Pass path string:** InferenceClient expects bytes-like or file-like, not string paths
2. **Manual content-type:** Would require modifying InferenceClient internals
3. **BytesIO with name:** More complex than just using the file handle

The file handle approach is the simplest and most idiomatic solution.

## Status
✅ **Fixed and deployed** - Server running with updated code
🎤 **Ready for testing** - Notebook cells prepared for microphone recording

---
*Fixed: 2026-01-27*
