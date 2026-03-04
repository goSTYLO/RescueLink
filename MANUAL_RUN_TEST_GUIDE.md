**Manual Run & Test Guide**

Overview
--------
- Purpose: How to manually run and test the full RescueLink stack (Mobile, Web dispatcher, Backend, RescueLink AI, Blockchain + Ganache) and run automated tests.
- Repo root: use commands relative to repository root.

Prerequisites
-------------
- Node.js >=14 and npm
- Python 3.8+ and `venv`
- Pip for Python packages
- Flutter SDK (for `Frontend/Mobile`)
- Ganache (Desktop or CLI) for local blockchain
- PostgreSQL (or another DB matching `DATABASE_URL` for `Backend`)

Environment files
-----------------
Place these `.env` files in the named folders (examples):

- `Backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/rescuelink
PORT=3000
FIREBASE_SERVICE_ACCOUNT_PATH=src/serviceAccountKey.json
```

- `Blockchain/.env`:
```
GANACHE_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x<first_ganache_account_private_key>
# Optional to avoid redeploying contract:
CONTRACT_ADDRESS=0x<already_deployed_address>
BLOCKCHAIN_SERVICE_URL=http://localhost:8001
```

- `RescueLink AI/.env` (example in `RescueLink AI/.env.example`):
```
HF_API_TOKEN=hf_your_huggingface_token
MIN_AUDIO_DURATION_SECONDS=30
MAX_AUDIO_DURATION_SECONDS=60
MAX_AUDIO_FILE_SIZE_MB=25
```

Ports (defaults)
-----------------
- Backend API: `3000` (`Backend/src/server.js`)
- RescueLink AI (FastAPI): `8000` (`RescueLink AI/api/main.py`)
- Blockchain FastAPI: `8001` (`Blockchain/main.py`)
- Ganache: `8545` (or `7545` for Ganache GUI)

Recommended start order
-----------------------
1. Database (Postgres)
2. Ganache (local blockchain)
3. Blockchain FastAPI service
4. RescueLink AI service
5. Backend Node.js API
6. Web dispatcher and Mobile app

Exact commands (working directories indicated)
----------------------------------------------

Database (Terminal 1)
```
cd Backend
npm install
npm run setup-db
# Populate with test data (users, responders, incidents)
npm run seed-db
```

Note: The `seed-db` script is idempotent (safe to run multiple times). It creates:
- 2 dispatchers, 5 responders, 10 regular users
- 6 sample incidents with various statuses
- Dispatches linking incidents to responders
- Sample notifications

**Seeded test accounts:**

Dispatchers (password: `dispatcher123`):
- `dispatcher@rescuelink.test` (Address: Dagupan Barangay, Dagupan City, Pangasinan)
- `dispatcher2@rescuelink.test` (Address: Malur Barangay, Dagupan City, Pangasinan)

Responders (password: `responder123`):
- `responder@rescuelink.test` (Address: Bonuan Barangay, Dagupan City, Pangasinan)
- `responder2@rescuelink.test` (Address: Bacnotan Barangay, Dagupan City, Pangasinan)
- `responder3@rescuelink.test` (Address: Pantal Barangay, Dagupan City, Pangasinan)
- `responder4@rescuelink.test` (Address: Dagupan Barangay, Dagupan City, Pangasinan)
- `responder5@rescuelink.test` (Address: Malur Barangay, Dagupan City, Pangasinan)

Regular Users (password: `user123`):
- `user@rescuelink.test` through `user10@rescuelink.test` (distributed across Dagupan barangays: Dagupan, Malur, Bonuan, Bacnotan, Pantal)

Ganache (Terminal 2)
- Option A: open Ganache Desktop and use the GUI
- Option B (CLI):
```
npx ganache-cli -p 8545
# or use 7545 if you prefer the GUI default:
npx ganache-cli -p 7545
```
After Ganache starts, copy the first account private key into `Blockchain/.env` as `PRIVATE_KEY` and ensure `GANACHE_URL` matches.

Blockchain FastAPI (Terminal 3)
```
cd Blockchain
python -m venv .venv
.venv\Scripts\activate   # Windows PowerShell
pip install -r requirements.txt
# Ensure Blockchain/.env contains GANACHE_URL and PRIVATE_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

RescueLink AI (Terminal 4)
```
# If a shared virtualenv exists at the repository root (`.venv`), activate it from the repo root:
cd "C:\Users\Aaron\GitHub Repos\RescueLink"
.venv\Scripts\Activate.ps1   # PowerShell
# Install AI requirements and PyTorch matching CUDA 12.8 (cu128):
cd "RescueLink AI"
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
# Ensure model files exist: models/emergency_model.pt and models/label_meta.json
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend (Terminal 5)
```
cd Backend
npm install
# Start in dev mode (nodemon) or production
npm run dev
# or
npm start
```

