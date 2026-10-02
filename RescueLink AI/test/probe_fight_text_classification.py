"""Text-only probe: per-label model scores + rank_and_promote for fight vs fire sentences."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import rank_and_promote_incident_types  # noqa: E402

LABELS = [
    "Fire",
    "Crime",
    "Accident",
    "Medical",
    "Natural Disaster",
    "Other",
]
THRESHOLD = 0.5
CKPT_PATH = ROOT / "models" / "emergency_model.pt"
META_PATH = ROOT / "models" / "label_meta.json"

SENTENCES = [
    "May grupo ng tao na nagsusuntukan sa harap ng bahay namin.",
    "May mga taong nag-aaway sa tapat ng bahay ko.",
    "May rambol sa labas ng bahay namin.",
    "There is a group of people fighting in front of my house.",
    "May sunog sa bahay",
    "May nagsusuntukan sa kalsada",
]


def load_classifier():
    import torch
    from transformers import AutoTokenizer

    from models.emergency_classifier import EmergencyClassifier

    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(CKPT_PATH, map_location=device, weights_only=False)
    tokenizer = AutoTokenizer.from_pretrained(meta.get("backbone", "xlm-roberta-base"))
    model = EmergencyClassifier.from_backbone_config(
        num_incident_types=len(meta["incident_type_labels"]),
        num_severity_classes=len(meta["severity_labels"]),
        backbone=meta.get("backbone", "xlm-roberta-base"),
    )
    state_dict = (
        checkpoint.get("model_state_dict")
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
        else checkpoint
    )
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model, tokenizer, meta, device


def score_text(model, tokenizer, meta, device, text: str) -> dict[str, float]:
    import torch

    encoding = tokenizer(
        text,
        truncation=True,
        padding=True,
        max_length=128,
        return_tensors="pt",
    )
    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)
    with torch.no_grad():
        outputs = model(input_ids, attention_mask)
        type_probs = torch.sigmoid(outputs["type_logits"]).cpu().numpy()[0]
    return {
        meta["incident_type_labels"][i]: round(float(prob), 4)
        for i, prob in enumerate(type_probs)
    }


def main():
    if not CKPT_PATH.is_file():
        print(f"SKIP: missing {CKPT_PATH}")
        return
    try:
        model, tokenizer, meta, device = load_classifier()
    except Exception as error:
        print(f"SKIP model load (run in RescueLink AI venv with working torch): {error}")
        return
    labels = meta["incident_type_labels"]
    for text in SENTENCES:
        scores = score_text(model, tokenizer, meta, device, text)
        ranked, promoted, _ = rank_and_promote_incident_types(
            text,
            scores,
            threshold=THRESHOLD,
            incident_labels=labels,
        )
        top = max(scores, key=scores.get)
        print(f"\n{text}")
        print(f"  scores={scores}")
        print(f"  top_model={top} ({scores[top]}) ranked={ranked} keyword_promoted={promoted}")


if __name__ == "__main__":
    main()
