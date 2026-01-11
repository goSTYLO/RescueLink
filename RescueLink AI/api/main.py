from fastapi import FastAPI
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizerFast
from models.emergency_classifier import EmergencyClassifier
from utils.encoders import load_encoders

app = FastAPI(
    title="RescueLink Emergency Classification AI",
    description="Microservice for classifying emergency type and severity",
    version="1.0.0"
)

# Load model & tokenizer once (IMPORTANT)
tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

model = EmergencyClassifier()
model.load_state_dict(torch.load("models/emergency_model.pt", map_location="cpu"))
model.eval()

type_encoder, severity_encoder = load_encoders()

# -------- Request & Response Schemas --------

class EmergencyRequest(BaseModel):
    text: str

class EmergencyResponse(BaseModel):
    incident_type: str
    severity: str

# -------- API Endpoint --------

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

    type_pred = outputs["type_logits"].argmax(dim=1).item()
    severity_pred = outputs["severity_logits"].argmax(dim=1).item()

    return {
        "incident_type": type_encoder.inverse_transform([type_pred])[0],
        "severity": severity_encoder.inverse_transform([severity_pred])[0]
    }
