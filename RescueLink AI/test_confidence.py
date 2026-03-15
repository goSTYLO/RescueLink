"""
Quick script to test AI classification confidence.
Runs 10 text classifications via POST /classify and reports confidence levels.
Usage: python test_confidence.py [--url URL]
"""
import argparse
import sys
from pathlib import Path

import requests

# Sample Filipino/Taglish emergency texts for testing
SAMPLE_TEXTS = [
    "May sunog sa bahay, kailangan ng fire truck!",
    "Holdap may baril, may nasaktan!",
    "Motor naaksidente, nasugatan ang driver.",
    "Hindi humihinga ang tao, CPR needed!",
    "Baha na, tumataas ang tubig.",
    "May bata nawawala, nakita na.",
    "Pinatay ang biktima, deceased na.",
    "Small fire sa labas, na-control na.",
    "Heart attack, unconscious!",
    "Landslide, may na-bury na tao!",
]

LOW_CONFIDENCE_THRESHOLD = 0.7


def main():
    parser = argparse.ArgumentParser(description="Test AI classification confidence")
    parser.add_argument("--url", default="http://localhost:8000", help="AI server base URL")
    args = parser.parse_args()
    base_url = args.url.rstrip("/")
    endpoint = f"{base_url}/classify"

    print("=" * 60)
    print("AI Confidence Test (10 classifications via /classify)")
    print("=" * 60)
    print(f"Endpoint: {endpoint}\n")

    results = []
    for i, text in enumerate(SAMPLE_TEXTS, 1):
        try:
            resp = requests.post(
                endpoint,
                json={"text": text, "threshold": 0.5},
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as e:
            print(f"  [{i}] ERROR: {e}")
            results.append({"max_conf": 0, "fallback": True, "error": str(e)})
            continue

        scores = data.get("confidence_scores", {})
        max_conf = max(scores.values()) if scores else 0.0
        fallback = data.get("fallback_used", False)
        incident = data.get("incident_types", [])
        severity = data.get("severity", "?")

        low = max_conf < LOW_CONFIDENCE_THRESHOLD
        flag = " [LOW]" if low else ""
        fb = " (fallback)" if fallback else ""
        preview = text[:55] + "..." if len(text) > 55 else text

        print(f"  [{i}] {preview}")
        print(f"       -> {incident} | {severity} | max_conf={max_conf:.3f}{flag}{fb}")

        results.append({"max_conf": max_conf, "fallback": fallback})

    # Summary
    print("\n" + "-" * 60)
    if results:
        valid = [r for r in results if "error" not in r]
        if valid:
            avg = sum(r["max_conf"] for r in valid) / len(valid)
            low_count = sum(1 for r in valid if r["max_conf"] < LOW_CONFIDENCE_THRESHOLD)
            fb_count = sum(1 for r in valid if r["fallback"])
            print(f"Summary: avg max confidence = {avg:.3f}")
            print(f"         low confidence (<{LOW_CONFIDENCE_THRESHOLD}): {low_count}/{len(valid)}")
            print(f"         fallback used: {fb_count}/{len(valid)}")
        if len(valid) < len(results):
            print(f"         errors: {len(results) - len(valid)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
