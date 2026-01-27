# RescueLink AI

RescueLink AI is a text-based emergency classification microservice designed to support **initial emergency triage**.  
It analyzes short emergency descriptions (in **Filipino** or **English**) and returns:

- the **incident type(s)** (multi-label classification)
- the **severity level** (START triage protocol)
- **confidence scores** for all incident categories

This system is intended as **decision support**, not as a replacement for human responders or dispatchers.

---

## Overview

RescueLink AI uses a fine-tuned **XLM-RoBERTa** multilingual model trained on 15,000 high-quality Filipino-prioritized synthetic emergency reports.  
The AI achieves:
- **99.86% F1 score** on incident type classification
- **100% accuracy** on severity classification
- Optimized for **short 1-2 sentence emergency reports** common in Filipino city dispatch

The AI is exposed as a standalone **FastAPI microservice**, allowing it to be integrated cleanly with the main RescueLink backend.

---

## Emergency Categories

### Incident Types (Multi-Label)

The system classifies emergencies into six categories (can predict multiple):

- **Accident** – vehicle collisions, motorcycle crashes, hit-and-runs, road accidents
- **Crime** – shootings, assaults, armed robbery, domestic violence, hostage situations
- **Fire** – house fires, electrical fires, building fires, smoke reports
- **Medical** – collapsed persons, breathing difficulties, chest pain, seizures, heart attacks
- **Natural Disaster** – flooding, earthquakes, landslides, storms, structural collapse
- **Other** – lost children, power outages, suspicious packages, public disturbances

---

### Severity Levels (START Triage Protocol)

Each incident is assigned a severity level following START triage:

- **Green (Minor)** 🟢 – No injuries, safe to wait, non-urgent
- **Yellow (Delayed)** 🟡 – Needs treatment soon, stable condition, can wait 30-60 mins
- **Red (Immediate)** 🔴 – Life-threatening, severe bleeding, urgent response needed
- **Black (Deceased)** ⚫ – No vital signs, deceased

---

## Getting Started

### Requirements

- **Python 3.13+** (or 3.8+)
- **pip** and **virtualenv**
- **NVIDIA GPU** with CUDA support (recommended for training)
- **8GB+ RAM** (16GB recommended for training)

---

### 1. Setup Virtual Environment

```powershell
# Create and activate virtual environment
cd "RescueLink AI"
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
```

---

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

**Key packages installed:**
- `torch` (PyTorch with CUDA support)
- `transformers` (Hugging Face - XLM-RoBERTa)
- `pandas`, `numpy`, `scikit-learn`
- `fastapi`, `uvicorn` (API server)
- `jupyter` (for training notebook)

---

## Training the Model

### Using Jupyter Notebook (Recommended)

The training process is organized in an interactive notebook for step-by-step execution:

**1. Open the Notebook:**

```powershell
cd "RescueLink AI"
jupyter notebook RescueLinkAi.ipynb
```

Or use VS Code's Jupyter extension.

**2. Training Steps:**

The notebook contains 7 steps:

- **Step 0**: Load latest trained model (architecture check)
- **Step 1**: Load the dataset (15k Filipino-prioritized synthetic data)
- **Step 2**: Tokenize text using XLM-RoBERTa tokenizer
- **Step 3**: Create PyTorch datasets and data loaders
- **Step 4**: Train the model (5 epochs, ~7-8 mins/epoch on GPU)
- **Step 5**: Evaluate accuracy on validation set
- **Step 6**: Save model checkpoint and metadata

**3. Run All Cells:**

Execute cells sequentially from top to bottom. The training process will:
- Use **mixed precision (fp16)** for faster training
- Train on **12,000 samples** (validate on 3,000)
- Save model to `models/emergency_model.pt`
- Save metadata to `models/label_meta.json`

**Expected Results:**
- Training time: ~39 minutes (5 epochs)
- Incident Type F1: **99.86%**
- Severity Accuracy: **100%**

---

### Using Python Script (Alternative)

