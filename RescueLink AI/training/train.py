import ast
import copy
import json
import os
import random
import sys
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, f1_score, hamming_loss
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from models.emergency_classifier import EmergencyClassifier
from training.config import dump_config, load_config

# -----------------------------
# Dataset
# -----------------------------
class EmergencyDataset(Dataset):
    def __init__(self, encodings, type_labels, severity_labels, num_types):
        self.encodings = encodings
        self.type_labels = type_labels
        self.severity_labels = severity_labels
        self.num_types = num_types

    def __getitem__(self, idx):
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}

        type_vector = torch.zeros(self.num_types)
        for label in self.type_labels[idx]:
            type_vector[label] = 1.0

        item["type_labels"] = type_vector
        item["severity_labels"] = torch.tensor(self.severity_labels[idx])

        return item

    def __len__(self):
        return len(self.severity_labels)

def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def make_scheduler(optimizer, cfg):
    if cfg.scheduler == "step":
        return torch.optim.lr_scheduler.StepLR(optimizer, step_size=cfg.step_size, gamma=cfg.gamma)
    if cfg.scheduler == "cosine":
        return torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, cfg.epochs))
    return None


def evaluate(model, dataloader, device, threshold):
    model.eval()
    all_type_probs = []
    all_type_true = []
    all_severity_pred = []
    all_severity_true = []

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            type_labels = batch["type_labels"].to(device)
            severity_labels = batch["severity_labels"].to(device)

            outputs = model(input_ids, attention_mask)
            type_probs = torch.sigmoid(outputs["type_logits"])
            severity_pred = torch.argmax(outputs["severity_logits"], dim=1)

            all_type_probs.append(type_probs.cpu().numpy())
            all_type_true.append(type_labels.cpu().numpy())
            all_severity_pred.append(severity_pred.cpu().numpy())
            all_severity_true.append(severity_labels.cpu().numpy())

    y_type_probs = np.vstack(all_type_probs)
    y_type_true = np.vstack(all_type_true).astype(int)
    y_type_pred = (y_type_probs >= threshold).astype(int)
    y_sev_pred = np.concatenate(all_severity_pred)
    y_sev_true = np.concatenate(all_severity_true)

    return {
        "type_f1_micro": float(f1_score(y_type_true, y_type_pred, average="micro", zero_division=0)),
        "type_hamming_loss": float(hamming_loss(y_type_true, y_type_pred)),
        "severity_accuracy": float(accuracy_score(y_sev_true, y_sev_pred)),
        "y_type_probs": y_type_probs,
        "y_type_true": y_type_true,
    }


def best_threshold_from_probs(y_true, y_probs, t_min, t_max, t_step):
    best = {
        "threshold": 0.5,
        "type_f1_micro": -1.0,
        "type_hamming_loss": 1.0,
    }
    t = t_min
    while t <= (t_max + 1e-9):
        y_pred = (y_probs >= t).astype(int)
        f1 = float(f1_score(y_true, y_pred, average="micro", zero_division=0))
        h = float(hamming_loss(y_true, y_pred))
        if f1 > best["type_f1_micro"] or (f1 == best["type_f1_micro"] and h < best["type_hamming_loss"]):
            best = {
                "threshold": float(round(t, 4)),
                "type_f1_micro": f1,
                "type_hamming_loss": h,
            }
        t += t_step
    return best


def detect_device():
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Using GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        return device
    print("Using CPU (GPU not available)")
    return torch.device("cpu")


def load_df(cfg):
    if not cfg.dataset_path:
        cfg.dataset_path = "data/emergency_dataset.csv"
    df = pd.read_csv(cfg.dataset_path)
    df["incident_types"] = df["incident_types"].apply(ast.literal_eval)
    df["type_labels"] = df["type_labels"].apply(ast.literal_eval)
    if cfg.max_samples and cfg.max_samples > 0 and len(df) > cfg.max_samples:
        df = df.sample(n=cfg.max_samples, random_state=42).reset_index(drop=True)
    return df


