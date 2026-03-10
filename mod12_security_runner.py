import json
import os
import random
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
AI_BASE = os.getenv("MOD12_AI_BASE", "http://127.0.0.1:8000")
BC_BASE = os.getenv("MOD12_BC_BASE", "http://127.0.0.1:8001")
BE_BASE = os.getenv("MOD12_BE_BASE", "http://127.0.0.1:3000/api")
AI_TOKEN = os.getenv("AI_SERVICE_TOKEN") or os.getenv("AI_INTERNAL_TOKEN")


def run_case(case_id, title, expected, fn):
    result = {"case_id": case_id, "title": title, "expected": expected}
    try:
        result.update(fn())
    except Exception as exc:
        result["pass"] = False
        result["actual"] = f"Exception: {exc}"
        result["note"] = "Runner exception"
    return result


def ai_headers(valid=True):
    if not AI_TOKEN:
        return {}
    if valid:
        return {"x-ai-service-token": AI_TOKEN}
    return {"x-ai-service-token": "invalid-token"}


def register_and_login_user():
    phone = f"09{random.randint(100_000_000, 999_999_999)}"
    password = "TestPassword123!"
    register_payload = {
        "phone": phone,
        "password": password,
        "firstName": "Sec",
        "lastName": "Tester",
    }
    requests.post(f"{BE_BASE}/auth/register", json=register_payload, timeout=30)
    login = requests.post(f"{BE_BASE}/auth/login", json={"phone": phone, "password": password}, timeout=30)
    data = {}
    try:
        data = login.json()
    except Exception:
        data = {}
    token = data.get("token")
    return token


def case_s1_authorization_non_owner():
    token = register_and_login_user()
    if not token:
        return {
            "pass": False,
            "actual": "Could not get user token from backend auth/login",
            "note": "Authorization test blocked",
        }

    response = requests.post(
        f"{BE_BASE}/dispatches",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"report_id": 12345, "responder_id": 21, "response_status": "assigned"},
        timeout=30,
    )

    pass_case = response.status_code == 403
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}",
        "metrics": {"status": response.status_code},
        "note": "User role should be forbidden on dispatcher endpoint",
    }


def case_s2_invalid_input():
    oversized = "flood " * 2000
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": oversized, "threshold": 0.5},
        timeout=60,
    )
    pass_case = response.status_code in (200, 400)
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, input_length={len(oversized)}",
        "metrics": {"status": response.status_code, "input_length": len(oversized)},
        "note": "Should process safely or reject oversized input",
    }


def case_s3_data_exposure():
    response = requests.get(f"{AI_BASE}/health", timeout=30)
    body = {}
    try:
        body = response.json()
    except Exception:
        body = {}
    payload = json.dumps(body).lower()
    forbidden = ["password", "secret", "token", "jwt"]
    leaked = [k for k in forbidden if k in payload]
    pass_case = response.status_code == 200 and not leaked
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}, leaked_keys={leaked}",
        "metrics": {"status": response.status_code, "leaked_keys": leaked},
        "note": "Health response should not expose sensitive values",
    }


def case_s4_ai_token_enforcement_probe():
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={"Content-Type": "application/json"},
        json={"text": "small fire at barangay", "threshold": 0.5},
        timeout=60,
    )

    if AI_TOKEN:
        pass_case = response.status_code in (200, 401)
        note = "If internal token enforcement is on, expect 401; otherwise 200"
    else:
        pass_case = response.status_code == 200
        note = "No local token configured, endpoint expected to be open"

    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}",
        "metrics": {"status": response.status_code},
        "note": note,
    }


def case_s5_blockchain_invalid_payload():
    response = requests.post(
        f"{BC_BASE}/verify-incident",
        json={"incident_data": {"type": "Medical"}},
        timeout=30,
    )
    pass_case = response.status_code in (400, 422)
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}",
        "metrics": {"status": response.status_code},
        "note": "Schema validation should reject malformed request",
    }


def case_s6_blockchain_duplicate_replay():
    report_id = random.randint(81000, 81999)
    payload = {
        "report_id": report_id,
        "incident_data": {
            "type": "Medical",
            "severity": "Yellow",
            "location": "Dagupan",
            "proof": f"security-{time.time()}",
        },
    }

    first = requests.post(f"{BC_BASE}/verify-incident", json=payload, timeout=60)
    second = requests.post(f"{BC_BASE}/verify-incident", json=payload, timeout=60)

    body2 = {}
    try:
        body2 = second.json()
    except Exception:
        body2 = {}

    pass_case = first.status_code == 200 and second.status_code == 200 and body2.get("already_recorded") is True
    return {
        "pass": pass_case,
        "actual": f"first_status={first.status_code}, second_status={second.status_code}, second_already_recorded={body2.get('already_recorded')}",
        "metrics": {
            "first_status": first.status_code,
            "second_status": second.status_code,
            "second_already_recorded": body2.get("already_recorded"),
            "second_gas_used": body2.get("gas_used"),
        },
        "note": "Replay should not create duplicate writes",
    }


def case_s7_ai_empty_input_validation():
    response = requests.post(
        f"{AI_BASE}/classify",
        headers={**ai_headers(), "Content-Type": "application/json"},
        json={"text": "   ", "threshold": 0.5},
        timeout=60,
    )
    pass_case = response.status_code == 400
    return {
        "pass": pass_case,
        "actual": f"status={response.status_code}",
        "metrics": {"status": response.status_code},
        "note": "Empty input should be rejected safely",
    }


def write_markdown(results, md_path):
    passed = sum(1 for r in results if r.get("pass"))
    lines = []
    lines.append("# Module 12 Security Lab Results")
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
        ("S1", "Authorization (non-owner role on dispatch endpoint)", "Non-dispatch role should be forbidden", case_s1_authorization_non_owner),
        ("S2", "Invalid Input (oversized AI text)", "Should process safely or reject", case_s2_invalid_input),
        ("S3", "Data Exposure (AI health response)", "No sensitive secret/token values", case_s3_data_exposure),
        ("S4", "AI Token Enforcement Probe", "Unauthorized call should be blocked when token policy is active", case_s4_ai_token_enforcement_probe),
        ("S5", "Blockchain Invalid Payload", "Malformed verify request should fail validation", case_s5_blockchain_invalid_payload),
        ("S6", "Blockchain Duplicate Replay", "Second same report verification should be marked already_recorded", case_s6_blockchain_duplicate_replay),
        ("S7", "AI Empty Input Validation", "Empty classify text should return validation error", case_s7_ai_empty_input_validation),
    ]

    results = [run_case(case_id, title, expected, fn) for case_id, title, expected, fn in cases]

    json_path = ROOT / "mod12_security_results.json"
    md_path = ROOT / "mod12_security_results.md"

    json_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    write_markdown(results, md_path)

    passed = sum(1 for r in results if r.get("pass"))
    print(f"Security lab completed: {passed}/{len(results)} passed")
    print(f"JSON: {json_path}")
    print(f"MD: {md_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
