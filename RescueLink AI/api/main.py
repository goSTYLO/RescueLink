import torch
import torch.nn.functional as F
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import DistilBertTokenizerFast

from models.emergency_classifier import EmergencyClassifier
from utils.encoders import load_encoders


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

# Load tokenizer and model once
tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

model = EmergencyClassifier()
model.load_state_dict(torch.load("models/emergency_model.pt", map_location="cpu"))
model.eval()

type_encoder, severity_encoder = load_encoders()


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

    with torch.no_grad():
        outputs = model(**tokens)

        # Softmax probabilities
        type_probs = F.softmax(outputs["type_logits"], dim=1)
        severity_probs = F.softmax(outputs["severity_logits"], dim=1)

        type_pred = type_probs.argmax(dim=1).item()
        severity_pred = severity_probs.argmax(dim=1).item()

        type_confidence = type_probs[0][type_pred].item()
        severity_confidence = severity_probs[0][severity_pred].item()

    incident_type = type_encoder.inverse_transform([type_pred])[0]
    severity = severity_encoder.inverse_transform([severity_pred])[0]

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
