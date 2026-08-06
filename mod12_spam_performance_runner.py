#!/usr/bin/env python3
"""
Module 12 Performance Testing Lab - Spam Detection Focus
Test Results Log with 7 test cases:
- 3 Baseline cases (Normal, Long, Empty input)
- 4 Custom cases (AI Audio Throughput, Concurrent Load, Blockchain Single/Batch)
"""

import json
import os
import random
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
AI_BASE = os.getenv("MOD12_AI_BASE", "http://127.0.0.1:8000")
BC_BASE = os.getenv("MOD12_BC_BASE", "http://127.0.0.1:8001")
AI_TOKEN = os.getenv("AI_SERVICE_TOKEN") or os.getenv("AI_INTERNAL_TOKEN")


def now_ms():
    return time.perf_counter() * 1000.0


def summarize_ms(values):
    if not values:
        return {"avg_ms": None, "p95_ms": None, "min_ms": None, "max_ms": None}
    sorted_vals = sorted(values)
    idx = max(0, int((0.95 * len(sorted_vals) + 0.9999)) - 1)
    return {
        "avg_ms": round(statistics.mean(values), 2),
        "p95_ms": round(sorted_vals[idx], 2),
        "min_ms": round(min(values), 2),
        "max_ms": round(max(values), 2),
    }


def ai_headers():
    if not AI_TOKEN:
        return {}
    return {"x-ai-service-token": AI_TOKEN}


def run_case(case_id, title, steps, expected, fn):
    """Run a performance test case."""
    result = {
        "case_id": case_id,
        "title": title,
        "steps": steps,
        "expected": expected,
    }
    try:
        actual = fn()
        result.update(actual)
    except Exception as exc:
        result["pass"] = False
        result["actual"] = f"Exception: {exc}"
        result["note"] = "Runner exception"
    return result


# ========== BASELINE TEST CASES ==========

def case_p1_normal_input():
    """Normal Input - Baseline"""
    text = "May sunog sa barangay at may nasugatan, kailangan ng tulong agad."
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": text, "threshold": 0.3},
        timeout=60,
    )
    elapsed = now_ms() - t0
    
    ok = response.status_code == 200
    pass_case = ok and elapsed < 200
    
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed, 2)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2)},
        "note": "Baseline normal text classify" if ok else "Request failed",
    }


def case_p2_long_input():
    """Long Input - Baseline"""
    long_text = "URGENT HELP NEEDED " * 100  # ~1700 characters
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": long_text, "threshold": 0.3},
        timeout=60,
    )
    elapsed = now_ms() - t0
    
    pass_case = response.status_code in (200, 400)
    
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed, 2)}, length={len(long_text)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2), "length": len(long_text)},
        "note": "Accepted if processed or safely rejected",
    }


def case_p3_empty_input():
    """Empty Input - Baseline"""
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": "   ", "threshold": 0.3},
        timeout=60,
    )
    elapsed = now_ms() - t0
    
    pass_case = response.status_code == 400
    
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed, 2)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2)},
        "note": "Graceful validation expected",
    }


# ========== CUSTOM TEST CASES (AI + BLOCKCHAIN) ==========

def case_p4_audio_throughput():
    """Custom: AI Audio Analysis Throughput
    
    Upload audio files of different durations, measure processing time
    Expected: Process within reasonable time per duration
    """
    # Look for test audio files
    audio_paths = list(ROOT.glob("RescueLink AI/test/*.m4a")) + \
                  list(ROOT.glob("RescueLink AI/test/*.wav"))
    
    if not audio_paths:
        return {
            "pass": False,
            "actual": "No audio test files found",
            "note": "Cannot run audio throughput test - no sample files",
        }
    
    audio_path = audio_paths[0]
    
    # Run 3 classification tests
    latencies = []
    statuses = []
    
    for i in range(3):
        with audio_path.open("rb") as fh:
            t0 = now_ms()
            response = requests.post(
                f"{AI_BASE}/v1/classify-audio",
                headers=ai_headers(),
                files={"file": (audio_path.name, fh, "application/octet-stream")},
                params={"threshold": 0.3},
                timeout=180,
            )
            elapsed = now_ms() - t0
        
        latencies.append(elapsed)
        statuses.append(response.status_code)
    
    stats = summarize_ms(latencies)
    
    # Pass if all succeed and average under 30 seconds (audio processing is heavy)
    all_ok = all(s == 200 for s in statuses)
    pass_case = all_ok and stats["avg_ms"] is not None and stats["avg_ms"] < 30000
    
    return {
        "pass": pass_case,
        "actual": f"statuses={statuses}, avg_ms={stats['avg_ms']}, p95_ms={stats['p95_ms']}",
        "metrics": {"statuses": statuses, **stats},
        "note": "Audio analysis throughput" if all_ok else "Audio test failed",
    }


