import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import rank_and_promote_incident_types

LABELS = [
    "Fire",
    "Crime",
    "Accident",
    "Medical",
    "Natural Disaster",
    "Other",
]


class TestRankAndPromote(unittest.TestCase):
    def test_ranks_by_confidence_not_label_order(self):
        scores = {
            "Fire": 0.82,
            "Crime": 0.12,
            "Accident": 0.08,
            "Medical": 0.91,
            "Natural Disaster": 0.05,
            "Other": 0.03,
        }
        ranked, promoted, no_above = rank_and_promote_incident_types(
            "generic emergency",
            scores,
            threshold=0.5,
            incident_labels=LABELS,
        )
        self.assertEqual(ranked, ["Medical", "Fire"])
        self.assertFalse(promoted)
        self.assertFalse(no_above)

    def test_promotes_keyword_type_below_threshold(self):
        scores = {
            "Fire": 0.38,
            "Crime": 0.12,
            "Accident": 0.08,
            "Medical": 0.87,
            "Natural Disaster": 0.05,
            "Other": 0.03,
        }
        ranked, promoted, no_above = rank_and_promote_incident_types(
            "May sunog sa gusali",
            scores,
            threshold=0.5,
            incident_labels=LABELS,
        )
        self.assertEqual(ranked, ["Fire", "Medical"])
        self.assertTrue(promoted)
        self.assertFalse(no_above)

    def test_no_types_above_threshold_without_keywords(self):
        scores = {
            "Fire": 0.12,
            "Crime": 0.08,
            "Accident": 0.06,
            "Medical": 0.15,
            "Natural Disaster": 0.04,
            "Other": 0.02,
        }
        ranked, promoted, no_above = rank_and_promote_incident_types(
            "unclear noise",
            scores,
            threshold=0.5,
            incident_labels=LABELS,
        )
        self.assertEqual(ranked, [])
        self.assertFalse(promoted)
        self.assertTrue(no_above)

    def test_keyword_only_promotion(self):
        scores = {
            "Fire": 0.22,
            "Crime": 0.08,
            "Accident": 0.06,
            "Medical": 0.15,
            "Natural Disaster": 0.04,
            "Other": 0.02,
        }
        ranked, promoted, no_above = rank_and_promote_incident_types(
            "May usok at apoy",
            scores,
            threshold=0.5,
            incident_labels=LABELS,
        )
        self.assertEqual(ranked, ["Fire"])
        self.assertTrue(promoted)
        self.assertTrue(no_above)


if __name__ == "__main__":
    unittest.main()
