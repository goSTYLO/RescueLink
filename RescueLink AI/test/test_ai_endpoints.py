#!/usr/bin/env python3

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
AI_ROOT = ROOT / "RescueLink AI"
BACKEND_ROOT = ROOT / "Backend"

SAMPLE_TEXT = "May sunog sa barangay at may nasugatan, kailangan ng tulong agad."
AUDIO_GLOBS = [
    "RescueLink AI/test_audio_45sec.wav",
    "RescueLink AI/test/*.m4a",
    "Backend/uploads/incidents/*.wav",
    "Backend/uploads/incidents/*.m4a",
]


def _short_text(value: Optional[str], limit: int = 180) -> str:
    text = (value or "").strip().replace("\n", " ")
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def _top_confidences(confidence_scores: dict, top_n: int = 3) -> list[tuple[str, float]]:
    if not isinstance(confidence_scores, dict):
        return []
    sortable = []
    for key, value in confidence_scores.items():
        try:
            sortable.append((str(key), float(value)))
        except Exception:
            continue
    return sorted(sortable, key=lambda item: item[1], reverse=True)[:top_n]


def discover_audio(preferred: Optional[str]) -> Path:
    if preferred:
        candidate = Path(preferred)
        if not candidate.is_absolute():
            candidate = ROOT / preferred
        if candidate.exists():
            return candidate
        raise FileNotFoundError(f"Audio file not found: {candidate}")

    for pattern in AUDIO_GLOBS:
        matches = sorted(ROOT.glob(pattern))
        if matches:
            return matches[0]

    raise FileNotFoundError("No audio sample found in RescueLink AI/test or Backend/uploads/incidents")


def build_headers(ai_internal_token: Optional[str]) -> dict:
    headers = {}
    if ai_internal_token:
        headers["x-ai-service-token"] = ai_internal_token
    return headers


def request_json(method: str, url: str, headers: dict, **kwargs) -> tuple[bool, int, dict | str]:
    response = requests.request(method, url, headers=headers, timeout=120, **kwargs)
    try:
        payload = response.json()
    except Exception:
        payload = response.text
    return response.ok, response.status_code, payload


def print_result(name: str, ok: bool, status: int, started: float, payload: dict | str) -> bool:
    elapsed = time.time() - started
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {name} | status={status} | {elapsed:.2f}s")
    if not ok:
        if isinstance(payload, dict):
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        else:
            print(payload)
    return ok


def run_health(base_url: str, headers: dict) -> bool:
    started = time.time()
    ok, status, payload = request_json("GET", f"{base_url}/health", headers)
    if ok and isinstance(payload, dict):
        required = {"status", "model_loaded", "device"}
        ok = required.issubset(payload.keys())
    return print_result("GET /health", ok, status, started, payload)


def run_classify_text(base_url: str, headers: dict) -> bool:
    started = time.time()
    ok, status, payload = request_json(
        "POST",
        f"{base_url}/classify",
        headers={**headers, "Content-Type": "application/json"},
        json={"text": SAMPLE_TEXT, "threshold": 0.3},
    )
    if ok and isinstance(payload, dict):
        required = {"incident_types", "severity", "confidence_scores", "model_version"}
        ok = required.issubset(payload.keys()) and isinstance(payload.get("incident_types"), list)

    passed = print_result("POST /classify", ok, status, started, payload)
    if passed and isinstance(payload, dict):
        incident_types = payload.get("incident_types", [])
        severity = payload.get("severity", "unknown")
        top_scores = _top_confidences(payload.get("confidence_scores", {}))
        print(f"    Classification incident_types: {incident_types}")
        print(f"    Classification severity: {severity}")
        if top_scores:
            formatted = ", ".join(f"{label}={score:.3f}" for label, score in top_scores)
            print(f"    Classification top confidences: {formatted}")
    return passed


