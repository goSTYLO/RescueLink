# Module 12 – Performance & Security Testing  

## Session Flow (Activities Overview)  

| Time | Activity | Notes |
|------|----------|-------|
| 10 min | Bridge Recall – Review Sprint 2 features & integrations | Reflection |
| 15 min | Try It Out: Break It – Generate failure ideas & test cases | Brainstorm |
| 20 min | Testing 101 – Performance vs. Security methodology | Concepts |
| 35 min | Lab: Performance Testing – Measure speed/gas (AI & Blockchain) | Hands-on |
| 10 min | Recap & Hacker Mindset – Review performance & brainstorm security risks | Transition |

---

## Reflection Activity (Session 1)  

Prompts:  
1. New Feature – What new feature did your team add in Sprint 2?  
2. Integration – What integration did you implement?  
3. Success Metric – What metric did you use (time, gas, accuracy)?  
4. Prediction – What could go wrong with many users?  

---

## Try It Out: Break It to Make It Better  

- **Individually**: Write two ways your Sprint 2 feature could fail.  
- **Pair Up**: Turn each failure into a test case sentence:  
  *“When __, the system should __ (expected). We will run __ steps to verify.”*  
- **Group Select**: Pick one best test and write it on the board.  
- **Scan & Mark**: Consolidate duplicates/missing ideas.  

---

## Performance Testing Lab – Test Results Log  

| TEST CASE     | STEPS (SHORT)          | EXPECTED         | ACTUAL (time/gas) | PASS/FAIL | NOTE       |
|---------------|------------------------|------------------|-------------------|-----------|------------|
| Normal Input  | Enter standard text …  | < 200ms          |                   | ☐         | Baseline   |
| Long Input    | Paste 1000+ chars …    | Process/Error    |                   | ☐         |            |
| Empty Input   | Submit blank field …   | Handle gracefully|                   | ☐         |            |
| Custom Case 1 |                        |                  |                   | ☐         |            |
| Custom Case 2 |                        |                  |                   | ☐         |            |

**Class Sharing:**  
- Post slowest case & metric on board.  
- Identify bottleneck (loops, data size, complexity).  

---

## Security Testing Lab – Security Test Results  

| TEST CASE       | STEPS (SHORT)                  | EXPECTED            | ACTUAL | PASS/FAIL | NOTE          |
|-----------------|--------------------------------|---------------------|--------|-----------|---------------|
| Authorization   | Call restricted fn as non-owner| Revert "Not Auth"   |        | ☐         | Access Control|
| Invalid Input   | Long string / zero value …     | Revert/Safe Handle  |        | ☐         | Edge Case     |
| Data Exposure   | Check logs for secrets …       | No sensitive leaks  |        | ☐         | Privacy       |
| Custom Attack 1 |                                |                     |        | ☐         |               |
| Custom Attack 2 |                                |                     |        | ☐         |               |

**Class Sharing:**  
- Post most concerning risk on board.  
- Discuss: Critical vulnerability or minor issue?  

---

## Key Takeaways  

- **Performance Testing** → Speed & efficiency under load.  
- **Security Testing** → Resistance against unsafe inputs/unauthorized actions.  
- **Good Test Design** → Case → Steps → Expected → Actual → Pass/Fail → Note.  
- **Value of Failure** → Sharing failures helps identify risks early.  

**Wrap Up Notes (15 min):**  
- Surprising result: “Our most surprising test result was…”  
- Reasoning: “Why we think it happened…”  
- Next steps: “One change we’ll try next sprint…”  
- Submit SAS before leaving.  

