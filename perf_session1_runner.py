import json
import random
import statistics
import time
import hashlib
import csv
import ast
import os
from pathlib import Path

import requests


def summarize(times, statuses):
    if not times:
        return {"avg": None, "p95": None, "error_rate": None}
    sorted_times = sorted(times)
    p95_index = max(0, int((0.95 * len(sorted_times) + 0.9999)) - 1)
    p95 = sorted_times[p95_index]
    ok_count = sum(1 for code in statuses if 200 <= code < 300)
    return {
        "avg": round(statistics.mean(times), 3),
        "p95": round(p95, 3),
        "error_rate": round((1 - ok_count / len(statuses)) * 100, 2),
    }


def health_checks():
    urls = [
        "http://localhost:3000/health",
        "http://localhost:8000/health",
        "http://localhost:8001/health",
    ]
    output = {}
    for url in urls:
        try:
            response = requests.get(url, timeout=8)
            output[url] = {"status": response.status_code, "ok": response.ok}
        except Exception as exc:
            output[url] = {"status": None, "ok": False, "error": str(exc)}
    return output


def run_ai_cases():
    ai_cases = {
        "AI-1": Path(r"c:/Users/Aaron/GitHub Repos/RescueLink/RescueLink AI/test/test_report_1.m4a"),
        "AI-2": Path(r"c:/Users/Aaron/GitHub Repos/RescueLink/RescueLink AI/test/test_report_2.m4a"),
    }
    ai_token = os.getenv("AI_SERVICE_TOKEN")

    def parse_label_list(raw_value):
        if not raw_value:
            return []
        try:
            parsed = ast.literal_eval(raw_value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception:
            pass
        return []

    def choose_long_text_sample():
        dataset_path = Path(r"c:/Users/Aaron/GitHub Repos/RescueLink/RescueLink AI/data/cleaned_emergency_dataset.csv")
        if not dataset_path.exists():
            return {
                "id": None,
                "text": "Emergency report: multiple injuries after collision with severe bleeding and unstable patients needing urgent responders.",
                "incident_types": ["Accident", "Medical"],
                "severity": "Red",
                "text_length": 123,
            }

        best_row = None
        with dataset_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                text = (row.get("text") or "").strip()
                incident_types = parse_label_list(row.get("incident_types"))
                text_len = len(text)
                has_domain_label = any(label != "Other" for label in incident_types)
                is_candidate = text_len >= 180 and has_domain_label
                if not is_candidate:
                    continue
                if best_row is None or text_len > best_row["text_length"]:
                    best_row = {
                        "id": row.get("id"),
                        "text": text,
                        "incident_types": incident_types,
                        "severity": (row.get("severity") or "").strip(),
                        "text_length": text_len,
                    }

        if best_row is not None:
            return best_row

        fallback_row = None
        with dataset_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                text = (row.get("text") or "").strip()
                text_len = len(text)
                if fallback_row is None or text_len > fallback_row["text_length"]:
                    fallback_row = {
                        "id": row.get("id"),
                        "text": text,
                        "incident_types": parse_label_list(row.get("incident_types")),
                        "severity": (row.get("severity") or "").strip(),
                        "text_length": text_len,
                    }

        return fallback_row or {
            "id": None,
            "text": "Emergency report: severe flooding and injuries across multiple households; urgent rescue required.",
            "incident_types": ["Natural Disaster", "Medical"],
            "severity": "Red",
            "text_length": 103,
        }

    output = {}
    for case_id, file_path in ai_cases.items():
        runs = []
        times = []
        statuses = []
        for run_no in range(1, 4):
            start = time.perf_counter()
            with file_path.open("rb") as handle:
                response = requests.post(
                    "http://localhost:8000/v1/classify-audio",
                    files={"file": (file_path.name, handle)},
                    headers={"x-ai-service-token": ai_token} if ai_token else None,
                    timeout=180,
                )
            elapsed = time.perf_counter() - start
            times.append(elapsed)
            statuses.append(response.status_code)
            runs.append(
                {
                    "run": run_no,
                    "status": response.status_code,
                    "time": round(elapsed, 3),
                }
            )
        output[case_id] = {"runs": runs, **summarize(times, statuses)}

    long_text_sample = choose_long_text_sample()
    ai3_runs = []
    ai3_times = []
    ai3_statuses = []
    expected_types = set(long_text_sample.get("incident_types") or [])
    expected_severity = long_text_sample.get("severity")
    for run_no in range(1, 4):
        start = time.perf_counter()
        response = requests.post(
            "http://localhost:8000/classify",
            json={
                "text": long_text_sample["text"],
                "threshold": 0.5,
            },
            headers={"x-ai-service-token": ai_token} if ai_token else None,
            timeout=120,
        )
        elapsed = time.perf_counter() - start
        ai3_times.append(elapsed)
        ai3_statuses.append(response.status_code)

        predicted_types = []
        predicted_severity = None
        fallback_used = None
        type_overlap_count = 0
        severity_match = None
        if response.ok:
            body = response.json()
            predicted_types = body.get("incident_types") or []
            predicted_severity = body.get("severity")
            fallback_used = body.get("fallback_used")
            type_overlap_count = len(expected_types.intersection(set(predicted_types))) if expected_types else 0
            severity_match = (predicted_severity == expected_severity) if expected_severity else None

        ai3_runs.append(
            {
                "run": run_no,
                "status": response.status_code,
                "time": round(elapsed, 3),
                "predicted_types": predicted_types,
                "predicted_severity": predicted_severity,
                "fallback_used": fallback_used,
                "type_overlap_count": type_overlap_count,
                "severity_match": severity_match,
            }
        )

    output["AI-3"] = {
        "mode": "text_only",
        "dataset_sample": {
            "id": long_text_sample.get("id"),
            "text_length": long_text_sample.get("text_length"),
            "expected_incident_types": long_text_sample.get("incident_types") or [],
            "expected_severity": long_text_sample.get("severity"),
        },
        "runs": ai3_runs,
        **summarize(ai3_times, ai3_statuses),
    }
    return output


def rpc_gas_used(tx_hash):
    rpc_urls = ["http://127.0.0.1:8545", "http://127.0.0.1:7545"]
    for rpc_url in rpc_urls:
        try:
            body = {
                "jsonrpc": "2.0",
                "method": "eth_getTransactionReceipt",
                "params": [tx_hash],
                "id": 1,
            }
            response = requests.post(rpc_url, json=body, timeout=8)
            payload = response.json()
            gas_hex = (payload.get("result") or {}).get("gasUsed")
            if gas_hex:
                return int(gas_hex, 16)
        except Exception:
            continue
    return None


def build_blockchain_payload(prefix, index):
    return {
        "report_id": 20000 + index,
        "incident_data": {
            "type": "Medical",
            "severity": "Yellow",
            "location": "Dagupan",
            "proof": hashlib.sha256(f"{prefix}-{time.time()}-{random.random()}".encode()).hexdigest(),
        },
    }


def run_blockchain_case(run_count, prefix):
    runs = []
    times = []
    statuses = []
    gases = []
    for i in range(1, run_count + 1):
        payload = build_blockchain_payload(prefix, i)
        start = time.perf_counter()
        response = requests.post("http://localhost:8001/verify-incident", json=payload, timeout=60)
        elapsed = time.perf_counter() - start

        tx_hash = None
        gas = None
        if response.ok:
            body = response.json()
            tx_hash = body.get("tx_hash")
            gas = body.get("gas_used")
            if tx_hash and gas is None:
                gas = rpc_gas_used(tx_hash)

        runs.append(
            {
                "run": i,
                "status": response.status_code,
                "time": round(elapsed, 3),
                "tx_hash": tx_hash,
                "gas": gas,
            }
        )
        times.append(elapsed)
        statuses.append(response.status_code)
        if gas is not None:
            gases.append(gas)

    result = {"runs": runs, **summarize(times, statuses)}
    if gases:
        result["gas_avg"] = round(statistics.mean(gases), 0)
        result["gas_min"] = min(gases)
        result["gas_max"] = max(gases)
    else:
        result["gas_avg"] = None
        result["gas_min"] = None
        result["gas_max"] = None
    return result


def run_backend_smoke():
    output = {}
    phone = f"09{random.randint(100_000_000, 999_999_999)}"
    register_payload = {
        "phone": phone,
        "password": "TestPassword123!",
        "firstName": "Perf",
        "lastName": "Tester",
    }

    try:
        response = requests.post("http://localhost:3000/api/auth/register", json=register_payload, timeout=20)
        output["register"] = {"status": response.status_code, "body": response.text[:300]}
    except Exception as exc:
        output["register"] = {"status": None, "error": str(exc)}

    try:
        response = requests.post(
            "http://localhost:3000/api/auth/login",
            json={"phone": phone, "password": "TestPassword123!"},
            timeout=20,
        )
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        token = body.get("token") if isinstance(body, dict) else None
        output["login"] = {"status": response.status_code, "has_token": bool(token)}
    except Exception as exc:
        output["login"] = {"status": None, "error": str(exc)}
        token = None

    if token:
        endpoint = "http://localhost:3000/api/incidents/emergency"
        times = []
        statuses = []
        runs = []
        for i in range(1, 4):
            payload = {"latitude": 16.0433, "longitude": 120.3333}
            start = time.perf_counter()
            response = requests.post(endpoint, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=20)
            elapsed = time.perf_counter() - start
            times.append(elapsed)
            statuses.append(response.status_code)
            runs.append({"run": i, "status": response.status_code, "time": round(elapsed, 3)})
        output["BE-1"] = {"runs": runs, **summarize(times, statuses)}

        audio_endpoint = "http://localhost:3000/api/incidents/with-audio"
        backend_audio_cases = {
            "BE-2": Path(r"c:/Users/Aaron/GitHub Repos/RescueLink/RescueLink AI/test/test_report_1.m4a"),
            "BE-3": Path(r"c:/Users/Aaron/GitHub Repos/RescueLink/RescueLink AI/test/test_report_2.m4a"),
        }

        for case_id, audio_path in backend_audio_cases.items():
            case_times = []
            case_statuses = []
            case_runs = []
            for i in range(1, 4):
                start = time.perf_counter()
                with audio_path.open("rb") as handle:
                    response = requests.post(
                        audio_endpoint,
                        headers={"Authorization": f"Bearer {token}"},
                        files={"audio": (audio_path.name, handle, "audio/mp4")},
                        data={
                            "latitude": "16.0433",
                            "longitude": "120.3333",
                            "description": f"Performance baseline run {case_id}",
                        },
                        timeout=120,
                    )
                elapsed = time.perf_counter() - start
                case_times.append(elapsed)
                case_statuses.append(response.status_code)
                case_runs.append({"run": i, "status": response.status_code, "time": round(elapsed, 3)})
            output[case_id] = {"runs": case_runs, **summarize(case_times, case_statuses)}
    else:
        output["BE-1"] = {"runs": [], "avg": None, "p95": None, "error_rate": None, "blocked": "No auth token"}
        output["BE-2"] = {"runs": [], "avg": None, "p95": None, "error_rate": None, "blocked": "No auth token"}
        output["BE-3"] = {"runs": [], "avg": None, "p95": None, "error_rate": None, "blocked": "No auth token"}

    return output


def main():
    payload = {
        "health": health_checks(),
        "ai": run_ai_cases(),
        "blockchain": {
            "BC-1": run_blockchain_case(3, "bc1"),
            "BC-2": run_blockchain_case(5, "bc2"),
            "BC-3": run_blockchain_case(10, "bc3"),
        },
        "backend": run_backend_smoke(),
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
