"""
Prepare Hugging Face emergency_classification_alpaca dataset
Maps to RescueLink schema with START triage severity levels
"""
import re
import ast
import pandas as pd
from datasets import load_dataset

# Load Hugging Face dataset
print("Loading dataset from Hugging Face...")
ds = load_dataset("hotal/emergency_classification_alpaca")
print(f"Loaded {len(ds['train'])} rows")

# Get all unique labels and sort alphabetically
all_labels = set()
for example in ds['train']:
    try:
        labels = ast.literal_eval(example['output'])
        if isinstance(labels, list):
            all_labels.update(labels)
    except:
        pass

incident_labels_sorted = sorted(all_labels)
print(f"\nFound {len(incident_labels_sorted)} unique incident labels (alphabetical):")
print(incident_labels_sorted)

# Create label-to-index mapping
incident_to_idx = {label: idx for idx, label in enumerate(incident_labels_sorted)}

# START Triage Severity Mapping (Conservative)
SEVERITY_ORDER = ["Green", "Yellow", "Red", "Black"]
severity_to_idx = {sev: idx for idx, sev in enumerate(SEVERITY_ORDER)}

def map_severity_conservative(incident_types):
    """
    Conservative START triage mapping:
    - Black: death present
    - Red: acute medical/rescue or major natural disasters
    - Yellow: aid/infrastructure needs
    - Green: minimal/informational
    """
    if not incident_types:
        return "Green", 0
    
    incident_set = set(incident_types)
    
    # Black: fatalities
    if "death" in incident_set:
        return "Black", 3
    
    # Red: life-threatening conditions or acute disasters
    red_indicators = {
        "medical_help", "search_and_rescue", "missing_people",
        "fire", "earthquake", "floods", "storm", "hospitals"
    }
    if incident_set & red_indicators:
        return "Red", 2
    
    # Yellow: aid and infrastructure (serious but not immediately life-threatening)
    yellow_indicators = {
        "aid_related", "medical_products", "water", "food", "shelter",
        "clothing", "money", "refugees", "buildings", "electricity",
        "transport", "tools", "aid_centers", "other_aid", "other_infrastructure",
        "infrastructure_related", "weather_related", "child_alone"
    }
    if incident_set & yellow_indicators:
        return "Yellow", 1
    
    # Green: informational/minimal priority
    return "Green", 0


def clean_text(text):
    """Clean and validate text"""
    if not text or not isinstance(text, str):
        return None
    
    # Strip whitespace
    text = text.strip()
    
    # Drop empty
    if not text:
        return None
    
    # Drop URL-only rows (simple heuristic)
    if re.match(r'^https?://', text) and len(text.split()) == 1:
        return None
    
    # Cap max length at 512 characters
    if len(text) > 512:
        text = text[:512]
    
    return text


# Process dataset
rows = []
skipped = 0

for idx, example in enumerate(ds['train']):
    # Parse labels
    try:
        output_str = example['output']
        labels = ast.literal_eval(output_str)
        if not isinstance(labels, list):
            labels = [labels] if labels else []
    except:
        labels = []
    
    # Drop rows with empty labels
    if not labels:
        skipped += 1
        continue
    
    # Clean text
    text = clean_text(example['instruction'])
    if not text:
        skipped += 1
        continue
    
    # Map incident types to indices
    incident_types = labels
    type_labels = [incident_to_idx[label] for label in incident_types if label in incident_to_idx]
    
    # Skip if no valid labels after mapping
    if not type_labels:
        skipped += 1
        continue
    
    # Map severity
    severity, severity_label = map_severity_conservative(incident_types)
    
    rows.append({
        "id": len(rows),
        "text": text,
        "incident_types": incident_types,
        "type_labels": type_labels,
        "severity": severity,
        "severity_label": severity_label,
    })

print(f"\nProcessed {len(rows)} valid rows, skipped {skipped} rows")

# Create DataFrame
df = pd.DataFrame(rows)

# 80/20 train/val split
train_df = df.sample(frac=0.8, random_state=42)
val_df = df.drop(train_df.index)

print(f"\nTrain set: {len(train_df)} rows")
print(f"Validation set: {len(val_df)} rows")

# Save to CSV
train_df.to_csv("data/hf_emergency_dataset.csv", index=False)
val_df.to_csv("data/hf_emergency_dataset_val.csv", index=False)

print("\n✓ Saved to data/hf_emergency_dataset.csv and data/hf_emergency_dataset_val.csv")

# Print summary statistics
print("\n" + "="*60)
print("SUMMARY STATISTICS")
print("="*60)

print("\nSeverity Distribution (Train):")
print(train_df['severity'].value_counts().sort_index())

print("\nTop 10 Most Common Incident Types (Train):")
all_incidents = []
for incidents in train_df['incident_types']:
    all_incidents.extend(incidents)
incident_counts = pd.Series(all_incidents).value_counts()
print(incident_counts.head(10))

print("\nSample Rows:")
print("-"*60)
for idx, row in train_df.head(3).iterrows():
    print(f"\nText: {row['text'][:100]}...")
    print(f"Incidents: {row['incident_types']}")
    print(f"Severity: {row['severity']}")
    print("-"*60)

print("\n✓ Review complete. Ready for training when needed.")
