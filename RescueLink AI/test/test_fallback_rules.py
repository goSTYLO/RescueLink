import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from utils.fallback_rules import apply_keyword_fallback, decide_fallback_reason


class TestFallbackRules(unittest.TestCase):
    def test_decide_fallback_reason_low_confidence(self):
        reason = decide_fallback_reason(
            max_confidence=0.35,
            no_types_above_threshold=False,
            threshold=0.7,
        )
        self.assertEqual(reason, 'low_confidence')

    def test_decide_fallback_reason_no_type_above_threshold(self):
        reason = decide_fallback_reason(
            max_confidence=0.9,
            no_types_above_threshold=True,
            threshold=0.7,
        )
        self.assertEqual(reason, 'no_type_above_threshold')

    def test_decide_fallback_reason_model_error(self):
        reason = decide_fallback_reason(
            max_confidence=0.9,
            no_types_above_threshold=False,
            threshold=0.7,
            model_error=True,
        )
        self.assertEqual(reason, 'model_error')

    def test_apply_keyword_fallback_detects_incident_and_severity(self):
        labels = ["Fire", "Crime", "Accident", "Medical", "Natural Disaster", "Other"]
        severities = ["Green", "Yellow", "Red", "Black"]
        incident_types, severity, matches = apply_keyword_fallback(
            "May sunog at maraming usok, critical ang biktima at hindi humihinga.",
            incident_labels=labels,
            severity_labels=severities,
        )

        self.assertIn("Fire", incident_types)
        self.assertEqual(severity, "Red")
        self.assertTrue(matches["incident_type_matches"])
        self.assertTrue(matches["severity_matches"])


if __name__ == '__main__':
    unittest.main()