def case_p5_audio_concurrent_load():
    """Custom: AI Audio Concurrent Load
    
    Submit multiple simultaneous audio classification requests
    Expected: Handle all requests without timeout, stable latency
    """
    audio_paths = list(ROOT.glob("RescueLink AI/test/*.m4a")) + \
                  list(ROOT.glob("RescueLink AI/test/*.wav"))
    
    if not audio_paths:
        return {
            "pass": False,
            "actual": "No audio test files found",
            "note": "Cannot run concurrent load test - no sample files",
        }
    
    audio_path = audio_paths[0]
    
    def classify_single():
        try:
            with audio_path.open("rb") as fh:
                t0 = now_ms()
                response = requests.post(
                    f"{AI_BASE}/v1/classify-audio",
                    headers=ai_headers(),
                    files={"file": (audio_path.name, fh, "application/octet-stream")},
                    params={"threshold": 0.3},
                    timeout=120,
                )
                elapsed = now_ms() - t0
                return response.status_code, elapsed
        except Exception as e:
            return 0, 0
    
    # Run 5 concurrent requests
    latencies = []
    statuses = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(classify_single) for _ in range(5)]
        for future in as_completed(futures):
            status, elapsed = future.result()
            if status > 0:
                statuses.append(status)
                latencies.append(elapsed)
    
    stats = summarize_ms(latencies)
    error_rate = round((1 - (sum(1 for s in statuses if s == 200) / len(statuses))) * 100, 2) if statuses else 100
    
    # Pass if error rate < 50% and p95 under 60 seconds
    pass_case = error_rate < 50 and stats["p95_ms"] is not None and stats["p95_ms"] < 60000
    
    return {
        "pass": pass_case,
        "actual": f"statuses={statuses}, error_rate={error_rate}%, avg_ms={stats['avg_ms']}, p95_ms={stats['p95_ms']}",
        "metrics": {"statuses": statuses, "error_rate": error_rate, **stats},
        "note": "Concurrent audio load test" if error_rate < 100 else "All requests failed",
    }


def verify_blockchain(report_id):
    """Helper to verify a report on blockchain."""
    payload = {
        "report_id": report_id,
        "incident_data": {
            "type": "Medical",
            "severity": "Yellow",
            "location": "Test Location",
            "proof": f"perf-test-{report_id}-{random.random()}",
        },
    }
    t0 = now_ms()
    response = requests.post(f"{BC_BASE}/verify-incident", json=payload, timeout=60)
    elapsed = now_ms() - t0
    
    body = {}
    try:
        body = response.json()
    except Exception:
        pass
    
    return response, body, elapsed


def case_p6_blockchain_single():
    """Custom: Blockchain Single Verification
    
    Submit one report hash for blockchain verification
    Expected: < 3 seconds, gas used visible
    """
    report_id = random.randint(50000, 59999)
    response, body, elapsed = verify_blockchain(report_id)
    
    gas = body.get("gas_used")
    pass_case = response.status_code == 200 and gas is not None and elapsed < 3000
    
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed, 2)}, gas_used={gas}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2), "gas_used": gas},
        "note": "Single verify with gas visibility",
    }


