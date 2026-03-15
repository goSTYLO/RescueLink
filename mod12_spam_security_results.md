# Module 12 Security Testing Lab – Security Test Results

| TEST CASE | STEPS (SHORT) | EXPECTED | ACTUAL | PASS/FAIL | NOTE |
|-----------|---------------|----------|--------|-----------|------|
| S1: Authorization | Call restricted function as non-owner | Revert 'Not Auth' | status=403 | ✓ PASS | User role should be forbidden on dispatcher endpoint |
| S2: Invalid Input | Send oversized text payload | Revert/Safe Handle | status=400, input_length=24000 | ✓ PASS | Should process safely or reject oversized input |
| S3: Data Exposure | Check logs for secrets | No sensitive leaks | status=200, leaked_keys=[] | ✓ PASS | Health response should not expose sensitive values |
| S4: AI Adversarial Bypass | Submit obfuscated spam text | Still detect as spam | Tested 5 adversarial inputs, 5 handled safely | ✓ PASS | Adversarial input handling |
| S5: Audio Security Validation | Upload malformed audio file | Reject or handle safely | status=503 | ✗ FAIL | Malformed audio should be rejected or handled safely |
| S6: Blockchain Replay Attack | Submit same report twice | already_recorded, gas=0 | first_status=200, second_status=200, already_recorded=True, gas_used=0 | ✓ PASS | Replay should not create duplicate writes or consume gas |
| S7: Blockchain Unauthorized Access | Access without proper auth | 401/403, no data | health_status=200, invalid_payload_status=422 | ✓ PASS | Unauthorized/malformed requests should be rejected |

**Summary: 6/7 test cases passed**

## Class Sharing

- **Most concerning risk:** [Identify from results]
- **Risk assessment:** [Critical vulnerability or minor issue]