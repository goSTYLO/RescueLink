import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class TrainConfig:
    dataset_path: str = "data/emergency_dataset.csv"
    output_dir: str = "models"
    backbone: str = "xlm-roberta-base"
    max_length: int = 128
    train_split: float = 0.8
    max_samples: int = 0
    batch_size_gpu: int = 32
    batch_size_cpu: int = 8
    epochs: int = 10
    patience: int = 3
    learning_rate: float = 5e-5
    weight_decay: float = 0.01
    dropout: float = 0.3
    label_smoothing: float = 0.1
    type_loss_weight: float = 1.0
    severity_loss_weight: float = 1.0
    scheduler: str = "step"
    step_size: int = 2
    gamma: float = 0.5
    threshold_min: float = 0.2
    threshold_max: float = 0.7
    threshold_step: float = 0.05
    seed_list: str = "42,52,62"

    def seeds(self):
        return [int(x.strip()) for x in self.seed_list.split(",") if x.strip()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train emergency classifier")
    parser.add_argument("--config", type=str, default="", help="Optional JSON config path")
    parser.add_argument("--dataset-path", type=str, default="")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--learning-rate", type=float, default=None)
    parser.add_argument("--scheduler", type=str, default="", choices=["", "none", "step", "cosine"])
    parser.add_argument("--seed-list", type=str, default="")
    parser.add_argument("--max-samples", type=int, default=None)
    return parser.parse_args()


def load_config() -> TrainConfig:
    args = parse_args()
    cfg = TrainConfig()

    if args.config:
        config_path = Path(args.config)
        with config_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        for key, value in payload.items():
            if hasattr(cfg, key):
                setattr(cfg, key, value)

    if args.dataset_path:
        cfg.dataset_path = args.dataset_path
    if args.epochs is not None:
        cfg.epochs = args.epochs
    if args.learning_rate is not None:
        cfg.learning_rate = args.learning_rate
    if args.scheduler:
        cfg.scheduler = args.scheduler
    if args.seed_list:
        cfg.seed_list = args.seed_list
    if args.max_samples is not None:
        cfg.max_samples = args.max_samples

    return cfg


def dump_config(path: str, config: TrainConfig) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(asdict(config), f, ensure_ascii=True, indent=2)
