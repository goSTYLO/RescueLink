#!/usr/bin/env python3
"""
Smoke tests for Whisper STT provider integration.

Validates local-first Faster-Whisper configuration with optional
HF API fallback availability.
"""

import os
import sys
import json
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_provider_dependencies():
    """Test optional provider dependencies are importable."""
    print("=" * 70)
    print("TEST 1: Provider Dependency Imports")
    print("=" * 70)
    
    try:
        from faster_whisper import WhisperModel
        print("✓ faster-whisper imported successfully")

        from huggingface_hub import InferenceClient
        print("✓ InferenceClient imported successfully")

        # Avoid unused import warning in some linters
        _ = WhisperModel
        _ = InferenceClient
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_whisper_handler_local_mode():
    """Test WhisperHandler initialization in local mode."""
    print("\n" + "=" * 70)
    print("TEST 2: WhisperHandler Local-Mode Initialization")
    print("=" * 70)
    
    try:
        from audio.whisper_handler import WhisperHandler
        print("✓ WhisperHandler imported successfully")

        os.environ["STT_PROVIDER"] = "local"
        os.environ["STT_ENABLE_API_FALLBACK"] = "false"

        handler = WhisperHandler(
            hf_api_token=os.getenv("HF_API_TOKEN"),
            model_id=os.getenv("WHISPER_MODEL_ID", "openai/whisper-large-v3-turbo"),
            min_duration=15,
            max_duration=60,
        )
        print("✓ WhisperHandler instantiated")
        print(f"  - Provider mode: {handler.provider_mode}")
        print(f"  - Local provider ready: {handler.local_provider is not None}")
        print(f"  - API provider ready: {handler.api_provider is not None}")
        print(f"  - Min duration: {handler.min_duration}s")
        print(f"  - Max duration: {handler.max_duration}s")
        print(f"  - Fallback enabled: {handler.enable_api_fallback}")
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_fastapi_imports():
    """Test FastAPI server can import everything"""
    print("\n" + "=" * 70)
    print("TEST 3: FastAPI Server Imports")
    print("=" * 70)
    
    try:
        # Test critical imports for api/main.py
        from fastapi import FastAPI
        print("✓ FastAPI imported")
        
        from transformers import AutoTokenizer
        print("✓ AutoTokenizer imported")
        
        from models.emergency_classifier import EmergencyClassifier
        print("✓ EmergencyClassifier imported")
        
        from audio.whisper_handler import get_whisper_handler
        print("✓ get_whisper_handler imported")
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n")
    print("╔════════════════════════════════════════════════════════════════════╗")
    print("║  RESCUELINK AI - LOCAL QUANTIZED STT INTEGRATION TEST              ║")
    print("╚════════════════════════════════════════════════════════════════════╝")
    
    results = []
    
    results.append(("Provider Dependencies", test_provider_dependencies()))
    results.append(("WhisperHandler Local Mode", test_whisper_handler_local_mode()))
    results.append(("FastAPI Imports", test_fastapi_imports()))
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        symbol = "✓" if result else "✗"
        print(f"{symbol} {test_name:.<50} {status}")
    
    print("=" * 70)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\nAll systems ready! You can now run the FastAPI server:")
        print("  cd 'RescueLink AI'")
        print("  uvicorn api.main:app --reload")
        return True
    else:
        print("\nSome tests failed. Please fix the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
