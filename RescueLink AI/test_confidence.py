"""
Quick script to test AI classification confidence.
Runs 10 text classifications via POST /classify and reports confidence levels.
Usage: python test_confidence.py [--url URL]
"""
import argparse
import sys
from pathlib import Path

import requests

# Sample Filipino/Taglish emergency texts for testing (humanized, less keyword-heavy)
SAMPLE_TEXTS = [
    "Boss nasusunog yung bahay ng kapitbahay namin, may usok na tumataas at hindi makalabas ang mga tao. pls.",
    "Sir may nag-holdap sa jeep kanina, may dala daw baril at may nagsaksak po sa isang pasahero.",
    "Ma'am naaksidente ang motor sa kanto, yung driver may sugat sa ulo at hindi makabangon. Padala agad.",
    "Tulong! May tao dito na hindi humihinga, wala na raw pulso. Kailangan ng ambulance agad.",
    "Boss tumataas na yung tubig sa kalsada, may mga bahay na naabot na po. Hindi na makalabas ang iba.",
    "Yung nawawalang bata kanina, nakita na po namin sa tindahan. Okay na po.",
    "Sir nakita ang biktima na wala nang pulso, parang na-stab po. Hindi na humihinga.",
    "Yung maliit na apoy sa labas kanina, na-control na namin. Walang nasaktan.",
    "Ma'am may matanda dito na biglang bumagsak, hindi na gumagalaw. Parang atake sa puso.",
    "Tulong! May natabunan ng lupa sa tabi ng bundok, may tao pa raw sa loob. Bilisan po!",
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
