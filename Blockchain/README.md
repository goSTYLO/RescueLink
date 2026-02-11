# RescueLink Blockchain Service

FastAPI service that records verified incident hashes on Ganache via the IncidentRegistry Solidity contract.

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
- `POST /verify-incident` - Body: `{ report_id: int, incident_data: object }` - Records hash on blockchain via IncidentRegistry, returns `{ hash_value, tx_hash, block_number }`
