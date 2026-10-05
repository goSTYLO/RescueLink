"""Frozen dispatch phrases: keyword detection + false-Fire rank corrections."""
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import detect_keyword_matched_types, rank_and_promote_incident_types

LABELS = [
    "Fire",
    "Crime",
    "Accident",
    "Medical",
    "Natural Disaster",
    "Other",
]
THRESHOLD = 0.5
FIRE_HEAVY = {
    "Fire": 0.9936,
    "Crime": 0.01,
    "Accident": 0.02,
    "Medical": 0.01,
    "Natural Disaster": 0.02,
    "Other": 0.01,
}

# One representative line per type (Filipino-first, from humanized + production)
DETECT_CASES = [
    ("May sunog sa barangay at may usok.", "Fire"),
    ("Sir may nag-holdap sa jeep, may dala daw baril.", "Crime"),
    ("Ma'am naaksidente ang motor sa kanto.", "Accident"),
    ("Tulong! May tao dito na hindi humihinga.", "Medical"),
    ("Boss tumataas na yung tubig sa kalsada.", "Natural Disaster"),
    ("Yung nawawalang bata kanina, hinahanap pa.", "Other"),
    ("meron po nag aamok sa dito po sa kalsada namin. may dalang itak.", "Crime"),
    ("Sir baha mataas na, may tao na trap sa bubong.", "Natural Disaster"),
    ("Boss gas leak, amoy na malakas.", "Other"),
    ("Nahulog sa trabaho ang construction worker.", "Accident"),
    ("Natumbang puno sa kalsada, hindi makadaan.", "Natural Disaster"),
    ("Nasunog na kotse sa parking, walang tao sa loob.", "Fire"),
]

FALSE_FIRE_RANK_CASES = [
    (
        "meron po nag aamok sa dito po sa kalsada namin. may dalang itak.",
        ["Crime"],
    ),
    (
        "May grupo ng tao na nagsusuntukan sa harap ng bahay namin.",
        ["Crime"],
    ),
    (
        "Emergency, mayroon pung nagbanggaan na kotse dito po sa harap ng bahay namin "
        "di po namin alam yung gagawin yung isa pong driver may sugat",
        ["Accident", "Medical"],
    ),
]


class TestDispatchHoldoutDetection(unittest.TestCase):
    def test_detect_cases_include_gold_type(self):
        for text, gold in DETECT_CASES:
            matched = detect_keyword_matched_types(text, incident_labels=LABELS)
            self.assertIn(gold, matched, msg=f"text={text!r} matched={matched}")


class TestDispatchHoldoutFalseFire(unittest.TestCase):
    def test_rank_drops_false_fire(self):
        for text, expected_types in FALSE_FIRE_RANK_CASES:
            ranked, promoted, _ = rank_and_promote_incident_types(
                text,
                FIRE_HEAVY,
                threshold=THRESHOLD,
                incident_labels=LABELS,
            )
            self.assertFalse("Fire" in ranked and len(ranked) == 1, msg=text)
            for gold in expected_types:
                self.assertIn(gold, ranked, msg=text)
            self.assertTrue(promoted, msg=text)

    def test_true_fire_kept(self):
        text = "Boss nasusunog yung bahay, may usok na tumataas."
        ranked, _, _ = rank_and_promote_incident_types(
            text, FIRE_HEAVY, threshold=THRESHOLD, incident_labels=LABELS
        )
        self.assertEqual(ranked, ["Fire"])


if __name__ == "__main__":
    unittest.main()