def run_transcribe(base_url: str, headers: dict, audio_path: Path) -> bool:
    started = time.time()
    with audio_path.open("rb") as file_handle:
        files = {"file": (audio_path.name, file_handle, "application/octet-stream")}
        ok, status, payload = request_json("POST", f"{base_url}/v1/transcribe", headers, files=files)
    if ok and isinstance(payload, dict):
        required = {"transcription", "duration", "latency_seconds", "confidence", "language"}
        ok = required.issubset(payload.keys())
        ok = ok and payload.get("transcription") not in (None, "")

    passed = print_result("POST /v1/transcribe", ok, status, started, payload)
    if passed and isinstance(payload, dict):
        print(f"    Transcription language: {payload.get('language')}")
        print(f"    Transcription confidence: {payload.get('confidence')}")
        print(f"    Transcription text: {_short_text(payload.get('transcription'))}")
    return passed


def run_classify_audio(base_url: str, headers: dict, audio_path: Path) -> bool:
    started = time.time()
    with audio_path.open("rb") as file_handle:
        files = {"file": (audio_path.name, file_handle, "application/octet-stream")}
        ok, status, payload = request_json(
            "POST",
            f"{base_url}/v1/classify-audio",
            headers,
            files=files,
            params={"threshold": 0.3},
        )
    if ok and isinstance(payload, dict):
        required = {
            "transcription",
            "duration",
            "transcription_latency_seconds",
            "incident_types",
            "severity",
            "confidence_scores",
        }
        ok = required.issubset(payload.keys())
        ok = ok and isinstance(payload.get("incident_types"), list)

    passed = print_result("POST /v1/classify-audio", ok, status, started, payload)
    if passed and isinstance(payload, dict):
        incident_types = payload.get("incident_types", [])
        severity = payload.get("severity", "unknown")
        top_scores = _top_confidences(payload.get("confidence_scores", {}))
        print(f"    Audio transcription text: {_short_text(payload.get('transcription'))}")
        print(f"    Audio classification incident_types: {incident_types}")
        print(f"    Audio classification severity: {severity}")
        if top_scores:
            formatted = ", ".join(f"{label}={score:.3f}" for label, score in top_scores)
            print(f"    Audio top confidences: {formatted}")
    return passed


def run_audio_stats(base_url: str, headers: dict) -> bool:
    started = time.time()
    ok, status, payload = request_json("GET", f"{base_url}/v1/audio/stats", headers)
    if ok and isinstance(payload, dict):
        required = {
            "total_requests",
            "successful_requests",
            "failed_requests",
            "success_rate",
            "total_audio_duration_minutes",
            "avg_latency_seconds",
        }
        ok = required.issubset(payload.keys())
    return print_result("GET /v1/audio/stats", ok, status, started, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="RescueLink AI endpoint smoke tests")
    parser.add_argument("--base-url", default=os.getenv("AI_TEST_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--audio", default=os.getenv("AI_TEST_AUDIO_PATH"), help="Absolute or repo-relative audio file")
    parser.add_argument("--token", default=os.getenv("AI_INTERNAL_TOKEN"), help="x-ai-service-token value")
    parser.add_argument("--skip-audio", action="store_true", help="Run only non-audio endpoint tests")
    args = parser.parse_args()

    load_dotenv(AI_ROOT / ".env")
    headers = build_headers(args.token or os.getenv("AI_INTERNAL_TOKEN", ""))

    print("=" * 72)
    print("RESCUELINK AI ENDPOINT TEST RUNNER")
    print("=" * 72)
    print(f"Base URL: {args.base_url}")

    audio_path = None
    if not args.skip_audio:
        audio_path = discover_audio(args.audio)
        print(f"Audio sample: {audio_path}")

    tests: list[tuple[str, bool]] = []
    tests.append(("health", run_health(args.base_url, headers)))
    tests.append(("classify", run_classify_text(args.base_url, headers)))

    if not args.skip_audio and audio_path is not None:
        tests.append(("transcribe", run_transcribe(args.base_url, headers, audio_path)))
        tests.append(("classify-audio", run_classify_audio(args.base_url, headers, audio_path)))
        tests.append(("audio-stats", run_audio_stats(args.base_url, headers)))

    passed = sum(1 for _, ok in tests if ok)
    total = len(tests)
    print("-" * 72)
    print(f"Summary: {passed}/{total} tests passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.exceptions.RequestException as error:
        print(f"Network error: {error}")
        raise SystemExit(1)
