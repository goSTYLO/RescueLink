import json
import os
import random
import statistics
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
AUDIO_DEFAULT = ROOT / "RescueLink AI" / "test" / "test_report_1.m4a"

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


def run_case(case_id, title, expected, fn):
    result = {
        "case_id": case_id,
        "title": title,
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


def case_p1_normal_input():
    text = "May minor road accident with one injured person near the highway."
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": text, "threshold": 0.5},
        timeout=60,
    )
    elapsed = now_ms() - t0
    ok = response.status_code == 200
    pass_case = ok and elapsed < 200
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed,2)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2)},
        "note": "Baseline normal text classify" if ok else "Request failed",
    }


def case_p2_long_input():
    long_text = "flood report " * 140
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": long_text, "threshold": 0.5},
        timeout=60,
    )
    elapsed = now_ms() - t0
    pass_case = response.status_code in (200, 400)
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed,2)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2), "length": len(long_text)},
        "note": "Accepted if processed or safely rejected",
    }


def case_p3_empty_input():
    t0 = now_ms()
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": "   ", "threshold": 0.5},
        timeout=60,
    )
    elapsed = now_ms() - t0
    pass_case = response.status_code == 400
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed,2)}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2)},
        "note": "Graceful validation expected",
    }


def case_p4_audio_latency():
    audio_path = AUDIO_DEFAULT
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio sample not found: {audio_path}")

    latencies = []
    statuses = []
    for _ in range(3):
        with audio_path.open("rb") as fh:
            t0 = now_ms()
            response = requests.post(
                f"{AI_BASE}/v1/classify-audio",
                headers=ai_headers(),
                files={"file": (audio_path.name, fh, "application/octet-stream")},
                timeout=180,
            )
            elapsed = now_ms() - t0
        latencies.append(elapsed)
        statuses.append(response.status_code)

    stats = summarize_ms(latencies)
    pass_case = all(code == 200 for code in statuses) and (stats["avg_ms"] is not None and stats["avg_ms"] < 8000)
    return {
        "pass": pass_case,
        "actual": f"statuses={statuses}, avg_ms={stats['avg_ms']}, p95_ms={stats['p95_ms']}",
        "metrics": {"statuses": statuses, **stats},
        "note": "Audio path performance profile",
    }


def verify_blockchain(report_id):
    payload = {
        "report_id": report_id,
        "incident_data": {
            "type": "Medical",
            "severity": "Yellow",
            "location": "Dagupan",
            "proof": f"mod12-{report_id}-{random.random()}",
        },
    }
    t0 = now_ms()
    response = requests.post(f"{BC_BASE}/verify-incident", json=payload, timeout=60)
    elapsed = now_ms() - t0
    body = {}
    try:
        body = response.json()
    except Exception:
        body = {}
    return response, body, elapsed


def case_p5_blockchain_single():
    report_id = random.randint(50000, 59999)
    response, body, elapsed = verify_blockchain(report_id)
    gas = body.get("gas_used")
    pass_case = response.status_code == 200 and gas is not None
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, latency_ms={round(elapsed,2)}, gas_used={gas}",
        "metrics": {"status": response.status_code, "latency_ms": round(elapsed, 2), "gas_used": gas},
        "note": "Single verify with gas visibility",
    }


def case_p6_blockchain_burst():
    latencies = []
    statuses = []
    for i in range(5):
        report_id = random.randint(60000, 69999) + i
        response, _body, elapsed = verify_blockchain(report_id)
        latencies.append(elapsed)
        statuses.append(response.status_code)

    stats = summarize_ms(latencies)
    error_rate = round((1 - (sum(1 for s in statuses if 200 <= s < 300) / len(statuses))) * 100, 2)
    pass_case = error_rate == 0 and stats["p95_ms"] is not None and stats["p95_ms"] < 3500
    return {
        "pass": pass_case,
        "actual": f"statuses={statuses}, error_rate={error_rate}%, avg_ms={stats['avg_ms']}, p95_ms={stats['p95_ms']}",
        "metrics": {"statuses": statuses, "error_rate": error_rate, **stats},
        "note": "Burst throughput/stability",
    }


def case_p7_blockchain_duplicate_gas_skip():
    report_id = random.randint(70000, 79999)
    first_response, first_body, first_elapsed = verify_blockchain(report_id)
    second_response, second_body, second_elapsed = verify_blockchain(report_id)

    second_already = second_body.get("already_recorded")
    second_gas = second_body.get("gas_used")
    pass_case = (
        first_response.status_code == 200
        and second_response.status_code == 200
        and second_already is True
        and second_gas == 0
    )
    return {
        "pass": pass_case,
        "actual": (
            f"first_status={first_response.status_code}, second_status={second_response.status_code}, "
            f"second_already_recorded={second_already}, second_gas_used={second_gas}, "
            f"first_ms={round(first_elapsed,2)}, second_ms={round(second_elapsed,2)}"
        ),
        "metrics": {
            "first_status": first_response.status_code,
            "second_status": second_response.status_code,
            "second_already_recorded": second_already,
            "second_gas_used": second_gas,
            "first_latency_ms": round(first_elapsed, 2),
            "second_latency_ms": round(second_elapsed, 2),
        },
        "note": "Duplicate write prevention and gas optimization",
    }


def write_markdown(results, md_path):
    passed = sum(1 for r in results if r.get("pass"))
    lines = []
    lines.append("# Module 12 Performance Lab Results")
    lines.append("")
    lines.append(f"Total passed: {passed}/{len(results)}")
    lines.append("")
    for r in results:
        mark = "PASS" if r.get("pass") else "FAIL"
        lines.append(f"## {r['case_id']} - {r['title']} [{mark}]")
        lines.append(f"Expected: {r['expected']}")
        lines.append(f"Actual: {r.get('actual')}")
        lines.append(f"Note: {r.get('note')}")
        lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    cases = [
        ("P1", "Normal Input (AI text classify)", "Response under 200ms", case_p1_normal_input),
        ("P2", "Long Input (AI text classify)", "Should process or safely reject", case_p2_long_input),
        ("P3", "Empty Input (AI text classify)", "Should gracefully reject invalid input", case_p3_empty_input),
        ("P4", "Audio Classification Latency", "3 runs should stay stable under 8s average", case_p4_audio_latency),
        ("P5", "Blockchain Single Verify", "Should return 200 with visible gas fields", case_p5_blockchain_single),
        ("P6", "Blockchain Burst Verify (5x)", "Error rate 0% and p95 under 3.5s", case_p6_blockchain_burst),
        ("P7", "Blockchain Duplicate Verify", "Second call should mark already_recorded=true and gas_used=0", case_p7_blockchain_duplicate_gas_skip),
    ]

    results = [run_case(case_id, title, expected, fn) for case_id, title, expected, fn in cases]

    json_path = ROOT / "mod12_performance_results.json"
    md_path = ROOT / "mod12_performance_results.md"

    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_markdown(results, md_path)

    passed = sum(1 for r in results if r.get("pass"))
    print(f"Performance lab completed: {passed}/{len(results)} passed")
    print(f"JSON: {json_path}")
    print(f"MD: {md_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
