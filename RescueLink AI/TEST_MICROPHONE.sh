#!/bin/bash

# RescueLink AI - Microphone Testing Commands
# Version: 2.1.1
# Use these commands to test the microphone recording and auto-classification features

echo "=================================================="
echo "RescueLink AI - Microphone Testing"
echo "=================================================="
echo ""

# Make sure the API is running
echo "Checking if API is running..."
curl -s http://localhost:8000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ API is running on http://localhost:8000"
else
    echo "❌ API is not running. Start it with:"
    echo "   uvicorn api.main:app --reload --port 8000"
    exit 1
fi

echo ""
echo "=================================================="
echo "TEST 1: Health Check"
echo "=================================================="
echo ""
curl http://localhost:8000/health | python -m json.tool
echo ""

echo "=================================================="
echo "TEST 2: Transcribe from Microphone (15 seconds)"
echo "=================================================="
echo ""
echo "🎤 Starting 15-second microphone recording..."
echo "Speak into your microphone now!"
echo ""
curl -X POST http://localhost:8000/v1/transcribe-mic \
  -H "Content-Type: application/json" \
  -d '{"duration_seconds":15,"sample_rate":16000}' | python -m json.tool
echo ""

echo "=================================================="
echo "TEST 3: Record + Auto-Classify (20 seconds)"
echo "=================================================="
echo ""
echo "🎤 Starting 20-second microphone recording..."
echo "Describe an emergency situation!"
echo ""
curl -X POST http://localhost:8000/v1/classify-mic \
  -H "Content-Type: application/json" \
  -d '{"duration_seconds":20,"sample_rate":16000,"threshold":0.3}' | python -m json.tool
echo ""

echo "=================================================="
echo "TEST 4: Check API Statistics"
echo "=================================================="
echo ""
curl http://localhost:8000/v1/audio/stats | python -m json.tool
echo ""

echo "=================================================="
echo "✅ Testing complete!"
echo "=================================================="
