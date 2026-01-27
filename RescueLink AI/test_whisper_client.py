#!/usr/bin/env python3
"""
Test script to verify InferenceClient integration with Whisper
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

def test_inference_client():
    """Test InferenceClient import and initialization"""
    print("=" * 70)
    print("TEST 1: InferenceClient Import and Initialization")
    print("=" * 70)
    
    try:
        from huggingface_hub import InferenceClient
        print("✓ InferenceClient imported successfully")
        
        # Check HF token
        hf_token = os.getenv("HF_API_TOKEN")
        if not hf_token:
            print("✗ HF_API_TOKEN not found in .env")
            return False
        
        print(f"✓ HF_API_TOKEN found (length: {len(hf_token)})")
        
        # Initialize client
        client = InferenceClient(token=hf_token)
        print("✓ InferenceClient initialized with token")
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_whisper_handler():
    """Test WhisperHandler with new InferenceClient"""
    print("\n" + "=" * 70)
    print("TEST 2: WhisperHandler Module Loading")
    print("=" * 70)
    
    try:
        from audio.whisper_handler import WhisperHandler, get_whisper_handler
        print("✓ WhisperHandler imported successfully")
        
        # Test initialization
        hf_token = os.getenv("HF_API_TOKEN")
        handler = WhisperHandler(
            hf_api_token=hf_token,
            model_id="openai/whisper-large-v3-turbo",
            min_duration=15,
            max_duration=60,
        )
        print("✓ WhisperHandler instantiated")
        print(f"  - Model: {handler.model_id}")
        print(f"  - Min duration: {handler.min_duration}s")
        print(f"  - Max duration: {handler.max_duration}s")
        print(f"  - Client type: {type(handler.client).__name__}")
        
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
    print("║  RESCUELINK AI - WHISPER + INFERENCECLIENT INTEGRATION TEST        ║")
    print("╚════════════════════════════════════════════════════════════════════╝")
    
    results = []
    
    results.append(("InferenceClient Setup", test_inference_client()))
    results.append(("WhisperHandler Module", test_whisper_handler()))
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
