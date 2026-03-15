"""
Generate realistic Filipino/Taglish emergency reports for training.
Uses curated base reports + controlled combinations/paraphrases.
No location references (GPS collected separately).
Run: python data/generate_dataset.py
"""
import csv
import json
import os
import random
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_REPORTS_PATH = os.path.join(SCRIPT_DIR, "realistic_base_reports.jsonl")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "emergency_dataset.csv")
TARGET_ROWS = 10_000
SEED = 42

# Location phrases to strip (GPS collected separately)
LOCATION_PATTERNS = [
    r"\s+sa\s+(?:Tondo|Marikina|EDSA|Makati|Quezon City|Manila|Barangay Centro|Poblacion|San Jose|Bagong Silang|kanto|palengke|plaza|highway|mall|sakayan|area|Cebu|Davao|Baguio|Iloilo|Cagayan)\b",
    r"\s+at\s+(?:Tondo|Marikina|EDSA|Makati|Manila|Cebu|Davao)\b",
    r"\s+near\s+(?:EDSA|Makati|Manila|the\s+mall|the\s+highway)\b",
    r"\s+malapit\s+sa\s+(?:Tondo|Marikina|EDSA|Makati|Manila|kanto|plaza)\b",
    r"\s+dito\s+sa\s+(?:Tondo|Marikina|EDSA|Makati|Manila)\b",
    r"\s+bandang\s+(?:Tondo|Marikina|EDSA|Makati|Manila|kanto)\b",
]

# Tokens that indicate location leakage (for post-generation validation)
LOCATION_LEAKAGE_TOKENS = [
    "tondo", "marikina", "edsa", "makati", "quezon city", "manila",
    "barangay centro", "poblacion", "san jose", "bagong silang",
    "kanto", "palengke", "plaza", "highway", "mall", "sakayan",
    "cebu", "davao", "baguio", "iloilo", "cagayan",
]

# Must match training schema
INCIDENT_TYPES = ["Fire", "Crime", "Accident", "Medical", "Natural Disaster", "Other"]
SEVERITIES = ["Green", "Yellow", "Red", "Black"]
INCIDENT_TO_IDX = {name: idx for idx, name in enumerate(INCIDENT_TYPES)}
SEVERITY_TO_IDX = {name: idx for idx, name in enumerate(SEVERITIES)}


