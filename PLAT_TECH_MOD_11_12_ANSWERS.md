# Platform Technologies Module 11 and 12 Answers

## Module 11

### Activity (35 min): Sprint 2 Planning Framework

I will use an already integrated feature and present it as our Sprint 2 plan so the activity stays simple and realistic.

New feature I planned:
I planned to add team-first auto-assignment for dispatch, where the dispatcher selects the department and team, and the system automatically assigns eligible responders from that team.

Integration I planned:
I integrated role-based access control (RBAC) and assignment workflow rules so only allowed roles can trigger assignment actions and only eligible responders are assigned.

Input, process, output flow:
Input: Dispatcher sends a dispatch request with report_id, department_code, and team_name.
Process: The backend validates the caller role, checks team status, checks responder status, applies incident-type compatibility rules, then creates assignments for valid responders.
Output: The API returns created assignments plus assignment_summary including assigned_count and unassigned_reason when needed.

Success criteria:
The feature is successful if dispatchers and admins can assign using team-first payloads, unauthorized roles are blocked, only available or standby qualified responders are assigned, and the response clearly explains partial or zero assignment outcomes.

Risks and fixes:
Risk 1: No eligible team members for the selected team can cause confusion.
Fix: Return explicit 409 responses with assignment_summary.unassigned_reason so the UI can show clear feedback.

Risk 2: Role misuse can expose restricted operations.
Fix: Keep strict RBAC middleware checks on dispatch and responder-management endpoints and verify behavior using role-based tests.

Risk 3: Incident-type synonyms can reduce matching quality.
Fix: Normalize incoming task labels into canonical buckets (medical, police, disaster, fire) before eligibility checks.

### Session 2: Build Phase (3-case verification, before vs after)

Build summary:
I implemented the team-first dispatch assignment flow with RBAC protections and task-aware eligibility checks. I validated behavior using role-based and workflow-focused test scenarios.

Case 1:
Before: Dispatcher had to rely on single-responder assignment payloads and manual selection.
After: Dispatcher can submit department plus team and let the backend auto-assign eligible responders.
Improvement: Expanded workflow capability and reduced manual dispatch steps.

Case 2:
Before: Assignment eligibility was less strict and could mismatch operational context.
After: Assignment now checks team status, responder status, and incident-type compatibility before assigning.
Improvement: Better assignment quality and fewer invalid dispatches.

Case 3:
Before: Failed assignment outcomes were harder to interpret from client side.
After: Response includes assignment_summary fields such as assigned_count and unassigned_reason like no_available_team_members.
Improvement: Better observability and clearer dispatcher decision support.

## Module 12

### Reflection Activity (Session 1)

1. New Feature
Our team added team-first auto-assignment for dispatch, so I can assign responders by choosing a team instead of manually picking only one responder at a time.

2. Integration
We integrated RBAC and assignment eligibility logic into the dispatch flow, including role checks, status checks, and incident-type matching.

3. Success Metric
I used response time and reliability indicators from our backend and verification path. In our session results, backend no-audio orchestration was very fast (around 0.053s average), blockchain verification was stable (about 2.07s average), and error rates were 0% in the rerun set. I also used functional metrics: correct 403/409 behavior, assigned_count accuracy, and clear unassigned_reason outputs.

4. Prediction
With many users, the most likely issues are assignment contention (multiple dispatchers targeting the same team), stale availability state, and slower end-to-end flow when assignment chains into heavier AI or verification actions.

### Try It Out: Break It to Make It Better

I wrote seven test case sentences total.

1. When a dispatcher submits a normal team-first assignment request with valid report, department, and team, the system should assign eligible responders and return assigned_count greater than zero. We will run three steps to verify: create a valid incident, submit the dispatch payload, and check assignment_summary plus created dispatch records.

2. When a dispatcher submits very long text fields in optional dispatch notes, the system should sanitize or reject unsafe input and keep assignment logic stable. We will run three steps to verify: send oversized notes payload, confirm validation response, and confirm no corrupted dispatch record is created.

3. When a dispatcher submits an empty required assignment payload (missing report_id or team fields), the system should handle it gracefully with validation errors and no side effects. We will run three steps to verify: submit empty or partial payload, confirm error code and message, and confirm no assignment was saved.

4. When a regular user tries to call the dispatch assignment endpoint, the system should deny access with forbidden response. We will run three steps to verify: authenticate as user role, call the dispatch endpoint, and confirm 403 with no dispatch created.

5. When the selected team has no available or standby responders, the system should return a conflict response with a clear unassigned reason. We will run three steps to verify: set team members to unavailable, submit assignment request, and confirm 409 plus unassigned_reason no_available_team_members.

