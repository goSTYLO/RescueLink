# Module 12 Performance Lab Results

Total passed: 5/7

## P1 - Normal Input (AI text classify) [FAIL]
Expected: Response under 200ms
Actual: status=200, latency_ms=652.45
Note: Baseline normal text classify

## P2 - Long Input (AI text classify) [PASS]
Expected: Should process or safely reject
Actual: status=200, latency_ms=56.05
Note: Accepted if processed or safely rejected

## P3 - Empty Input (AI text classify) [PASS]
Expected: Should gracefully reject invalid input
Actual: status=400, latency_ms=37.54
Note: Graceful validation expected

## P4 - Audio Classification Latency [FAIL]
Expected: 3 runs should stay stable under 8s average
Actual: statuses=[200, 200, 200], avg_ms=26646.43, p95_ms=42781.98
Note: Audio path performance profile

## P5 - Blockchain Single Verify [PASS]
Expected: Should return 200 with visible gas fields
Actual: status=200, latency_ms=1599.65, gas_used=24212
Note: Single verify with gas visibility

## P6 - Blockchain Burst Verify (5x) [PASS]
Expected: Error rate 0% and p95 under 3.5s
Actual: statuses=[200, 200, 200, 200, 200], error_rate=0.0%, avg_ms=121.35, p95_ms=144.9
Note: Burst throughput/stability

## P7 - Blockchain Duplicate Verify [PASS]
Expected: Second call should mark already_recorded=true and gas_used=0
Actual: first_status=200, second_status=200, second_already_recorded=True, second_gas_used=0, first_ms=97.05, second_ms=64.39
Note: Duplicate write prevention and gas optimization
