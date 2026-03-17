"""
One-off script to remove synthetic template rows from realistic_base_reports.jsonl.
Synthetic = rows where literal incident type names (Fire, Crime, etc.) appear in template format.
"""
import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, "realistic_base_reports.jsonl")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "realistic_base_reports_cleaned.jsonl")

INCIDENT_NAMES = ["Fire", "Crime", "Accident", "Medical", "Natural Disaster", "Other"]
INCIDENT_PATTERN = re.compile(
    r"\b(Fire|Crime|Accident|Medical|Natural Disaster|Other)\b",
    re.IGNORECASE
)


def is_synthetic(text: str) -> bool:
    """Return True if row is synthetic template (should be removed)."""
    t = text.strip()
    # Pattern 1: "X and Y reported" or "X plus Y" with incident type names
    if re.search(
        r"\b(Fire|Crime|Accident|Medical|Natural Disaster|Other)\s+(and|plus)\s+"
        r"(Fire|Crime|Accident|Medical|Natural Disaster|Other)\b",
        t, re.IGNORECASE
    ):
        return True
    # Pattern 2: "May X at Y" where X and Y are incident types (template combo)
    if re.search(
        r"May\s+(fire|crime|accident|medical|natural disaster|other)\s+at\s+"
        r"(fire|crime|accident|medical|natural disaster|other)\b",
        t, re.IGNORECASE
    ):
        return True
    # Pattern 3: "Urgent! May X at Y" or "Help! May X at Y"
    if re.search(
        r"(Urgent!|Help!)\s+May\s+(fire|crime|accident|medical|natural disaster|other)\s+at\s+",
        t, re.IGNORECASE
    ):
        return True
    # Pattern 4: "X at Y" or "Y at X" - "May crime at fire", "May fire at other"
    if re.search(
        r"(?:May\s+)?(fire|crime|accident|medical|natural disaster|other)\s+at\s+"
        r"(fire|crime|accident|medical|natural disaster|other)\s*[,.]",
        t, re.IGNORECASE
    ):
        return True
    return False


def main():
    kept = []
    removed = 0
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                text = row.get("text", "")
                if is_synthetic(text):
                    removed += 1
                    continue
                kept.append(row)
            except json.JSONDecodeError:
                continue

    # Write cleaned file (backup original, then overwrite)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for row in kept:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Kept: {len(kept)} rows")
    print(f"Removed: {removed} synthetic rows")
    print(f"Output: {OUTPUT_PATH}")

    # Replace original with cleaned
    os.replace(OUTPUT_PATH, INPUT_PATH)
    print(f"Replaced {INPUT_PATH} with cleaned version")


if __name__ == "__main__":
    main()
