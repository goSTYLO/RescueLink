# RescueLink AI

RescueLink AI is a text-based emergency classification microservice designed to support **initial emergency triage**.  
It analyzes short emergency descriptions and returns:

- the **incident type**
- the **severity level**
- a **confidence score** explaining how strongly the system supports the result

This system is intended as **decision support**, not as a replacement for human responders or dispatchers.

---

## Overview

RescueLink AI uses a fine-tuned **DistilBERT** model combined with **rule-based safety checks** to improve reliability in high-risk situations.  
The AI is exposed as a standalone **FastAPI microservice**, allowing it to be integrated cleanly with the main RescueLink backend.

---

## Emergency Categories

### Incident Types

The system classifies emergencies into six categories:

- **Fire** – house fires, electrical fires, kitchen fires, smoke reports
- **Crime** – shootings, assaults, armed robbery, domestic violence
- **Accident** – vehicle collisions, motorcycle crashes, hit-and-runs
- **Medical** – collapsed persons, breathing difficulties, chest pain, seizures
- **Natural Disaster** – flooding, earthquakes, landslides, storms
- **Other** – lost children, power outages, public disturbances

---

### Severity Levels

Each incident is also assigned a severity level:

- **Minor** – no immediate danger, situation under control
- **Moderate** – assistance required, possible injuries
- **Severe** – serious injuries or rapidly increasing danger
- **Critical** – life-threatening situations, people trapped, multiple casualties

---

## Getting Started

### Requirements

- Python 3.8 or newer
- pip
- Virtual environment (recommended)

---

### Install Dependencies

From the project root:

```bash
cd "RescueLink AI"
pip install -r requirements.txt
```

### Train Model

If the dataset or training logic changes, retrain the model:

```bash
python -m training.train
```

### Run the API Server

Start the FastAPI server:

```bash
uvicorn api.main:app --port 8000
```

### Web dashboard

For testing and demo
http://127.0.0.1:8001/docs#/

### Classification Endpoint

POST /classify

```json
{
  "text": "There is a fire and people are trapped inside"
}
```

Example Response

```json
{
  "incident_type": "Fire",
  "severity": "Critical",
  "confidence": 0.92,
  "confidence_basis": "rule-based escalation"
}
```