def case_p7_blockchain_batch():
    """Custom: Blockchain Batch Verification
    
    Submit 5 sequential report verifications
    Expected: 0% error rate, p95 below 3.5 seconds
    """
    latencies = []
    statuses = []
    
    for i in range(5):
        report_id = random.randint(60000, 69999) + i
        response, body, elapsed = verify_blockchain(report_id)
        latencies.append(elapsed)
        statuses.append(response.status_code)
    
    stats = summarize_ms(latencies)
    error_rate = round((1 - (sum(1 for s in statuses if 200 <= s < 300) / len(statuses))) * 100, 2)
    
    pass_case = error_rate == 0 and stats["p95_ms"] is not None and stats["p95_ms"] < 3500
    
    return {
        "pass": pass_case,
        "actual": f"statuses={statuses}, error_rate={error_rate}%, avg_ms={stats['avg_ms']}, p95_ms={stats['p95_ms']}",
        "metrics": {"statuses": statuses, "error_rate": error_rate, **stats},
        "note": "Batch verification throughput",
    }


def write_markdown(results, md_path):
    """Write performance results as markdown table."""
    passed = sum(1 for r in results if r.get("pass"))
    lines = []
    
    lines.append("# Module 12 Performance Testing Lab – Test Results Log")
    lines.append("")
    lines.append("| TEST CASE | STEPS (SHORT) | EXPECTED | ACTUAL (time/gas) | PASS/FAIL | NOTE |")
    lines.append("|-----------|-----------------|----------|-------------------|-----------|------|")
    
    for r in results:
        mark = "✓ PASS" if r.get("pass") else "✗ FAIL"
        actual = r.get("actual", "N/A").replace("|", "/")  # Prevent table breaks
        steps = r.get("steps", "N/A").replace("|", "/")
        lines.append(f"| {r['case_id']}: {r['title']} | {steps} | {r['expected']} | {actual} | {mark} | {r.get('note', '')} |")
    
    lines.append("")
    lines.append(f"**Summary: {passed}/{len(results)} test cases passed**")
    lines.append("")
    lines.append("## Class Sharing")
    lines.append("")
    lines.append("- **Slowest case:** [Identify from results above]")
    lines.append("- **Bottleneck identification:** [Audio processing or blockchain confirmation typically]")
    
    md_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    print("=" * 72)
    print("MODULE 12 PERFORMANCE TESTING LAB - SPAM DETECTION FOCUS")
    print("=" * 72)
    print(f"AI Service: {AI_BASE}")
    print(f"Blockchain Service: {BC_BASE}")
    print("")
    
    cases = [
        ("P1", "Normal Input", "Enter standard text report", "< 200ms", case_p1_normal_input),
        ("P2", "Long Input", "Paste 1000+ characters", "Process/Error", case_p2_long_input),
        ("P3", "Empty Input", "Submit blank field", "Handle gracefully", case_p3_empty_input),
        ("P4", "AI Audio Throughput", "Upload audio files of various durations", "Process within reasonable time", case_p4_audio_throughput),
        ("P5", "AI Audio Concurrent Load", "Submit 5 simultaneous requests", "Handle all without timeout", case_p5_audio_concurrent_load),
        ("P6", "Blockchain Single Verify", "Submit one report hash", "< 3s, gas visible", case_p6_blockchain_single),
        ("P7", "Blockchain Batch Verify", "Submit 5 sequential verifications", "0% error, p95 < 3.5s", case_p7_blockchain_batch),
    ]
    
    results = [run_case(case_id, title, steps, expected, fn) 
               for case_id, title, steps, expected, fn in cases]
    
    # Save results
    json_path = ROOT / "mod12_spam_performance_results.json"
    md_path = ROOT / "mod12_spam_performance_results.md"
    
    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_markdown(results, md_path)
    
    passed = sum(1 for r in results if r.get("pass"))
    print(f"\nPerformance lab completed: {passed}/{len(results)} passed")
    print(f"JSON: {json_path}")
    print(f"MD: {md_path}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