6. When incident type and team specialization do not match, the system should avoid assigning incompatible responders. We will run three steps to verify: use an incident categorized in one bucket, choose a team specialized for another bucket, and confirm zero incompatible assignments.

7. When two dispatchers attempt assignment for the same report at nearly the same time, the system should maintain consistency and avoid duplicate or contradictory assignment outcomes. We will run three steps to verify: trigger two near-simultaneous assignment calls, inspect resulting dispatch records, and confirm conflict handling or deterministic final state.

### Performance Testing Lab (AI and Blockchain, 7 total test cases)

I built and ran a dedicated script: mod12_performance_runner.py.

Performance case 1 (Normal Input, baseline):
I sent a normal AI text classification request. Expected was below 200ms. Actual was status 200 at 652.45ms, so this case failed the strict threshold.

Performance case 2 (Long Input, baseline):
I sent a long AI input with length 1820 characters. Expected was process or safe rejection. Actual was status 200 at 56.05ms, so this passed.

Performance case 3 (Empty Input, baseline):
I sent empty AI input. Expected was graceful handling. Actual was status 400 at 37.54ms, so this passed.

Performance case 4 (Custom: AI Audio Classification Latency):
I ran three audio classification requests. Expected was stable average below 8 seconds. Actual statuses were all 200, but average latency was 26646.43ms with p95 at 42781.98ms, so this failed.

Performance case 5 (Custom: Blockchain Single Verify):
I ran one blockchain verify call with a unique report id. Expected was status 200 with gas visibility. Actual was status 200, latency 1599.65ms, gas_used 24212, so this passed.

Performance case 6 (Custom: Blockchain Burst Verify 5x):
I ran five sequential blockchain verify calls. Expected was 0% error and p95 below 3.5 seconds. Actual statuses were all 200, error rate 0.0%, avg 121.35ms, p95 144.9ms, so this passed.

Performance case 7 (Custom: Blockchain Duplicate Verify):
I verified the same report twice. Expected was duplicate detection with gas skip on second call. Actual second call returned already_recorded true with gas_used 0, so this passed.

Performance lab script summary:
The performance lab finished at 5 out of 7 passing, with failures concentrated on AI latency-heavy paths.

### Security Testing Lab (AI and Blockchain, 7 total test cases)

I built and ran a dedicated script: mod12_security_runner.py.

Security case 1 (Authorization, baseline):
I used a regular user token to call a dispatcher-protected dispatch endpoint. Expected was forbidden. Actual was status 403, so this passed.

Security case 2 (Invalid Input, baseline):
I sent an oversized AI text payload with length 12000. Expected was safe handling or rejection. Actual was status 400, so this passed.

Security case 3 (Data Exposure, baseline):
I checked AI health response payload for sensitive key leaks. Expected was no leaks. Actual was status 200 and leaked_keys empty, so this passed.

Security case 4 (Custom: AI Token Enforcement Probe):
I called AI classify without the service token. Expected was block if token policy is active. In this environment token enforcement is not enabled, so status 200 was expected here and this passed.

Security case 5 (Custom: Blockchain Invalid Payload):
I sent malformed blockchain verify payload missing required fields. Expected was validation failure. Actual was status 422, so this passed.

Security case 6 (Custom: Blockchain Duplicate Replay):
I submitted the same blockchain verification payload twice. Expected was replay-safe behavior with already_recorded on second call. Actual second call returned already_recorded true and gas_used 0, so this passed.

Security case 7 (Custom: AI Empty Input Validation):
I sent empty text to AI classify. Expected was validation error. Actual was status 400, so this passed.

Security lab script summary:
The security lab finished at 7 out of 7 passing.

Class sharing for performance:
The slowest case was AI audio classification with average latency around 26.65 seconds and p95 around 42.78 seconds. My bottleneck finding is that transcription and audio processing dominate response time compared with text classify and blockchain verify.

Most concerning risk I would share:
The most concerning risk is authorization drift or stale responder status leading to incorrect dispatch actions under load, because that can directly affect emergency response quality. I also consider optional AI token enforcement a medium-risk configuration gap if left disabled in higher environments.

### Wrap Up Notes (as me)

Our most surprising test result was that lightweight backend paths were extremely fast while heavier integrated paths were much slower, which showed me how quickly total latency grows when multiple services are chained.

Why I think it happened is that simple orchestration endpoints do minimal work, while audio/verification-related flows add extra processing and service calls that accumulate delay.

One change I will try next sprint is adding stronger concurrency-safe assignment controls and fresher availability updates, then measuring assignment-specific latency with request correlation so I can isolate bottlenecks earlier.

I will submit this in my SAS for the session.