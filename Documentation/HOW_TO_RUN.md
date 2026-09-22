# How To Run RescueLink

Complete operational runbook for starting all RescueLink services: Backend API, RescueLink AI service, Blockchain verification service, Web dashboard, and Mobile application. This guide covers prerequisites, environment setup, startup procedures, and troubleshooting for both quick-start and manual configuration methods.

## System Prerequisites

### Minimum Requirements

Before starting any RescueLink service, ensure your system has:

**Node.js & npm:**
- Version: 16.0+
- Platforms: Windows, macOS, Linux
- Install: [nodejs.org](https://nodejs.org/) or `winget install OpenJS.NodeJS` on Windows
- Verify: `node --version && npm --version`
- npm packages managed in `Backend/package.json` and `Frontend/Web/dispatcher_dashboard/package.json`

**Python & pip:**
- Version: 3.9+
- Virtual environment: venv (built-in) or virtualenv (recommended for compatibility)
- Install Python: [python.org](https://www.python.org/)
- Verify: `python --version && pip --version`
- Used by AI service and Blockchain service

**PostgreSQL:**
- Version: 12.0+
- Default port: 5432
- Platforms: Windows (PowerShell installer), macOS (brew), Linux (apt/yum)
- Data directory: Must have >500 MB free space for development data
- Install: [postgresql.org](https://www.postgresql.org/download/) or `winget install PostgreSQL.PostgreSQL` on Windows
- Verify: `psql --version`; connect via `psql -U postgres`

**Ganache (Ethereum Test Network):**
- Version: Latest (Desktop) or 6.0+ (CLI)
- Used for: Blockchain contract deployment and testing (not required for running API-only)
- Desktop: [Ganache UI](https://www.trufflesuite.com/ganache)
- CLI: `npm install -g ganache`
- Default port: 7545 (Desktop), 8545 (command line)
- Network: Local Ethereum-compatible chain for smart contract testing

**Flutter SDK (For Mobile App Only):**
- Version: 3.10+
- SDK path: Needs `export PATH="$PATH:/<flutter-path>/bin"` on macOS/Linux or system PATH on Windows
- Platforms: Windows (requires Android Studio or Edge for emulator), macOS (iOS Simulator for testing), Linux
- Install: [flutter.dev](https://flutter.dev/docs/get-started/install)
- Verify: `flutter --version`
- Optional: Only required if developing or testing the mobile app; API-only developers can skip

**PowerShell (Windows):**
- Version: 5.1+ (built into Windows 10/11)
- Reason: Run scripts like `run-all.bat` and `stop-all.bat`
- Alternative on macOS/Linux: Use bash scripts (modify `.bat` files to `.sh`)

### Additional Tools (Recommended)

- **Postman**: Test API endpoints; use included RBAC_POSTMAN_COLLECTION.json
- **Git**: Clone repository and manage version control
- **VS Code**: IDE with integrated terminals; use built-in tasks for service startup
- **cURL or wget**: Command-line API testing alternative to Postman

---

## Environment Files Setup

Each service requires a `.env` file containing configuration secrets, API endpoints, and feature flags. These files must be created before starting services.

### Backend/.env

Backend API configuration (Node.js environment):

```env
# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rescuelink_dev
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rescuelink_dev

# JWT & Authentication
JWT_SECRET=<generate-random-32-char-string>
JWT_EXPIRE=7d
DISPATCHER_MFA_ENABLED=true

# IPROG SMS OTP (citizen registration) — server-side only; never put these in Flutter
# Docs: https://www.iprogsms.com/api/v1/documentation
IPROG_API_TOKEN=your_iprog_api_token
IPROG_API_BASE_URL=https://www.iprogsms.com/api/v1
IPROG_OTP_EXPIRES_IN_MINUTES=5
# Optional: IPROG_OTP_MESSAGE=Your RescueLink code is :otp. Valid for 5 minutes. Do not share it.

PHONE_OTP_LENGTH=6
PHONE_OTP_EXPIRY=300

# Google reCAPTCHA v2 secret (validates Mobile captchaToken; pair with RECAPTCHA_SITE_KEY)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true
BCRYPT_ROUNDS=12

# File Upload & Scanning
UPLOAD_DIR=./uploads
QUARANTINE_DIR=./uploads/_quarantine
MAX_FILE_SIZE_AUDIO=52428800
MAX_FILE_SIZE_PHOTO=10485760
MAX_FILE_SIZE_VIDEO=104857600
FILE_SCAN_FAIL_OPEN=true
DEEP_SCAN_TIMEOUT_SECONDS=7200
DEEP_SCAN_MAX_RETRIES=3

# AI Service Integration
AI_SERVICE_URL=http://localhost:8000
AI_TRANSCRIPTION_TIMEOUT=60000

# Blockchain Service Integration
BLOCKCHAIN_SERVICE_URL=http://localhost:8001

# CORS & Security
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=true
RATE_LIMIT_MAX=2000
RATE_LIMIT_WINDOW_MS=900000

# Logging & Environment
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
```

**Key Secrets (Must Generate):**
- `JWT_SECRET`: Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate
- `DB_PASSWORD`: Match PostgreSQL password set during installation
- `IPROG_API_TOKEN`: From the IPROG SMS dashboard (API token / credit token). Required for citizen registration OTP.
- `RECAPTCHA_SECRET_KEY`: From Google reCAPTCHA admin (secret); Mobile uses only the site key.

**IPROG OTP delivery notes:**
- Backend posts `phone_number` as `63XXXXXXXXXX` (no `+`, no leading `0`). IPROG’s UI may still show `+63…`.
- Dashboard **Completed / Submitted** = queued to the provider, **not** proof the phone received SMS.
- OTP API uses sender **IPROGOTP** (Smart/TNT + Globe/TM/DITO). If IPROG falls back to `iprogtech` / shared `iprogSMS`, Smart/TNT often never gets the SMS.
- While debugging, copy the OTP from IPROG Recent sends. For undelivered messages, email admin+sms@iprogtech.com with message code, recipient, and send time.
- Backend console: `IPROG send_otp phone_number=` and `IPROG send_otp response=` (never logs `otp_code`).

A committed template lives at `Backend/.env.example` (copy to `Backend/.env`).

### RescueLink AI/.env

AI service configuration (Python environment):

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_DEBUG=True

# Model Paths & Configuration
MODEL_WHISPER_PATH=./models/whisper-base
MODEL_CLASSIFIER_PATH=./models/xlm-roberta-base
DEVICE=cuda

# Backend Integration
BACKEND_SERVICE_URL=http://localhost:3000/api

# Transcription Settings
TRANSCRIPTION_LANGUAGE=auto
TRANSCRIPTION_TASK=transcribe
TRANSCRIPTION_TIMEOUT=60

# Classification Settings
CONFIDENCE_THRESHOLD=0.5
MAX_INCIDENT_TYPES=5

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

**Model Assets:**
- Whisper model auto-downloads on first run (~140 MB)
- XLM-RoBERTa auto-downloaded from Hugging Face (~710 MB)
- Total disk space required: ~1 GB
- Models cached in `~/.cache/huggingface/`

### Blockchain/.env

Blockchain service configuration (Python/Solidity):

```env
# Ethereum Network
ETH_NETWORK=ganache
ETH_RPC_URL=http://localhost:8545
ETH_CHAIN_ID=1337

# Wallet Configuration
PRIVATE_KEY=<extract-from-ganache-first-account>
CONTRACT_ADDRESS=<deployed-after-first-run>

# Contract Configuration
GAS_LIMIT=8000000
GAS_PRICE=20000000000

# API Configuration
API_HOST=0.0.0.0
API_PORT=8001
API_DEBUG=True

# Backend Integration
BACKEND_SERVICE_URL=http://localhost:3000/api

# Logging
LOG_LEVEL=INFO
```

**Private Key Setup:**
1. Start Ganache (Desktop or CLI)
2. Copy first account's private key from Ganache UI (no "0x" prefix) or use: `ganache accounts`
3. Paste into `PRIVATE_KEY` field

### Web Frontend/.env (Optional)

Web dashboard configuration (React/Vite):

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_LOG_LEVEL=debug
VITE_ENV=development
```

### Mobile Frontend/.env or flutter parameters (Optional)

Mobile app configuration (Flutter). Prefer `Frontend/Mobile/.env` (see `.env.example`):

```env
API_BASE_URL=http://10.0.2.2:3000
RECAPTCHA_SITE_KEY=your_recaptcha_site_key
# Dev/test only — skip GPS and use fixed Dagupan coords
BYPASS_LOCATION_CHECK=false
ONESIGNAL_APP_ID=
```

reCAPTCHA Domains (Google admin): include **`localhost`** — the Flutter WebView issues tokens for that hostname.

Or pass at run time:

```bash
--dart-define=API_BASE_URL=http://192.168.1.X:3000
--dart-define=BYPASS_LOCATION_CHECK=true
```

---

## Quick Start: All Services

### One-Command Launch (Recommended For Development)

From the repository root, execute:

```powershell
./run-all.bat
```

**What happens automatically:**
1. Starts Backend Node.js API (port 3000)
2. Starts RescueLink AI Python service (port 8000)
3. Starts Blockchain Python service (port 8001)
4. Starts Web dashboard (port 5173)
5. Opens browser to http://localhost:5173

**Services startup order (triggered concurrently in background):**
- Prerequisite checks (PostgreSQL, Ganache availability)
- Backend API with database migrations
- AI service with model auto-download
- Blockchain service
- Web frontend Vite dev server
- Browser auto-launch

### Stopping All Services

```powershell
./stop-all.bat
```

Gracefully terminates all running services and cleans up background processes.

### Partial Startup

Start only specific services using environment variables:

```powershell
# Start only backend and web (no AI, blockchain)
$env:START_AI=false; $env:START_BLOCKCHAIN=false; ./run-all.bat

# Start only blockchain (for contract development)
$env:START_BACKEND=false; $env:START_AI=false; $env:START_WEB=false; ./run-all.bat
```

---

## Manual Start Order (For Debugging Individual Services)

If you need to start each service separately for troubleshooting or incremental development:

### 1. PostgreSQL Database

```powershell
# Windows (if installed as service)
# Already running; or start manually:
"C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\15\data" start

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

**Verification:**
```powershell
psql -U postgres -c "SELECT 1;"  # Should return "1" without error
```

### 2. Ganache (Ethereum Test Network)

**Desktop GUI (easiest for beginners):**
- Launch Ganache application
- Create new workspace or accept default
- Verify RPC server running on http://localhost:7545
- Note first account private key for Blockchain/.env

**Command Line:**
```powershell
ganache --deterministic --host 0.0.0.0 --port 8545 --accounts 10
```

### 3. Backend API

```powershell
cd Backend

# First time setup:
npm install

# Database initialization:
npm run setup-db      # Creates schema and runs migrations
npm run seed-db       # Populates initial departments, users, responders
npm run seed-incidents -- --reset  # Adds test incidents (optional)

# Start development server:
npm run dev           # Starts on port 3000 with auto-reload
```

**Expected output:**
```
Server running on port 3000
Database connected to postgresql://postgres@localhost:5432/rescuelink_dev
```

### 4. Blockchain Service

```powershell
cd Blockchain

# First time setup:
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Deploy smart contracts:
python scripts/deploy_contracts.py

# Start service:
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Expected output:**
```
INFO: Uvicorn running on http://0.0.0.0:8001
INFO: Smart contracts deployed at 0x...
```

### 5. RescueLink AI Service

```powershell
cd "RescueLink AI"

# First time setup:
python -m pip install --upgrade pip
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies (downloads AI models; takes ~5 minutes):
pip install -r requirements.txt

# Start service:
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output (first run):**
```
INFO: Uvicorn running on http://0.0.0.0:8000
INFO: Loading Whisper model (whisper-base)... [████████████] 100%
INFO: Loading XLM-RoBERTa classifier model... [████████████] 100%
INFO: Models loaded and cached
```

### 6. Web Dashboard

```powershell
cd Frontend/Web/dispatcher_dashboard

npm install

# Start development server:
npm run dev
```

**Expected output:**
```
VITE v4.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
➜  Press h + enter to show help
```

Then open http://localhost:5173 in browser.

### 7. Mobile App (Android Emulator)

```powershell
cd Frontend/Mobile

# First time setup:
flutter pub get

# List connected devices:
flutter devices

# Run on emulator or physical device:
flutter run

# For physical Android device on LAN:
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:3000
```

---

## Health Checks

After starting all services, verify they're running:

**Backend API Health:**
```powershell
curl http://localhost:3000/health
# Expected: { "status": "ok", "timestamp": "2026-03-24T..." }
```

**RescueLink AI Health:**
```powershell
curl http://localhost:8000/health
# Expected: { "status": "ok", "models": { "whisper": "loaded", "classifier": "loaded" } }
```

**Blockchain Service Health:**
```powershell
curl http://localhost:8001/health
# Expected: { "status": "ok", "blockchain": "connected", "contracts": "deployed" }
```

**Web Dashboard:**
- Open http://localhost:5173 in browser
- Should display login page without errors
- Check browser console (F12) for any JavaScript errors

**Mobile App:**
- Emulator/device should display login screen
- Should be able to select region and proceed to auth

---

## VS Code Integrated Tasks

Instead of manually running commands in separate terminals, use VS Code's built-in task runner:

1. Open VS Code in workspace root
2. Press `Ctrl+Shift+B` or use Command Palette (`Ctrl+Shift+P`) → "Tasks: Run Task"
3. Select desired task:
   - **Run All Services**: Starts all services concurrently (equivalent to `./run-all.bat`)
   - **Backend: dev**: Backend only
   - **RescueLink AI: dev**: AI service only
   - **Blockchain: dev**: Blockchain service only
   - **Web: dev**: Web dashboard only
   - **Stop All Services**: Stops all background tasks

**Viewing Task Output:**
- Output appears in VS Code's Terminal panel
- Each service gets separate terminal/color
- Click terminal tab to focus specific service output

**Advantages over manual terminals:**
- Integrated into editor workflow
- Tasks configured once in `.vscode/tasks.json`
- Easy switching between multiple service outputs
- Automatic cleanup on workspace close

---

## Python Virtual Environment Strategy

### Why Multiple Venvs?

RescueLink has two independent Python services (AI and Blockchain) with potentially conflicting dependencies. Using separate virtual environments prevents package conflicts.

### Layout

```
RescueLink/
  Blockchain/
    .venv/                 # Separate venv for blockchain
    requirements.txt
  RescueLink AI/
    .venv/                 # Separate venv for AI
    requirements.txt
```

### Creating Venvs Manually

```powershell
# Blockchain
cd Blockchain
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# RescueLink AI
cd "..\RescueLink AI"
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux  
pip install --upgrade pip
pip install -r requirements.txt
```

### Verifying Venv Activation

```powershell
# Should show venv path prefix
python -m site

# Should match venv location
pip --version
```

---

## Database Setup & Migrations

### Initial Setup

```powershell
cd Backend

# Create database and schema:
npm run setup-db

# Run all pending migrations:
npm run migrate

# Seed with initial departments and test accounts:
npm run seed-db

# (Optional) Create test incidents:
npm run seed-incidents -- --reset
```

### Migration Management

**Create new migration:**
```powershell
npm run migrate:create -- --name add_new_field
```

**Rollback last migration:**
```powershell
npm run migrate:down
```

**Check migration status:**
```powershell
npm run migrate:status
```

### Database Credentials

Default credentials (change in production):
- Hostname: `localhost`
- Port: `5432`
- Username: `postgres`
- Password: `postgres`
- Database: `rescuelink_dev`

Connection string format: `postgresql://postgres:postgres@localhost:5432/rescuelink_dev`

---

## Common Startup Issues & Troubleshooting

### "Port Already In Use" (EADDRINUSE)

**Error message:** `Error: listen EADDRINUSE :::3000`

**Causes:**
- Another instance of the service is running
- Or another application is using the port

**Solutions:**
```powershell
# Check what's using port 3000:
netstat -ano | findstr :3000

# Kill the process (replace PID):
taskkill /PID 1234 /F

# Or use different port:
$env:PORT=3001; npm run dev
```

### "PostgreSQL Connection Refused"

**Error message:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Causes:**
- PostgreSQL isn't running
- Wrong hostname/port in .env
- PostgreSQL isn't installed

**Solutions:**
```powershell
# Start PostgreSQL:
# Windows: Services panel → PostgreSQL service → Start
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Verify connection:
psql -U postgres -h localhost -c "SELECT 1;"

# Check .env DATABASE_URL format
```

### "Ganache Not Responding"

**Error message:** `Error: connect ECONNREFUSED 127.0.0.1:8545`

**Causes:**
- Ganache not running
- Wrong port in .env (8545 CLI vs 7545 Desktop)

**Solutions:**
```powershell
# Restart Ganache (Desktop): Click desktop app
# Or CLI: ganache --host 0.0.0.0 --port 8545

# Verify .env ETH_RPC_URL matches Ganache port
```

### "AI Model Download Timeout"

**Error message:** `urllib.error.URLError: <urlopen error socket timeout>`

**Causes:**
- First AI service startup downloads large models (~1 GB)
- Network timeout from Hugging Face
- Insufficient disk space

**Solutions:**
```powershell
# Increase timeout:
$env:HF_HUB_DOWNLOAD_TIMEOUT=3600  # 1 hour

# Or pre-download models:
python scripts/predownload_models.py

# Free up disk space (need at least 2 GB)
```

### "Mobile App Can't Reach Backend"

**Error message:** `Connection refused` or `Network error` in mobile app

**Causes:**
- Using `localhost` (mobile can't access host machine)
- Firewall blocking port 3000
- Wrong API_BASE_URL in flutter parameters

**Solutions:**
```powershell
# Find your machine's LAN IP:
ipconfig | findstr "IPv4 Address"  # Will show 192.168.x.x

# Use LAN IP in flutter command:
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:3000

# Or use special Android emulator address:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

### "Backend Can't Connect to AI Service"

**Error message:** `Error: AI_SERVICE_URL unreachable` (in backend logs)

**Causes:**
- AI service not running
- Wrong port in Backend/.env
- AI service crashed

**Solutions:**
```powershell
# Test AI health:
curl http://localhost:8000/health

# Verify Backend/.env has correct AI URL:
# AI_SERVICE_URL=http://localhost:8000

# Restart AI service:
cd "RescueLink AI"
python -m uvicorn api.main:app --reload --port 8000
```

### "File Scan Service Unavailable"

**Error message:** `Deep scan service unreachable` (in backend logs) after 2 hours

**Behavior:**
- Incident still created (fail-open enabled)
- File flagged as "clean" by default
- No quarantine action taken

**Resolution:**
- Monitor scanner service health
- Check logs for scan queue backlog
- Force re-scan of pending files when service recovers

---

## Test Commands & Integration Testing

### Running Full Integration Test Suite

```powershell
# From repository root, all services must be running first
./run_master_integration_tests.ps1
```

**What's tested:**
- User authentication flows
- Incident creation and lifecycle
- File upload and scanning
- Dispatch operations
- Responder updates
- Notification delivery

### Running Security-Focused Tests

```powershell
./run_security_integration_tests.ps1
```

**Security tests cover:**
- RBAC permission enforcement
- Ownership protection (users can't access others' data)
- Input validation (SQL injection, XSS, etc.)
- Rate limiting
- Authentication bypass attempts

### Backend Unit Tests

```powershell
cd Backend
npm test                              # Run all tests
npm test -- --testPathPattern=auth    # Run only auth tests
npm test -- --coverage                # Generate coverage report
```

### Web Frontend Tests

```powershell
cd Frontend/Web/dispatcher_dashboard
npm test                              # Jest test runner
npm run test:coverage
```

### Mobile App Tests

```powershell
cd Frontend/Mobile
flutter test                          # Run all widget tests
flutter test test/services            # Run specific test directory
flutter test --coverage               # Generate coverage report
```

### Development vs. Production Environments

**Development Environment (.env):**
- FILE_SCAN_FAIL_OPEN=true (emergency services don't block on scanner)
- LOG_LEVEL=debug
- CORS_ORIGIN includes localhost
- JWT_EXPIRE=7d (easier for development)
- Database=rescuelink_dev (separate from production)

**Production Environment:**
- FILE_SCAN_FAIL_OPEN=false (stricter file validation)
- LOG_LEVEL=info or error (reduce noise)
- CORS_ORIGIN restricted to production domain only
- JWT_EXPIRE=1d (shorter expiry for security)
- Database=rescuelink_prod (production data)
- TLS/HTTPS enforced
- All secrets rotated and managed by secrets manager