If you prefer command-line training:

```powershell
python -m training.train
```

**Note:** The notebook approach is recommended for visualization and step-by-step control.

---

### Generating New Synthetic Dataset

If you want to regenerate the training data:

```powershell
cd data
python generate_dataset.py
```

This creates `data/emergency_dataset.csv` with:
- **15,000 rows** of synthetic emergency reports
- **80% Filipino**, 20% English
- **Balanced severity classes** (25% each)
- **Realistic 1-2 sentence reports**

---

## Testing the Model

### Option 1: FastAPI Web Service (Recommended)

**1. Start the API Server:**

```powershell
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**2. Open Interactive API Documentation:**

Go to **http://localhost:8000/docs** in your browser.

**3. Test the `/classify` Endpoint:**

- Click **POST /classify**
- Click **"Try it out"**
- Enter your emergency report:

```json
{
  "text": "May sunog sa Tondo, maraming bahay ang nasusunog!",
  "threshold": 0.5
}
```

- Click **Execute**
- See the classification results!

**4. API Endpoints:**

- `GET /health` - Check if model is loaded
- `GET /labels` - Get all available labels
- `POST /classify` - Classify emergency report

---

### Option 2: Jupyter Notebook Manual Testing

Add this cell to the end of `RescueLinkAi.ipynb`:

```python
def predict_emergency(text, threshold=0.5):
    """Predict incident types and severity for a single text"""
    model.eval()
    
    encoding = tokenizer(text, truncation=True, padding=True, max_length=128, return_tensors="pt")
    input_ids = encoding["input_ids"].to(device)
    attention_mask = encoding["attention_mask"].to(device)
    
    with torch.no_grad():
        outputs = model(input_ids, attention_mask)
        type_probs = torch.sigmoid(outputs["type_logits"]).cpu().numpy()[0]
        predicted_types = [meta["incident_type_labels"][i] for i, prob in enumerate(type_probs) if prob >= threshold]
        severity_idx = torch.argmax(outputs["severity_logits"], dim=1).item()
        predicted_severity = meta["severity_labels"][severity_idx]
    
    return {
        "incident_types": predicted_types if predicted_types else ["Other"],
        "severity": predicted_severity,
        "confidence": {meta["incident_type_labels"][i]: f"{prob:.2%}" for i, prob in enumerate(type_probs)}
    }

# Test with your own report
test_report = "May bata nawawala sa mall"
result = predict_emergency(test_report)
print(f"Text: {test_report}")
print(f"Incidents: {result['incident_types']}")
print(f"Severity: {result['severity']}")
print(f"Confidence: {result['confidence']}")
```

---

### Option 3: Python Script

Create a test script `test_model.py`:

```python
import torch
import json
from transformers import AutoTokenizer
from models.emergency_classifier import EmergencyClassifier

# Load model and metadata
with open("models/label_meta.json") as f:
    meta = json.load(f)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = EmergencyClassifier(len(meta["incident_type_labels"]), len(meta["severity_labels"]))
checkpoint = torch.load("models/emergency_model.pt", map_location=device)
model.load_state_dict(checkpoint.get("model_state_dict", checkpoint))
model.to(device).eval()

tokenizer = AutoTokenizer.from_pretrained("xlm-roberta-base")

# Test
text = "May sunog sa Tondo!"
encoding = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
with torch.no_grad():
    outputs = model(encoding["input_ids"].to(device), encoding["attention_mask"].to(device))
    types = [meta["incident_type_labels"][i] for i, p in enumerate(torch.sigmoid(outputs["type_logits"])[0]) if p > 0.5]
    severity = meta["severity_labels"][torch.argmax(outputs["severity_logits"]).item()]

print(f"Incidents: {types}, Severity: {severity}")
```

Run with:
```powershell
python test_model.py
```

---

## Example API Usage

### cURL

```bash
# Health check
curl http://localhost:8000/health

# Classify emergency
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "May bata nawawala sa mall", "threshold": 0.5}'
```

---

### Python Requests

```python
import requests

