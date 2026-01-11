from pathlib import Path
import pickle

BASE_DIR = Path(__file__).resolve().parent

def save_encoders(type_encoder, severity_encoder):
    with open(BASE_DIR / "type_encoder.pkl", "wb") as f:
        pickle.dump(type_encoder, f)

    with open(BASE_DIR / "severity_encoder.pkl", "wb") as f:
        pickle.dump(severity_encoder, f)

def load_encoders():
    with open(BASE_DIR / "type_encoder.pkl", "rb") as f:
        type_encoder = pickle.load(f)

    with open(BASE_DIR / "severity_encoder.pkl", "rb") as f:
        severity_encoder = pickle.load(f)

    return type_encoder, severity_encoder