def build_label_maps(df):
    incident_idx_to_name = {}
    severity_idx_to_name = {}
    for _, row in df.iterrows():
        for name, idx in zip(row["incident_types"], row["type_labels"]):
            incident_idx_to_name[idx] = name
        severity_idx_to_name[row["severity_label"]] = row["severity"]
    incident_type_labels = [incident_idx_to_name[i] for i in sorted(incident_idx_to_name.keys())]
    severity_labels = [severity_idx_to_name[i] for i in sorted(severity_idx_to_name.keys())]
    return incident_type_labels, severity_labels


def make_dataloaders(df, tokenizer, num_types, batch_size, seed, max_length, split_frac):
    train_df, val_df = train_test_split(
        df,
        train_size=split_frac,
        random_state=seed,
        stratify=df["severity_label"],
    )

    train_enc = tokenizer(
        train_df["text"].tolist(),
        truncation=True,
        padding=True,
        max_length=max_length,
    )
    val_enc = tokenizer(
        val_df["text"].tolist(),
        truncation=True,
        padding=True,
        max_length=max_length,
    )

    train_dataset = EmergencyDataset(
        train_enc,
        train_df["type_labels"].tolist(),
        train_df["severity_label"].tolist(),
        num_types=num_types,
    )
    val_dataset = EmergencyDataset(
        val_enc,
        val_df["type_labels"].tolist(),
        val_df["severity_label"].tolist(),
        num_types=num_types,
    )

    generator = torch.Generator()
    generator.manual_seed(seed)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, generator=generator)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    return train_loader, val_loader


def run_single_seed(cfg, df, incident_type_labels, severity_labels, device, seed):
    set_seed(seed)
    batch_size = cfg.batch_size_gpu if torch.cuda.is_available() else cfg.batch_size_cpu
    tokenizer = AutoTokenizer.from_pretrained(cfg.backbone)

    train_loader, val_loader = make_dataloaders(
        df=df,
        tokenizer=tokenizer,
        num_types=len(incident_type_labels),
        batch_size=batch_size,
        seed=seed,
        max_length=cfg.max_length,
        split_frac=cfg.train_split,
    )

    model = EmergencyClassifier(
        num_incident_types=len(incident_type_labels),
        num_severity_classes=len(severity_labels),
        backbone=cfg.backbone,
    )
    model.dropout = torch.nn.Dropout(cfg.dropout)
    model = model.to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg.learning_rate,
        weight_decay=cfg.weight_decay,
    )
    scheduler = make_scheduler(optimizer, cfg)
    bce_loss = torch.nn.BCEWithLogitsLoss()
    ce_loss_severity = torch.nn.CrossEntropyLoss(label_smoothing=cfg.label_smoothing)

    best_epoch_score = -1.0
    best_state = None
    wait = 0
    fixed_threshold = 0.5

    for epoch in range(cfg.epochs):
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            optimizer.zero_grad()
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            type_labels = batch["type_labels"].to(device)
            severity_labels_batch = batch["severity_labels"].to(device)

            outputs = model(input_ids, attention_mask)
            loss_type = bce_loss(outputs["type_logits"], type_labels)
            loss_sev = ce_loss_severity(outputs["severity_logits"], severity_labels_batch)
            loss = (cfg.type_loss_weight * loss_type) + (cfg.severity_loss_weight * loss_sev)

            loss.backward()
            optimizer.step()
            total_loss += float(loss.item())

        if scheduler is not None:
            scheduler.step()

        val_metrics = evaluate(model, val_loader, device, threshold=fixed_threshold)
        epoch_score = 0.5 * (val_metrics["type_f1_micro"] + val_metrics["severity_accuracy"])

        print(
            f"seed={seed} epoch={epoch+1}/{cfg.epochs} "
            f"loss={total_loss:.4f} "
            f"type_f1@0.5={val_metrics['type_f1_micro']:.4f} "
            f"severity_acc={val_metrics['severity_accuracy']:.4f}"
        )

        if epoch_score > best_epoch_score:
            best_epoch_score = epoch_score
            best_state = copy.deepcopy(model.state_dict())
            wait = 0
        else:
            wait += 1
            if wait >= cfg.patience:
                print(f"seed={seed} early stopping at epoch {epoch+1}")
                break

    model.load_state_dict(best_state)
    final_eval = evaluate(model, val_loader, device, threshold=0.5)
    threshold_pick = best_threshold_from_probs(
        y_true=final_eval["y_type_true"],
        y_probs=final_eval["y_type_probs"],
        t_min=cfg.threshold_min,
        t_max=cfg.threshold_max,
        t_step=cfg.threshold_step,
    )
    final_eval_tuned = evaluate(model, val_loader, device, threshold=threshold_pick["threshold"])

    result = {
        "seed": seed,
        "type_f1_micro": final_eval_tuned["type_f1_micro"],
        "type_hamming_loss": final_eval_tuned["type_hamming_loss"],
        "severity_accuracy": final_eval_tuned["severity_accuracy"],
        "threshold": threshold_pick["threshold"],
        "score": 0.5 * (final_eval_tuned["type_f1_micro"] + final_eval_tuned["severity_accuracy"]),
        "model_state_dict": copy.deepcopy(model.state_dict()),
    }
    return result


