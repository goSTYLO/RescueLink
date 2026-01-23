import json
import os
import torch
from transformers import AutoTokenizer
from models.emergency_classifier import EmergencyClassifier

CKPT_PATH = "models/emergency_model.pt"
META_PATH = "models/label_meta.json"


def load_metadata():
    if os.path.exists(META_PATH):
        with open(META_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    checkpoint = torch.load(CKPT_PATH, map_location="cpu")
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        return {
            "incident_type_labels": checkpoint.get("incident_type_labels"),
            "severity_labels": checkpoint.get("severity_labels"),
            "backbone": checkpoint.get("backbone", "xlm-roberta-base"),
            "threshold": checkpoint.get("threshold", 0.5),
        }

    raise ValueError("Metadata not found. Train the model to generate label_meta.json and checkpoint with metadata.")


def load_model_and_tokenizer():
    meta = load_metadata()
    checkpoint = torch.load(CKPT_PATH, map_location="cpu")

    tokenizer = AutoTokenizer.from_pretrained(meta.get("backbone", "xlm-roberta-base"))

    model = EmergencyClassifier(
        num_incident_types=len(meta["incident_type_labels"]),
        num_severity_classes=len(meta["severity_labels"]),
        backbone=meta.get("backbone", "xlm-roberta-base"),
    )

    state_dict = checkpoint.get("model_state_dict") if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint else checkpoint
    model.load_state_dict(state_dict)
    model.eval()

    return model, tokenizer, meta


model, tokenizer, meta = load_model_and_tokenizer()


def classify(text):
    tokens = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128,
    )

    with torch.no_grad():
        outputs = model(tokens["input_ids"], tokens["attention_mask"])
        type_probs = torch.sigmoid(outputs["type_logits"]).squeeze(0)
        severity_probs = torch.softmax(outputs["severity_logits"], dim=1).squeeze(0)

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

    severity_prediction = meta["severity_labels"][int(severity_probs.argmax().item())]

    return {
        "incident_types": incident_predictions,
        "severity": severity_prediction,
    }


if __name__ == "__main__":
    print(classify("There is a fire and people are trapped inside"))
