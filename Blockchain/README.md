# RescueLink Blockchain Service

> ⚠️ **Optional Module** — Disabled by default.
> Set `USE_BLOCKCHAIN=true` in `Backend/.env` and `VITE_USE_BLOCKCHAIN=true` in `Frontend/Web/dispatcher_dashboard/.env` to enable.
> When disabled, incident finalization falls back to audit trail logging (no Ganache required).

FastAPI service that records verified incident hashes on Ganache via the IncidentRegistry Solidity contract.


## Session Updates (Performance & Gas Optimization)

The blockchain verify flow was updated during the latest performance session with the following behavior:

- **Gas observability in API response**: `/verify-incident` now returns `gas_used`, `effective_gas_price`, and `gas_cost_wei`
- **Duplicate-write prevention**: before sending a new transaction, the service checks existing `IncidentVerified` logs for the same `report_id`
- **No extra gas for duplicates**: when already recorded, the API returns the existing transaction reference with `already_recorded: true` and zero gas fields
- **Contract gas optimizations** (see `contracts/IncidentRegistry.sol`):
  - Events-only design (no on-chain storage): ~24k gas vs ~48k for storage-based
  - Timestamp removed from event: derivable from `blockNumber`; saves ~256 gas/tx
- **Solidity optimizer**: `contract.py` compiles with `optimize=True`, `optimize_runs=200` for smaller bytecode and lower execution gas

This keeps functional behavior for verification while reducing unnecessary repeated on-chain writes.

## Gas Cost Estimation (PHP/Pesos)

The optimized contract uses approximately 23,425 gas per incident verification. Cost in pesos depends on gas price and ETH rate. At 1 ETH = ₱168,000: at 20 gwei each verification costs about ₱79; at 30 gwei about ₱118; at 50 gwei about ₱197. Duplicate verifications cost ₱0 (no new transaction). Use `npm run test:gas` in `Blockchain/tests` to measure current gas and generate reports.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   This includes py-solc-x for compiling the Solidity contract (solc v0.8.x will be installed automatically).

2. Start Ganache (Desktop or CLI):
   - Ganache CLI: `npx ganache` (default http://127.0.0.1:8545, Network ID 1337)
   - Ganache Desktop: http://127.0.0.1:7545, Network ID 5777

3. Copy `.env.example` to `.env` and set:
   - `PRIVATE_KEY` - First account's private key from Ganache
   - `GANACHE_URL` - http://127.0.0.1:7545 for Desktop, http://127.0.0.1:8545 for CLI
   - `CHAIN_ID` - 5777 for Desktop, 1337 for CLI
   - `CONTRACT_ADDRESS` - Optional; leave empty for first run to auto-deploy

4. Run the service:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8001
   ```

## Contract Deployment

On the first POST to `/verify-incident` with no `CONTRACT_ADDRESS` in `.env`, the service will:
1. Compile `contracts/IncidentRegistry.sol`
2. Deploy to Ganache
3. Use the deployed contract for the transaction
4. Log the deployed address (add it to `.env` as `CONTRACT_ADDRESS` for persistence across restarts)

## Endpoints

- `GET /health` - Health check, verifies Ganache connection
- `POST /verify-incident` - Body: `{ report_id: int, incident_data: object }` - Records hash on blockchain via IncidentRegistry, returns:
   - `hash_value`
   - `tx_hash`
   - `block_number`
   - `gas_used`
   - `effective_gas_price`
   - `gas_cost_wei`
   - `already_recorded`

## Automated test
There is a Node.js Mocha test harness that verifies the FastAPI service can connect to Ganache and record an incident on-chain. The test is minimal and meant for local verification (not CI) unless you adapt the environment handling.

Files:
- `Blockchain/tests/package.json` — test deps and `npm test` script
- `Blockchain/tests/test_blockchain_connection.test.js` — Mocha test that:
   - GETs `/health` and asserts `ganache_connected: true`
   - POSTs a sample payload to `/verify-incident` (this may compile & deploy the contract on first run)
   - Uses `web3` pointed at `GANACHE_URL` to confirm the returned `tx_hash` has a transaction receipt

Prerequisites
- Ganache Desktop running and RPC URL matching `GANACHE_URL` in `Blockchain/.env` (default Desktop: `http://127.0.0.1:7545`).
- `Blockchain/.env` should contain a `PRIVATE_KEY` corresponding to an unlocked Ganache account.
- Python dependencies installed (see top of this README).

Run the test (local):

1) Start Ganache Desktop and confirm RPC URL.

2) Start the Blockchain FastAPI service (leave running while tests execute):
```powershell
cd "c:\Users\Aaron\GitHub Repos\RescueLink\Blockchain"
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

3) In a second terminal run the Node test harness:
```powershell
cd "c:\Users\Aaron\GitHub Repos\RescueLink\Blockchain\tests"
npm install
npm test
```

What the test verifies
- `/health` returns `ganache_connected: true`.
- `POST /verify-incident` returns `{ hash_value, tx_hash, block_number }`.
- The test then queries Ganache RPC (via `web3`) for the transaction receipt for `tx_hash` and asserts the receipt exists and contains a `blockNumber`.

Troubleshooting
- If `/health` reports `ganache_connected: false`, check that Ganache is running and `GANACHE_URL` in `.env` matches the Ganache RPC URL.
- If the POST returns an error about missing `PRIVATE_KEY`, set `PRIVATE_KEY` in `.env` to a Ganache account private key (Ganache Desktop exposes seeded accounts).
- If the receipt is not found:
   - Ensure Ganache is not paused and is mining (Ganache Desktop mines automatically).
   - Confirm the `tx_hash` returned by the service (the test prints the `verify-incident` response) and look it up in Ganache Desktop's transaction list.
- On first run the service compiles and deploys the contract using `py-solc-x` — this may download solc and take extra time. If you prefer deterministic tests, deploy the contract once and set `CONTRACT_ADDRESS` in `.env`.

CI / safety notes
- The current test loads `Blockchain/.env` for convenience. For CI, create a `.env.test` with CI-safe keys and change the test harness to load it instead.
- Avoid committing real private keys. Use ephemeral Ganache instances or CI secrets for secure automation.

If you'd like, I can add a `.env.test` loader and a GitHub Actions job that launches Ganache CLI, starts the Python service, then runs this test headlessly.
