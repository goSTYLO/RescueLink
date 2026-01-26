import ast
import json
import os
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer

from models.emergency_classifier import EmergencyClassifier

# -----------------------------
# Dataset
# -----------------------------
class EmergencyDataset(Dataset):
    def __init__(self, encodings, type_labels, severity_labels, num_types):
        self.encodings = encodings
        self.type_labels = type_labels   # list of lists (multi-label incident types)
        self.severity_labels = severity_labels
        self.num_types = num_types

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}

        # Multi-label incident types → binary vector
        type_vector = torch.zeros(self.num_types)
        for label in self.type_labels[idx]:
            type_vector[label] = 1.0

        # Severity → single integer
        severity_label = torch.tensor(self.severity_labels[idx])

        # Combine into one tensor: [incident multi-labels..., severity]
        item["labels"] = torch.cat([type_vector, severity_label.unsqueeze(0)])

        return item

    def __len__(self):
        return len(self.severity_labels)

# -----------------------------
# Training Logic
# -----------------------------
def train():
    # Detect device
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"✓ Using GPU: {torch.cuda.get_device_name(0)}")
        print(f"  GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    else:
        device = torch.device("cpu")
        print("⚠ Using CPU (GPU not available)")

    # Ensure folders exist
    os.makedirs("models", exist_ok=True)

    # Load data and recover label vocabularies from the CSV
    df = pd.read_csv("data/emergency_dataset.csv")
    df["incident_types"] = df["incident_types"].apply(ast.literal_eval)
    df["type_labels"] = df["type_labels"].apply(ast.literal_eval)

    # Rebuild index→name maps directly from the dataset
    incident_idx_to_name = {}
    severity_idx_to_name = {}
    for _, row in df.iterrows():
        for name, idx in zip(row["incident_types"], row["type_labels"]):
            incident_idx_to_name[idx] = name
        severity_idx_to_name[row["severity_label"]] = row["severity"]

    incident_type_labels = [incident_idx_to_name[i] for i in sorted(incident_idx_to_name.keys())]
    severity_labels = [severity_idx_to_name[i] for i in sorted(severity_idx_to_name.keys())]

    # Tokenizer/backbone must be shared with inference
    backbone_name = "xlm-roberta-base"
    tokenizer = AutoTokenizer.from_pretrained(backbone_name)

    encodings = tokenizer(
        df["text"].tolist(),
        truncation=True,
        padding=True,
        max_length=128
    )

    dataset = EmergencyDataset(
        encodings,
        df["type_labels"].tolist(),   # list of list[int] already parsed
        df["severity_label"].tolist(),
        num_types=len(incident_type_labels)
    )

    # Adaptive batch size: larger for GPU, smaller for CPU
    batch_size = 32 if torch.cuda.is_available() else 8
    print(f"  Batch size: {batch_size}")
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = EmergencyClassifier(
        num_incident_types=len(incident_type_labels),
        num_severity_classes=len(severity_labels),
        backbone=backbone_name,
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)

    # Loss functions
    bce_loss = torch.nn.BCEWithLogitsLoss()
    ce_loss_severity = torch.nn.CrossEntropyLoss(label_smoothing=0.1)

    model.train()

    for epoch in range(3):
        total_loss = 0

        for batch in dataloader:
            optimizer.zero_grad()

            # Move everything to GPU/CPU
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(input_ids, attention_mask)

            # Multi-label incident type loss
            loss_type = bce_loss(outputs["type_logits"], labels[:,0:-1].float())

            # Severity loss with label smoothing
            loss_severity = ce_loss_severity(outputs["severity_logits"], labels[:,-1].long())

            loss = loss_type + loss_severity
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch {epoch + 1} complete | Loss: {total_loss:.4f}")

    # Save artifacts
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "incident_type_labels": incident_type_labels,
        "severity_labels": severity_labels,
        "backbone": backbone_name,
        "threshold": 0.5,
    }
    torch.save(checkpoint, "models/emergency_model.pt")

    meta_path = os.path.join("models", "label_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "incident_type_labels": incident_type_labels,
                "severity_labels": severity_labels,
                "backbone": backbone_name,
                "threshold": 0.5,
            },
            f,
            ensure_ascii=True,
            indent=2,
        )

    print("Training complete. Model and metadata saved.")

# -----------------------------
# Entry Point
# -----------------------------
if __name__ == "__main__":
    train()