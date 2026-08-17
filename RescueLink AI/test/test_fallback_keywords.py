import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import apply_keyword_fallback, detect_keyword_matched_types, rank_and_promote_incident_types

LABELS = [
    "Fire",
    "Crime",
    "Accident",
    "Medical",
    "Natural Disaster",
    "Other",
]


class TestFallbackKeywords(unittest.TestCase):
    def test_bahay_does_not_match_flood_keyword(self):
        text = "Kailangan po namin ng tulong dito. Nasusunog po yung bahay namin."
        matched = detect_keyword_matched_types(text, incident_labels=LABELS)
        self.assertIn("Fire", matched)
        self.assertNotIn("Natural Disaster", matched)

    def test_baha_matches_when_word_is_present(self):
        text = "May baha sa kalsada at hindi makadaan ang mga tao."
        matched = detect_keyword_matched_types(text, incident_labels=LABELS)
        self.assertIn("Natural Disaster", matched)
        self.assertNotIn("Fire", matched)

    def test_apply_keyword_fallback_fire_only_for_house_burning(self):
        text = "Nasusunog po yung bahay namin. Kailangan po namin ng bumbero."
        types, _, _ = apply_keyword_fallback(text, incident_labels=LABELS, severity_labels=["Yellow"])
        self.assertEqual(types, ["Fire"])


class TestIncident821Collision(unittest.TestCase):
    INCIDENT_821_TEXT = (
        "Emergency, mayroon pung nagbanggaan na kotse dito po sa harap ng bahay namin "
        "di po namin alam yung gagawin yung isa pong driver may sugat"
    )
    INCIDENT_821_SCORES = {
        "Fire": 0.9936,
        "Crime": 0.01,
        "Accident": 0.9469,
        "Medical": 0.35,
        "Natural Disaster": 0.02,
        "Other": 0.01,
    }

    def test_detects_accident_and_medical_keywords(self):
        matched = detect_keyword_matched_types(self.INCIDENT_821_TEXT, incident_labels=LABELS)
        self.assertIn("Accident", matched)
        self.assertIn("Medical", matched)
        self.assertNotIn("Fire", matched)

    def test_rank_drops_false_fire_and_promotes_medical(self):
        ranked, promoted, no_above = rank_and_promote_incident_types(
            self.INCIDENT_821_TEXT,
            self.INCIDENT_821_SCORES,
            threshold=0.5,
            incident_labels=LABELS,
        )
        self.assertEqual(ranked, ["Accident", "Medical"])
        self.assertTrue(promoted)
        self.assertFalse(no_above)


if __name__ == "__main__":
    unittest.main()
