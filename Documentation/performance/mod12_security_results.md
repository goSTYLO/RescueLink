# Module 12 Security Lab Results

Total passed: 7/7

## S1 - Authorization (non-owner role on dispatch endpoint) [PASS]
Expected: Non-dispatch role should be forbidden
Actual: status=403
Note: User role should be forbidden on dispatcher endpoint

## S2 - Invalid Input (oversized AI text) [PASS]
Expected: Should process safely or reject
Actual: status=400, input_length=12000
Note: Should process safely or reject oversized input

## S3 - Data Exposure (AI health response) [PASS]
Expected: No sensitive secret/token values
Actual: status=200, leaked_keys=[]
Note: Health response should not expose sensitive values

## S4 - AI Token Enforcement Probe [PASS]
Expected: Unauthorized call should be blocked when token policy is active
Actual: status=200
Note: No local token configured, endpoint expected to be open

## S5 - Blockchain Invalid Payload [PASS]
Expected: Malformed verify request should fail validation
Actual: status=422
Note: Schema validation should reject malformed request

## S6 - Blockchain Duplicate Replay [PASS]
Expected: Second same report verification should be marked already_recorded
Actual: first_status=200, second_status=200, second_already_recorded=True
Note: Replay should not create duplicate writes

## S7 - AI Empty Input Validation [PASS]
Expected: Empty classify text should return validation error
Actual: status=400
Note: Empty input should be rejected safely
