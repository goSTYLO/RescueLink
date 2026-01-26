import torch
import json
import os
import sys
import os
import json
import torch
from pathlib import Path

# Add parent directory to path to import models
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer

from models.emergency_classifier import EmergencyClassifier

# Paths
MODEL_PATH = "../models/emergency_model.pt"
META_PATH = "../models/label_meta.json"

app = FastAPI(
    title="RescueLink Emergency Classification AI",
    description="Microservice for classifying emergency type and severity using XLM-RoBERTa",
    version="2.0.0"
)

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
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
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

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str

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
def classify_emergency(request: EmergencyRequest):
    """Classify emergency report into incident types and severity"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    try:
        # Tokenize
        encoding = tokenizer(
            request.text,
            truncation=True,
            padding=True,
            max_length=128,
            return_tensors="pt"
        )
        
        input_ids = encoding["input_ids"].to(device)
        attention_mask = encoding["attention_mask"].to(device)
        
        # Predict
        with torch.no_grad():
            outputs = model(input_ids, attention_mask)
            
            # Multi-label incident type predictions
            type_probs = torch.sigmoid(outputs["type_logits"]).cpu().numpy()[0]
            predicted_types = [
                meta["incident_type_labels"][i] 
                for i, prob in enumerate(type_probs) 
                if prob >= request.threshold
            ]
            
            # Severity prediction (single-label)
            severity_idx = torch.argmax(outputs["severity_logits"], dim=1).item()
            predicted_severity = meta["severity_labels"][severity_idx]
        
        # Default to "Other" if no types predicted
        if not predicted_types:
            predicted_types = ["Other"]
        
        # Severity color mapping
        severity_colors = {
            "Green": "🟢 Non-urgent",
            "Yellow": "🟡 Delayed",
            "Red": "🔴 Immediate",
            "Black": "⚫ Deceased"
        }
        
        # Confidence scores for all incident types
        confidence_scores = {
            meta["incident_type_labels"][i]: round(float(prob), 4)
            for i, prob in enumerate(type_probs)
        }
        
        return {
            "incident_types": predicted_types,
            "severity": predicted_severity,
            "severity_color": severity_colors.get(predicted_severity, "⚪ Unknown"),
            "confidence_scores": confidence_scores,
            "model_version": "2.0.0-xlm-roberta-filipino"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/labels")
def get_labels():
    """Get all available incident type and severity labels"""
    return {
        "incident_types": meta["incident_type_labels"],
        "severities": meta["severity_labels"]
    }

# ---------- Startup ----------

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("RescueLink AI - Emergency Classifier API")
    print("=" * 60)
    print(f"Model: {meta.get('backbone', 'xlm-roberta-base')}")
    print(f"Incident Types: {meta['incident_type_labels']}")
    print(f"Severities: {meta['severity_labels']}")
    print(f"Device: {device}")
    print(f"Threshold: {meta.get('threshold', 0.5)}")
    print("=" * 60)
