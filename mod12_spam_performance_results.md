# Module 12 Performance Testing Lab – Test Results Log

| TEST CASE | STEPS (SHORT) | EXPECTED | ACTUAL (time/gas) | PASS/FAIL | NOTE |
|-----------|-----------------|----------|-------------------|-----------|------|
| P1: Normal Input | Enter standard text report | < 200ms | status=200, latency_ms=124.91 | ✓ PASS | Baseline normal text classify |
| P2: Long Input | Paste 1000+ characters | Process/Error | status=200, latency_ms=212.33, length=1900 | ✓ PASS | Accepted if processed or safely rejected |
| P3: Empty Input | Submit blank field | Handle gracefully | status=400, latency_ms=24.11 | ✓ PASS | Graceful validation expected |
| P4: AI Audio Throughput | Upload audio files of various durations | Process within reasonable time | statuses=[503, 503, 503], avg_ms=31.12, p95_ms=43.42 | ✗ FAIL | Audio test failed |
| P5: AI Audio Concurrent Load | Submit 5 simultaneous requests | Handle all without timeout | statuses=[503, 503, 503, 503, 503], error_rate=100.0%, avg_ms=75.85, p95_ms=106.77 | ✗ FAIL | All requests failed |
| P6: Blockchain Single Verify | Submit one report hash | < 3s, gas visible | status=200, latency_ms=179.93, gas_used=24212 | ✓ PASS | Single verify with gas visibility |
| P7: Blockchain Batch Verify | Submit 5 sequential verifications | 0% error, p95 < 3.5s | statuses=[200, 200, 200, 200, 200], error_rate=0.0%, avg_ms=129.08, p95_ms=155.01 | ✓ PASS | Batch verification throughput |

**Summary: 5/7 test cases passed**

## Class Sharing

- **Slowest case:** [Identify from results above]
- **Bottleneck identification:** [Audio processing or blockchain confirmation typically]