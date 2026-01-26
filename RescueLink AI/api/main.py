import json
import os
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer

from models.emergency_classifier import EmergencyClassifier


CRITICAL_SEVERITY_KEYWORDS = [
    "shooting", "gun", "firearm", "shots fired", "active shooter",
    "ongoing shooting", "hostage", "explosion", "bomb",
    "people trapped", "not breathing", "unconscious", "bleeding heavily"
]

SEVERE_SEVERITY_KEYWORDS = [
    "stabbed", "knife", "assault", "injured",
    "serious injury", "collapsed", "chest pain"
]


app = FastAPI(
    title="RescueLink Emergency Classification AI",
    description="Microservice for classifying emergency type and severity",
    version="1.0.0"
)

# Detect device for inference
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"API Server using device: {device}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")

# Load metadata
META_PATH = "models/label_meta.json"
CKPT_PATH = "models/emergency_model.pt"

if not os.path.exists(META_PATH) or not os.path.exists(CKPT_PATH):
    print(f"ERROR: Model files not found!")
    print(f"  - {META_PATH}: {'✓' if os.path.exists(META_PATH) else '✗'}")
    print(f"  - {CKPT_PATH}: {'✓' if os.path.exists(CKPT_PATH) else '✗'}")
    print(f"\nPlease train the model first: python -m training.train")
    raise FileNotFoundError("Model files not found. Train the model first.")

with open(META_PATH, "r", encoding="utf-8") as f:
    meta = json.load(f)

# Load tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(meta.get("backbone", "xlm-roberta-base"))
checkpoint = torch.load(CKPT_PATH, map_location=device)

model = EmergencyClassifier(
    num_incident_types=len(meta["incident_type_labels"]),
    num_severity_classes=len(meta["severity_labels"]),
    backbone=meta.get("backbone", "xlm-roberta-base"),
)
state_dict = checkpoint.get("model_state_dict") if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint else checkpoint
model.load_state_dict(state_dict)
model.to(device)
model.eval()

print(f"✓ Model loaded successfully")
print(f"  Incident types: {meta['incident_type_labels']}")
print(f"  Severity levels: {meta['severity_labels']}")


# ---------- Schemas ----------

class EmergencyRequest(BaseModel):
    text: str

class EmergencyResponse(BaseModel):
    incident_type: str
    severity: str
    confidence: float
    confidence_basis: str


# ---------- Endpoint ----------

@app.post("/classify", response_model=EmergencyResponse)
def classify_emergency(request: EmergencyRequest):
    tokens = tokenizer(
        request.text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )
    
    # Move tokens to device (GPU/CPU)
    input_ids = tokens["input_ids"].to(device)
    attention_mask = tokens["attention_mask"].to(device)

    with torch.no_grad():
        outputs = model(input_ids, attention_mask)

        # Multi-label incident types (sigmoid) and severity (softmax)
        type_probs = torch.sigmoid(outputs["type_logits"]).squeeze(0)
        severity_probs = torch.softmax(outputs["severity_logits"], dim=1).squeeze(0)

    # Get incident predictions above threshold
    threshold = meta.get("threshold", 0.5)
    incident_predictions = [
        meta["incident_type_labels"][idx]
        for idx, prob in enumerate(type_probs.tolist())
        if prob >= threshold
    ]

    # Fallback: if nothing meets threshold, take top-1
    if not incident_predictions:
        top_idx = int(type_probs.argmax().item())
        incident_predictions = [meta["incident_type_labels"][top_idx]]
        type_confidence = type_probs[top_idx].item()
    else:
        # Use max probability from predicted types
        type_confidence = max([type_probs[meta["incident_type_labels"].index(t)].item() for t in incident_predictions])

    severity_idx = int(severity_probs.argmax().item())
    severity = meta["severity_labels"][severity_idx]
    severity_confidence = severity_probs[severity_idx].item()

    # Use primary incident type (first/highest confidence)
    incident_type = incident_predictions[0]

    # ---------- Rule-based severity override ----------
    text_lower = request.text.lower()
    rule_triggered = False

    if any(k in text_lower for k in CRITICAL_SEVERITY_KEYWORDS):
        severity = "Critical"
        rule_triggered = True
    elif any(k in text_lower for k in SEVERE_SEVERITY_KEYWORDS):
        severity = "Severe"
        rule_triggered = True

    # ---------- Confidence computation ----------
    base_confidence = (type_confidence + severity_confidence) / 2

    if rule_triggered:
        final_confidence = min(1.0, base_confidence + 0.3)
        confidence_basis = "rule-based escalation"
    else:
        final_confidence = base_confidence
        confidence_basis = "model prediction"

    return {
        "incident_type": incident_type,
        "severity": severity,
        "confidence": round(final_confidence, 2),
        "confidence_basis": confidence_basis
    }