def strip_locations(text: str) -> str:
    """Remove location references (GPS collected separately)."""
    for pat in LOCATION_PATTERNS:
        text = re.sub(pat, "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def has_location_leakage(text: str) -> bool:
    """Check if text still contains location tokens (whole-word match to avoid false positives)."""
    lower = text.lower()
    for tok in LOCATION_LEAKAGE_TOKENS:
        if " " in tok:
            if re.search(r"\b" + re.escape(tok.replace(" ", r"\s+")) + r"\b", lower):
                return True
        elif re.search(r"\b" + re.escape(tok) + r"\b", lower):
            return True
    return False


def load_base_reports() -> list[dict]:
    """Load 1,000 curated base reports from JSONL."""
    if not os.path.exists(BASE_REPORTS_PATH):
        raise FileNotFoundError(
            f"Base reports not found: {BASE_REPORTS_PATH}. Run: python data/create_base_reports.py"
        )
    rows = []
    with open(BASE_REPORTS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            r["text"] = strip_locations(r["text"])
            rows.append(r)
    return rows


def add_paraphrase_variation(text: str) -> str:
    """Light paraphrase for variety (deterministic given seed)."""
    r = random.random()
    if r < 0.1:
        return text + " pls" if not text.endswith("pls") else text
    if r < 0.2:
        return text.replace("!", ".").replace(".", "!") if "!" in text or "." in text else text
    if r < 0.25:
        return text.replace(" po", "").replace(" pls", "")
    return text


def generate_combination(base1: dict, base2: dict) -> dict | None:
    """Create a multi-label combination from two base reports (same or different types)."""
    types1 = set(base1["incident_types"])
    types2 = set(base2["incident_types"])
    combined = sorted(types1 | types2)
    if len(combined) < 2:
        return None
    # Use severity from the more severe report
    sev_order = {"Green": 0, "Yellow": 1, "Red": 2, "Black": 3}
    s1, s2 = base1["severity"], base2["severity"]
    severity = s2 if sev_order[s2] >= sev_order[s1] else s1
    # Simple combo text
    t1 = base1["text"].split(".")[0].split("!")[0].strip()
    t2 = base2["text"].split(".")[0].split("!")[0].strip()
    if t1 == t2:
        return None
    text = f"{t1} at {t2}."
    return {"text": text, "incident_types": combined, "severity": severity}


def validate_dataset(rows: list[list]) -> dict:
    """Run quality checks and return summary."""
    if len(rows) < TARGET_ROWS * 0.95:
        raise ValueError(f"Dataset too small: {len(rows)} < {int(TARGET_ROWS * 0.95)}")
    texts = [r[1] for r in rows]
    dupes = len(texts) - len(set(texts))
    lengths = [len(t) for t in texts]
    inc_counts = {}
    sev_counts = {}
    leakage_count = 0
    leakage_samples = []
    for r in rows:
        for it in eval(r[2]) if isinstance(r[2], str) else r[2]:
            inc_counts[it] = inc_counts.get(it, 0) + 1
        sev = r[3]
        sev_counts[sev] = sev_counts.get(sev, 0) + 1
        if has_location_leakage(r[1]):
            leakage_count += 1
            if len(leakage_samples) < 5:
                leakage_samples.append(r[1][:80])
    return {
        "row_count": len(rows),
        "duplicate_count": dupes,
        "min_len": min(lengths),
        "max_len": max(lengths),
        "avg_len": sum(lengths) / len(lengths),
        "incident_dist": inc_counts,
        "severity_dist": sev_counts,
        "location_leakage_count": leakage_count,
        "location_leakage_samples": leakage_samples,
    }


def main():
    random.seed(SEED)
    os.makedirs(SCRIPT_DIR, exist_ok=True)

    base_reports = load_base_reports()
    if len(base_reports) < 500:
        raise ValueError(f"Need at least 500 base reports, got {len(base_reports)}")

    # Label mappings for output
    def to_type_labels(incidents: list) -> list:
        return [INCIDENT_TO_IDX[it] for it in incidents]

    def to_severity_label(sev: str) -> int:
        return SEVERITY_TO_IDX[sev]

    # Detect lang heuristically for CSV
    def detect_lang(text: str) -> str:
        fil_words = ["may", "sa", "ang", "na", "ng", "po", "kailangan", "malakas", "hindi", "walang"]
        c = sum(1 for w in fil_words if w in text.lower())
        return "fil" if c >= 2 else "tl"

    rows = []
    seen_texts = set()
    id_counter = 1

    # 1. Add base reports (with light variation to avoid exact dupes)
    for r in base_reports:
        text = r["text"].strip()
        if text in seen_texts:
            text = add_paraphrase_variation(text)
        if text in seen_texts:
            continue
        seen_texts.add(text)
        rows.append([
            id_counter,
            text,
            r["incident_types"],
            r["severity"],
            to_type_labels(r["incident_types"]),
            to_severity_label(r["severity"]),
            detect_lang(text),
        ])
        id_counter += 1
        if len(rows) >= TARGET_ROWS:
            break

    # 2. Add combinations/paraphrases to reach target
    while len(rows) < TARGET_ROWS:
        if random.random() < 0.7:
            # Paraphrase of random base
            b = random.choice(base_reports)
            text = add_paraphrase_variation(b["text"].strip())
        else:
            # Combination of two bases
            b1, b2 = random.sample(base_reports, 2)
            combo = generate_combination(b1, b2)
            if combo is None:
                continue
            text = combo["text"]
            b = combo
        text = strip_locations(text)
        if text in seen_texts or len(text) < 10:
            continue
        seen_texts.add(text)
        inc = b.get("incident_types", ["Other"])
        sev = b.get("severity", "Yellow")
        rows.append([
            id_counter,
            text,
            inc,
            sev,
            to_type_labels(inc),
            to_severity_label(sev),
            detect_lang(text),
        ])
        id_counter += 1

    rows = rows[:TARGET_ROWS]

    # Validate
    summary = validate_dataset(rows)
    print("Dataset quality summary:")
    print(f"  Rows: {summary['row_count']}")
    print(f"  Duplicates: {summary['duplicate_count']}")
    print(f"  Text length: min={summary['min_len']} max={summary['max_len']} avg={summary['avg_len']:.1f}")
    print(f"  Incident dist: {summary['incident_dist']}")
    print(f"  Severity dist: {summary['severity_dist']}")
    leakage = summary.get("location_leakage_count", 0)
    print(f"  Location leakage: {leakage} rows")
    if leakage > 0:
        print("  Leakage samples:", summary.get("location_leakage_samples", [])[:3])
    print("  Label mappings (training schema):")
    print(f"    Incident types: {INCIDENT_TYPES}")
    print(f"    Severity: {SEVERITIES}")

    # Write CSV
    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "text", "incident_types", "severity", "type_labels", "severity_label", "lang"])
        for r in rows:
            writer.writerow([
                r[0],
                r[1],
                str(r[2]) if isinstance(r[2], list) else r[2],
                r[3],
                str(r[4]) if isinstance(r[4], list) else r[4],
                r[5],
                r[6],
            ])

    print(f"\nGenerated {len(rows)} rows in {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
