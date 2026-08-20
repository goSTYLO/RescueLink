# Root Cause Analysis: Low Confidence Regression

## Summary
The AI classifier exhibits pervasive low-confidence predictions (max ~0.20) and triggers keyword fallback in most cases. This is caused by a **debug-style training run** being deployed as production artifacts.

## Evidence from Model Artifacts

### `models/training_config_used.json`
- **max_samples: 256** — Only 256 rows used for training (vs. intended 15k+)
- **epochs: 1** — Single epoch; model never converged
- **scheduler: "none"** — No learning rate scheduler
- **seed_list: "42"** — Single seed; no multi-seed validation

### `models/training_report.json`
- **type_f1_micro: 0.40** — Poor incident type classification (expected >0.99)
- **severity_accuracy: 0.25** — Random chance for 4 severity classes (expected ~1.0)
- **type_hamming_loss: 0.65** — High error rate on multi-label predictions

### `models/label_meta.json`
- **threshold: 0.2** — Calibrated low due to low model confidence; model outputs rarely exceed 0.3

## Runtime Behavior
- API logs show `Keyword fallback applied in /v1/classify-audio (low_confidence)` for almost all requests
- `Low confidence classification: 0.20 (threshold: 0.7)` — max confidence consistently below threshold
- Real-world Filipino/Taglish audio transcriptions produce low confidence because model was trained on insufficient data

## Root Cause
1. **Production model was trained with debug config** — `max_samples=256`, `epochs=1` likely used for quick smoke testing.
2. **Dataset mismatch** — `cleaned_emergency_dataset.csv` includes HF Alpaca data with long, non-local, non-dispatch-style text; model may not generalize to Filipino dispatch phrasing.
3. **No deployment gate** — Artifacts were replaced without validating metrics (F1, severity accuracy) against acceptance thresholds.

## Prevention Guardrails
- **Before replacing production model:** Require `type_f1_micro >= 0.95` and `severity_accuracy >= 0.95` in training report.
- **Always use production config:** `max_samples=0` (full data), `epochs >= 8`, `scheduler=step`, `seed_list=42,52,62`.
- **Validate dataset:** Run quality checks on generated dataset before training.
- **Confidence sanity check:** Run a small batch of test texts through API after deploy; flag if >20% trigger low-confidence fallback.
