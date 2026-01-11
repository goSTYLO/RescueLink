import torch
from transformers import DistilBertTokenizerFast
from models.emergency_classifier import EmergencyClassifier

tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

model = EmergencyClassifier()
model.load_state_dict(torch.load("models/emergency_model.pt"))
model.eval()

def classify(text):
    tokens = tokenizer(text, return_tensors="pt")
    outputs = model(**tokens)

    return {
        "incident_type": outputs["type_logits"].argmax(dim=1).item(),
        "severity": outputs["severity_logits"].argmax(dim=1).item()
    }

print(classify("There is a fire and people are trapped inside"))
