import os
import pandas as pd
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from transformers import DistilBertTokenizerFast
from sklearn.preprocessing import LabelEncoder

from models.emergency_classifier import EmergencyClassifier
from utils.encoders import save_encoders


# -----------------------------
# Dataset
# -----------------------------
class EmergencyDataset(Dataset):
    def __init__(self, encodings, type_labels, severity_labels):
        self.encodings = encodings
        self.type_labels = type_labels
        self.severity_labels = severity_labels

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
        item["labels"] = torch.tensor(
            [self.type_labels[idx], self.severity_labels[idx]],
            dtype=torch.long
        )
        return item

    def __len__(self):
        return len(self.type_labels)


# -----------------------------
# Training Logic
# -----------------------------
def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Ensure folders exist
    os.makedirs("models", exist_ok=True)
    os.makedirs("utils", exist_ok=True)

    # Load data
    df = pd.read_csv("data/emergency_dataset.csv")

    type_encoder = LabelEncoder()
    severity_encoder = LabelEncoder()

    df["type_label"] = type_encoder.fit_transform(df["incident_type"])
    df["severity_label"] = severity_encoder.fit_transform(df["severity"])

    tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")

    encodings = tokenizer(
        df["text"].tolist(),
        truncation=True,
        padding=True,
        max_length=128
    )

    dataset = EmergencyDataset(
        encodings,
        df["type_label"].tolist(),
        df["severity_label"].tolist()
    )

    dataloader = DataLoader(dataset, batch_size=4, shuffle=True)

    model = EmergencyClassifier().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)

    model.train()

    for epoch in range(3):
        total_loss = 0

        for batch in dataloader:
            optimizer.zero_grad()

            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(input_ids, attention_mask)

            loss_type = F.cross_entropy(
                outputs["type_logits"],
                labels[:, 0]
            )

            loss_severity = F.cross_entropy(
                outputs["severity_logits"],
                labels[:, 1]
            )

            loss = loss_type + loss_severity
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch {epoch + 1} complete | Loss: {total_loss:.4f}")

    # Save artifacts
    torch.save(model.state_dict(), "models/emergency_model.pt")
    save_encoders(type_encoder, severity_encoder)

    print("Training complete. Model and encoders saved.")


# -----------------------------
# Entry Point (IMPORTANT)
# -----------------------------
if __name__ == "__main__":
    train()