response = requests.post(
    "http://localhost:8000/classify",
    json={"text": "Emergency! May naaksidente sa EDSA!", "threshold": 0.5}
)

result = response.json()
print(f"Incident Types: {result['incident_types']}")
print(f"Severity: {result['severity_color']}")
print(f"Confidence: {result['confidence_scores']}")
```

---

### JavaScript (Frontend Integration)

```javascript
async function classifyEmergency(text) {
    const response = await fetch('http://localhost:8000/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, threshold: 0.5 })
    });
    
    const result = await response.json();
    console.log('Incident Types:', result.incident_types);
    console.log('Severity:', result.severity_color);
    console.log('Confidence:', result.confidence_scores);
}

classifyEmergency("May sunog sa Tondo!");
```

---

## Model Performance

### Metrics (Validation Set)

- **Dataset**: 15,000 synthetic reports (12k train, 3k val)
- **Languages**: 80% Filipino, 20% English
- **Training Time**: ~39 minutes (5 epochs on RTX 4050 GPU)

**Results:**
- **Incident Type F1**: 99.86% (multi-label)
- **Severity Accuracy**: 100%
- **Hamming Loss**: 0.06%

### Confusion Matrix

Perfect diagonal - all severities correctly classified:
- Green → Green: 100%
- Yellow → Yellow: 100%
- Red → Red: 100%
- Black → Black: 100%

---

## Architecture

- **Backbone**: XLM-RoBERTa Base (multilingual, 270M parameters)
- **Input**: Text sequences (max 128 tokens)
- **Output**: 
  - 6 incident type logits (multi-label with sigmoid)
  - 4 severity class logits (single-label with softmax)
- **Training**:
  - Loss: BCEWithLogitsLoss (types) + CrossEntropyLoss (severity)
  - Optimizer: AdamW (lr=5e-5, weight decay=0.01)
  - Scheduler: StepLR (step_size=2, gamma=0.1)
  - Mixed Precision: FP16 with GradScaler
  - Batch Size: 16

---

## Project Structure

```
RescueLink AI/
├── api/
│   └── main.py              # FastAPI web service
├── data/
│   ├── generate_dataset.py  # Synthetic data generator
│   └── emergency_dataset.csv # 15k training data
├── models/
│   ├── emergency_classifier.py  # Model architecture
│   ├── emergency_model.pt       # Trained weights
│   └── label_meta.json          # Label vocabulary
├── training/
│   └── train.py             # Training utilities
├── RescueLinkAi.ipynb       # Training notebook
├── requirements.txt         # Python dependencies
└── HOW_TO_USE.md           # This file
```

---

## Troubleshooting

### CUDA Out of Memory
- Reduce `batch_size` in training script (default: 16)
- Use CPU training: `device = torch.device("cpu")`

### ModuleNotFoundError
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`
- Check Python path: `sys.path.insert(0, ...)`

### Slow Training
- Verify GPU is being used: check "Device: cuda" in logs
- Enable mixed precision (already enabled by default)
- Use smaller dataset for testing

### API Won't Start
- Check port 8000 isn't in use
- Navigate to `api/` folder before running uvicorn
- Verify model files exist in `models/`

---

## Sample Emergency Reports (Filipino)

Try testing with these examples:

```
May sunog sa Tondo, maraming bahay ang nasusunog!
Nakita ko may bata nawawala sa mall.
Emergency! May naaksidente sa EDSA, need ambulance now!
May patay na lalaki sa kanto, mukhang pinaslang.
Lindol! Bumagsak ang building sa Makati!
May matandang nahulog sa hagdan, hindi makagalaw.
Baha sa Marikina, tubig hanggang segundo!
May holdaper sa jeep, may baril!
```

---

## Future Improvements

- Real-time incident updates (streaming classification)
- Location extraction from text
- Multi-language support expansion (Cebuano, Ilocano)
- Integration with 911 dispatch systems
- Mobile app for field responders
