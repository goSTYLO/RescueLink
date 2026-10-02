"""Replay rank_and_promote on val rows assuming a perfect model (0.99 gold, 0.01 rest)."""
import ast
import csv
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import rank_and_promote_incident_types  # noqa: E402

LABELS = [
    "Fire",
    "Crime",
    "Accident",
    "Medical",
    "Natural Disaster",
    "Other",
]
THRESHOLD = 0.5
FILIPINO_MARKERS = re.compile(
    r"(?<![a-z0-9])(ang|mga|sa|po|yung|may)(?![a-z0-9])",
    re.IGNORECASE,
)


def is_filipino(text: str) -> bool:
    return bool(FILIPINO_MARKERS.search(text or ""))


def gold_scores(incident_types: list[str]) -> dict[str, float]:
    gold = set(incident_types)
    return {label: (0.99 if label in gold else 0.01) for label in LABELS}


def replay(csv_path: Path):
    misses = []
    row_count = 0
    with csv_path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            row_count += 1
            gold = ast.literal_eval(row["incident_types"])
            gold_set = set(gold)
            scores = gold_scores(gold)
            ranked, _, _ = rank_and_promote_incident_types(
                row["text"],
                scores,
                threshold=THRESHOLD,
                incident_labels=LABELS,
            )
            ranked_set = set(ranked)
            if ranked_set != gold_set:
                fire_removed = "Fire" in gold_set and "Fire" not in ranked_set
                added = ranked_set - gold_set
                removed = gold_set - ranked_set
                misses.append(
                    {
                        "text": row["text"][:120],
                        "gold": sorted(gold_set),
                        "ranked": ranked,
                        "added": sorted(added),
                        "removed": sorted(removed),
                        "fire_removed": fire_removed,
                        "filipino": is_filipino(str(row["text"])),
                    }
                )

    by_lang = Counter("fil" if m["filipino"] else "en" for m in misses)
    by_kind = Counter()
    for m in misses:
        if m["added"]:
            by_kind["type_added"] += 1
        if m["fire_removed"]:
            by_kind["fire_removed"] += 1

    print(f"rows={row_count} misses={len(misses)} fil={by_lang['fil']} en={by_lang['en']}")
    print(f"miss_kinds: type_added={by_kind['type_added']} fire_removed={by_kind['fire_removed']}")
    for label in ("type_added", "fire_removed"):
        sample = [m for m in misses if (label == "fire_removed" and m["fire_removed"]) or (label == "type_added" and m["added"])][:3]
        if sample:
            print(f"\n--- sample {label} ---")
            for m in sample:
                print(m["gold"], "->", m["ranked"], "|", m["text"])


if __name__ == "__main__":
    replay(ROOT / "data" / "merged_emergency_dataset_val.csv")