def summarize_results(results):
    type_f1 = np.array([r["type_f1_micro"] for r in results], dtype=float)
    sev_acc = np.array([r["severity_accuracy"] for r in results], dtype=float)
    ham = np.array([r["type_hamming_loss"] for r in results], dtype=float)

    return {
        "type_f1_micro_mean": float(np.mean(type_f1)),
        "type_f1_micro_std": float(np.std(type_f1)),
        "severity_accuracy_mean": float(np.mean(sev_acc)),
        "severity_accuracy_std": float(np.std(sev_acc)),
        "type_hamming_loss_mean": float(np.mean(ham)),
        "type_hamming_loss_std": float(np.std(ham)),
    }


def train():
    cfg = load_config()
    os.makedirs(cfg.output_dir, exist_ok=True)
    device = detect_device()

    df = load_df(cfg)
    incident_type_labels, severity_labels = build_label_maps(df)
    seeds = cfg.seeds()
    print(f"Dataset: {cfg.dataset_path}")
    print(f"Seeds: {seeds}")

    run_results = []
    for seed in seeds:
        run_results.append(
            run_single_seed(
                cfg=cfg,
                df=df,
                incident_type_labels=incident_type_labels,
                severity_labels=severity_labels,
                device=device,
                seed=seed,
            )
        )

    summary = summarize_results(run_results)
    best_run = sorted(run_results, key=lambda x: x["score"], reverse=True)[0]

    checkpoint = {
        "model_state_dict": best_run["model_state_dict"],
        "incident_type_labels": incident_type_labels,
        "severity_labels": severity_labels,
        "backbone": cfg.backbone,
        "threshold": best_run["threshold"],
    }
    torch.save(checkpoint, os.path.join(cfg.output_dir, "emergency_model.pt"))

    meta_payload = {
        "incident_type_labels": incident_type_labels,
        "severity_labels": severity_labels,
        "backbone": cfg.backbone,
        "threshold": best_run["threshold"],
    }
    with open(os.path.join(cfg.output_dir, "label_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta_payload, f, ensure_ascii=True, indent=2)

    report_payload = {
        "config": asdict(cfg),
        "runs": [
            {
                "seed": r["seed"],
                "type_f1_micro": r["type_f1_micro"],
                "type_hamming_loss": r["type_hamming_loss"],
                "severity_accuracy": r["severity_accuracy"],
                "threshold": r["threshold"],
                "score": r["score"],
            }
            for r in run_results
        ],
        "summary": summary,
        "selected_seed": best_run["seed"],
        "selected_threshold": best_run["threshold"],
    }

    with open(os.path.join(cfg.output_dir, "training_report.json"), "w", encoding="utf-8") as f:
        json.dump(report_payload, f, ensure_ascii=True, indent=2)

    dump_config(os.path.join(cfg.output_dir, "training_config_used.json"), cfg)

    print("Training complete. Artifacts saved:")
    print(f"- {os.path.join(cfg.output_dir, 'emergency_model.pt')}")
    print(f"- {os.path.join(cfg.output_dir, 'label_meta.json')}")
    print(f"- {os.path.join(cfg.output_dir, 'training_report.json')}")
    print("Aggregate metrics:")
    print(json.dumps(summary, indent=2))

# -----------------------------
# Entry Point
# -----------------------------
if __name__ == "__main__":
    train()