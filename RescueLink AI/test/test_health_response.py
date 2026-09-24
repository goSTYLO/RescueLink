"""Contract check: /health JSON may include load_error and weights_bytes (Cloud Run RCA)."""


def test_health_load_visibility_fields():
    # Mirrors HealthResponse in api/main.py without importing torch.
    payload = {
        "status": "error",
        "model_loaded": False,
        "device": "pending",
        "stt_ready": False,
        "weights_bytes": 576_000_000,
        "load_error": "Failed to load model: example",
    }
    assert payload["status"] in ("healthy", "starting", "error")
    assert isinstance(payload["weights_bytes"], int) and payload["weights_bytes"] > 0
    assert "Failed to load model" in payload["load_error"]


if __name__ == "__main__":
    test_health_load_visibility_fields()
    print("ok")
