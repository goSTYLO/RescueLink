"""
Merge synthetic and HF datasets with unified 6-category schema
Maps HF's 35 incident types to: Fire, Crime, Accident, Medical, Natural Disaster, Other
"""
import pandas as pd
import ast

# Define the 6 target categories (alphabetical order for consistency)
TARGET_CATEGORIES = ["Accident", "Crime", "Fire", "Medical", "Natural Disaster", "Other"]
category_to_idx = {cat: idx for idx, cat in enumerate(TARGET_CATEGORIES)}

# Map HF's 35 labels to the 6 target categories
HF_TO_TARGET_MAPPING = {
    # Fire
    "fire": "Fire",
    
    # Medical
    "medical_help": "Medical",
    "medical_products": "Medical",
    "hospitals": "Medical",
    "child_alone": "Medical",
    
    # Natural Disaster
    "earthquake": "Natural Disaster",
    "floods": "Natural Disaster",
    "storm": "Natural Disaster",
    "weather_related": "Natural Disaster",
    "cold": "Natural Disaster",
    "other_weather": "Natural Disaster",
    
    # Crime (violence, security threats)
    "military": "Crime",
    "security": "Crime",
    "death": "Crime",
    
    # Accident (infrastructure damage, transport issues)
    "buildings": "Accident",
    "infrastructure_related": "Accident",
    "transport": "Accident",
    "electricity": "Accident",
    
    # Other (aid, resources, general emergency)
    "emergency": "Other",
    "aid_related": "Other",
    "aid_centers": "Other",
    "request": "Other",
    "offer": "Other",
    "direct_report": "Other",
    "search_and_rescue": "Other",
    "missing_people": "Other",
    "refugees": "Other",
    "water": "Other",
    "food": "Other",
    "shelter": "Other",
    "clothing": "Other",
    "money": "Other",
    "tools": "Other",
    "shops": "Other",
    "other_aid": "Other",
    "other_infrastructure": "Other",
}

def map_hf_incidents_to_target(hf_incidents):
    """Map HF incident list to target 6 categories"""
    target_incidents = set()
    for incident in hf_incidents:
        if incident in HF_TO_TARGET_MAPPING:
            target_incidents.add(HF_TO_TARGET_MAPPING[incident])
        else:
            target_incidents.add("Other")
    
    if not target_incidents:
        target_incidents.add("Other")
    
    return sorted(list(target_incidents))

def load_synthetic_dataset():
    """Load and process synthetic dataset"""
    df = pd.read_csv("data/emergency_dataset.csv")
    df["incident_types"] = df["incident_types"].apply(ast.literal_eval)
    df["type_labels"] = df["type_labels"].apply(ast.literal_eval)
    df["severity_label"] = df["severity_label"].astype(int)
    
    df["type_labels"] = df["incident_types"].apply(
        lambda incidents: sorted([category_to_idx[inc] for inc in incidents])
    )
    
    return df[["id", "text", "incident_types", "severity", "type_labels", "severity_label"]]

def load_and_map_hf_dataset():
    """Load HF dataset and map to target categories"""
    df = pd.read_csv("data/hf_emergency_dataset.csv")
    df["incident_types"] = df["incident_types"].apply(ast.literal_eval)
    
    df["incident_types"] = df["incident_types"].apply(map_hf_incidents_to_target)
    df["type_labels"] = df["incident_types"].apply(
        lambda incidents: sorted([category_to_idx[inc] for inc in incidents])
    )
    
    return df[["id", "text", "incident_types", "severity", "type_labels", "severity_label"]]

def main():
    print("Loading datasets...")
    
    synthetic_df = load_synthetic_dataset()
    hf_df = load_and_map_hf_dataset()
    
    print(f"Synthetic dataset: {len(synthetic_df)} rows")
    print(f"HF dataset (mapped): {len(hf_df)} rows")
    
    merged_df = pd.concat([synthetic_df, hf_df], ignore_index=True)
    merged_df["id"] = range(len(merged_df))
    
    print(f"\nMerged dataset: {len(merged_df)} rows")
    
    train_df = merged_df.sample(frac=0.8, random_state=42)
    val_df = merged_df.drop(train_df.index)
    
    print(f"Train set: {len(train_df)} rows")
    print(f"Validation set: {len(val_df)} rows")
    
    train_df.to_csv("data/merged_emergency_dataset.csv", index=False)
    val_df.to_csv("data/merged_emergency_dataset_val.csv", index=False)
    
    print("\n✓ Saved to data/merged_emergency_dataset.csv and data/merged_emergency_dataset_val.csv")
    
    severity_map = {0: "Green", 1: "Yellow", 2: "Red", 3: "Black"}
    print("\nSeverity Distribution (Train):")
    for label in sorted(train_df["severity_label"].unique()):
        count = (train_df["severity_label"] == label).sum()
        print(f"  {severity_map[label]}: {count} ({count/len(train_df)*100:.1f}%)")
    
    print("\nIncident Type Distribution (Train):")
    all_incidents = []
    for incidents in train_df["incident_types"]:
        all_incidents.extend(incidents)
    
    from collections import Counter
    incident_counts = Counter(all_incidents)
    for incident in TARGET_CATEGORIES:
        count = incident_counts[incident]
        print(f"  {incident}: {count} ({count/len(train_df)*100:.1f}%)")

if __name__ == "__main__":
    main()