Web dispatcher (Terminal 6)
```
cd Frontend/Web/dispatcher_dashboard
npm install
npm start
```

Mobile (Terminal 7)
```
cd Frontend/Mobile
flutter pub get
# Run on connected device/emulator
flutter run
# Build APK
flutter build apk
```

Automated tests
---------------

Master cross-stack integration runner (Windows PowerShell)
```
cd C:\Users\Aaron\GitHub Repos\RescueLink
powershell -ExecutionPolicy Bypass -File .\run_master_integration_tests.ps1
```

Optional skip flags:
- `-SkipBackend`
- `-SkipWeb`
- `-SkipMobile`
- `-SkipAI`
- `-SkipBlockchain`

The runner executes available suites across backend, web, mobile, AI, and blockchain, and marks missing-service phases as `SKIPPED` instead of hard-failing.

Blockchain Mocha test (end-to-end)
- Location: `Blockchain/tests`
```
cd Blockchain/tests
npm install
npm test
```
Notes: Tests expect Ganache running and the Blockchain FastAPI service at `BLOCKCHAIN_SERVICE_URL` (default `http://localhost:8001`). If Ganache uses port `7545`, set `GANACHE_URL` accordingly in `Blockchain/.env`.

Backend integration test
- Location: `Backend/tests/integration.test.js`
```
# Ensure Backend server is running
node Backend/tests/integration.test.js
```

Health endpoints (quick checks)
--------------------------------
- Blockchain: `http://localhost:8001/health` (`Blockchain/main.py`)
- RescueLink AI: `http://localhost:8000/health` (`RescueLink AI/api/main.py`)
- Backend: `http://localhost:3000/health` (if implemented in `Backend/src/server.js`)

Troubleshooting & common blockers
---------------------------------
- Ganache not connecting: ensure `GANACHE_URL` in `Blockchain/.env` matches the running Ganache host/port. GUI often uses `7545`; service examples use `8545`.
- Missing `PRIVATE_KEY`: copy first Ganache account private key into `Blockchain/.env` as `PRIVATE_KEY=0x...`.
- Missing `serviceAccountKey.json`: `Backend/src/serviceAccountKey.json` may be required for Firebase integration — place it or set `FIREBASE_SERVICE_ACCOUNT_PATH` in `Backend/.env`.
- Missing AI model files: `RescueLink AI/models/emergency_model.pt` and `RescueLink AI/models/label_meta.json` are required for classification. If absent, the AI service will fallback or fail on model load.
- `CONTRACT_ADDRESS`: If you want to reuse a deployed `IncidentRegistry` contract, set `CONTRACT_ADDRESS` in `Blockchain/.env`; otherwise the service will deploy on first call (requires `PRIVATE_KEY`).
- npm `web3` version: If installing tests, `Blockchain/tests/package.json` pins a compatible `web3` (use the provided package.json in that folder).

Quick troubleshooting commands
```
# Confirm Ganache RPC responds
curl http://127.0.0.1:8545

# Check Blockchain health
curl http://localhost:8001/health

# Check RescueLink AI health
curl http://localhost:8000/health

# Tail logs (if running uvicorn)
# On Windows, check the terminal running uvicorn for logs
```

Optional: Commit the guide
--------------------------
After you verify the file, commit it with:
```
git add MANUAL_RUN_TEST_GUIDE.md
git commit -m "docs: add manual run & test guide for full stack and blockchain tests"
git push
```

Database seeding script details
-------------------------------
- Script: `Backend/scripts/seed-db.js`
- Creates test data for full-stack testing
- Safely clears and repopulates on each run
- Run with: `npm run seed-db` (from `Backend` folder)

Where to look for more details
------------------------------
- Backend server & DB setup: `Backend/src/server.js`, `Backend/setup-db.js`, `Backend/schema.sql`
- Database seeding: `Backend/scripts/seed-db.js`
- Blockchain code + helpers: `Blockchain/main.py`, `Blockchain/services/incident_registry.py`, `Blockchain/services/contract.py`, `Blockchain/contracts/IncidentRegistry.sol`
- Blockchain test harness: `Blockchain/tests/test_blockchain_connection.test.js`, `Blockchain/tests/package.json`
- RescueLink AI server & docs: `RescueLink AI/api/main.py`, `RescueLink AI/README.md`
- Frontend & mobile instructions: `Frontend/Web/dispatcher_dashboard`, `Frontend/Mobile/README.md`

If you want, I can also run `git commit` for you now (or create a PR). Say "commit" to proceed.

---
Generated: February 13, 2026
