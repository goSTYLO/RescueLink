# RescueLink Troubleshooting Guide

Comprehensive troubleshooting procedures for common issues encountered when developing, deploying, and operating RescueLink. This guide includes diagnostic steps, root cause analysis, and resolution procedures for frontend, backend, AI, blockchain, and infrastructure issues.

---

## Quick Diagnostic Checklist

Before diving into specific troubleshooting, verify the basic health of your system:

```powershell
# 1. Verify all services are running
curl http://localhost:3000/health              # Backend
curl http://localhost:8000/health              # AI Service
curl http://localhost:8001/health              # Blockchain
curl http://localhost:5173                     # Web Dashboard

# 2. Check database connectivity
psql -U postgres -h localhost -c "SELECT 1;"

# 3. Verify Ganache is running
curl http://localhost:8545                     # CLI
# or check Desktop application status

# 4. Test inter-service communication
# Backend to AI:
curl http://localhost:3000/api/incidents/test-ai-connection
# Backend to Blockchain:
curl http://localhost:3000/api/incidents/test-blockchain-connection

# 5. Check environment variables
# Backend
cat Backend/.env | grep -E "DATABASE_URL|AI_SERVICE_URL|BLOCKCHAIN"
# AI Service
cat "RescueLink AI/.env" | grep -E "BACKEND_SERVICE_URL"
# Blockchain
cat Blockchain/.env | grep -E "ETH_RPC_URL|BACKEND_SERVICE_URL"
```

---

## Backend API Troubleshooting

### Issue: Backend Won't Start

**Symptoms:**

- Server process fails to launch
- Error appears in terminal and process exits
- npm start/dev command doesn't create listening port

**Diagnostic Steps:**

```powershell
# 1. Check npm installation
npm --version                          # Should be 8.0+
node --version                         # Should be 16.0+

# 2. Check package installation
npm list                               # Lists all installed packages
ls node_modules | wc -l                # Should have 500+ packages

# 3. Check for missing .env
ls Backend/.env                        # Should exist and be readable

# 4. Try clearing cache
rm -r node_modules package-lock.json
npm install
```

**Common Root Causes & Solutions:**

**A. Database Connection Failed**

- Error: `Error: connect ECONNREFUSED 127.0.0.1:5432`
- Cause: PostgreSQL not running or incorrect credentials
- Solution:

  ```powershell
  # Start PostgreSQL
  # Windows: Services → PostgreSQL service → Start
  # macOS: brew services start postgresql
  # Linux: sudo systemctl start postgresql

  # Verify connection
  psql -U postgres -h localhost -c "SELECT 1;"

  # Check .env DATABASE_URL
  # Format: postgresql://user:password@host:port/database
  ```

**B. Port Already In Use**

- Error: `Error: listen EADDRINUSE :::3000`
- Cause: Another process running on port 3000
- Solution:

  ```powershell
  # Find what's using the port
  netstat -ano | findstr :3000

  # Kill the process (replace PID)
  taskkill /PID 1234 /F

  # Alternative: Use different port
  $env:PORT=3001
  npm run dev
  ```

**C. JWT_SECRET Missing**

- Error: `Error: JWT_SECRET not defined in environment`
- Cause: Missing or empty JWT_SECRET in .env
- Solution:

  ```powershell
  # Generate new secret
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # Add to Backend/.env
  # JWT_SECRET=<generated-value>
  ```

**D. Module Not Found**

- Error: `Error: Cannot find module 'sequelize'`
- Cause: npm dependencies not installed
- Solution:
  ```powershell
  cd Backend
  rm -r node_modules package-lock.json
  npm install
  npm run dev
  ```

### Issue: Backend Crashes After Starting

**Symptoms:**

- Server starts but crashes after 1-5 seconds
- Random "Segmentation fault" or "out of memory" error
- Process exits with code 1 or negative code

**Diagnostic Steps:**

```powershell
# 1. Run with verbose logging
DEBUG=* npm run dev

# 2. Check system resources
# Windows Task Manager → Performance tab
# macOS: Activity Monitor
# Linux: top or htop

# 3. Check recent logs
cat logs/*.log | tail -50

# 4. Run database migrations
npm run migrate
npm run migrate:status
```

**Common Root Causes & Solutions:**

**A. Database Migrations Failed**

- Error: `Error: Migration failed: column "x" already exists`
- Cause: Migrations not properly applied or schema mismatch
- Solution:

  ```powershell
  # Check migration status
  npm run migrate:status

  # Rollback all migrations
  npm run migrate:reset

  # Reapply from scratch
  npm run migrate
  npm run seed-db
  ```

**B. Memory Leak or High Memory Usage**

- Error: `JavaScript heap out of memory` (process crashes with code 134)
- Cause: Infinite loop, unclosed database connections, or memory leak
- Solution:

  ```powershell
  # Increase Node heap size
  node --max-old-space-size=4096 node_modules/.bin/nodemon src/index.js

  # Or set in environment
  $env:NODE_OPTIONS="--max-old-space-size=4096"
  npm run dev

  # Check for unclosed database connections
  # Review recent code changes
  ```

**C. Invalid Environment Configuration**

- Error: `Error: Invalid DATABASE_URL format`
- Cause: Malformed .env variable
- Solution:

  ```powershell
  # Verify .env format
  cat Backend/.env | grep DATABASE_URL

  # Should be:
  # postgresql://user:password@host:port/database

  # NOT:
  # postgres://... (old format, deprecated)

  # Test connection
  psql $(grep DATABASE_URL Backend/.env | cut -d= -f2)
  ```

### Issue: API Returns 500 Internal Server Error

**Symptoms:**

- Requests return HTTP 500 with generic error message
- No details about what failed
- Error sometimes transient, sometimes persistent

**Diagnostic Steps:**

```powershell
# 1. Check server logs
# View last 100 lines
tail -100 logs/error.log

# 2. Test the endpoint directly
curl -v http://localhost:3000/api/incidents

# 3. Check database connection
npm run db:test

# 4. Verify service dependencies
# Can AI service be reached?
curl http://localhost:8000/health
# Can Blockchain service be reached?
curl http://localhost:8001/health
```

**Common Root Causes & Solutions:**

**A. Dependency Service Unreachable**

- Error: `500 - Error: AI_SERVICE_URL unreachable`
- Cause: AI or Blockchain service not running
- Solution:

  ```powershell
  # Check if services running
  curl http://localhost:8000/health    # AI
  curl http://localhost:8001/health    # Blockchain

  # Start services if down
  # Terminal 1:
  cd "RescueLink AI"
  python -m uvicorn api.main:app --reload --port 8000

  # Terminal 2:
  cd Blockchain
  python -m uvicorn main:app --host 0.0.0.0 --port 8001
  ```

**B. Unhandled Database Error**

- Error: Specific column or table not found (but not obviously from SQL)
- Cause: Schema not up to date or migration pending
- Solution:

  ```powershell
  # Check migration status
  npm run migrate:status

  # Apply pending migrations
  npm run migrate

  # Verify schema
  psql -U postgres rescuelink_dev -c "\dt"
  ```

**C. Invalid Request Validation**

- Error: `500 - Validation failed` (should be 400)
- Cause: Bug in error handling middleware
- Solution:

  ```powershell
  # Review recent validation changes
  git log -p src/middleware/validate.js | head -50

  # Test validation directly
  curl -X POST http://localhost:3000/api/incidents \
    -H "Content-Type: application/json" \
    -d "{}"
  ```

### Issue: Slow API Response Times

**Symptoms:**

- API endpoints take >5 seconds to respond
- Database queries are slow
- Regular users report timeouts

**Diagnostic Steps:**

```powershell
# 1. Check query performance
# Enable slow query logging in PostgreSQL
psql -U postgres -d rescuelink_dev -c "
  ALTER SYSTEM SET log_min_duration_statement = 1000;
"
# Restart PostgreSQL

# 2. Check database size
psql -U postgres -d rescuelink_dev -c "
  SELECT schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 3. Check indexes
psql -U postgres -d rescuelink_dev -c "
  SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
"

# 4. Monitor system resources
# Check CPU usage
Get-Process node | Select-Object ProcessName, CPU, Memory

# Check memory
Get-CimInstance Win32_LogicalMemoryConfiguration
```

**Common Root Causes & Solutions:**

**A. Missing Database Indexes**

- Cause: Common queries on unindexed columns
- Solution:
  ```powershell
  # Add index on frequently queried columns
  psql -U postgres rescuelink_dev -c "
    CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
  "
  ```

**B. N+1 Query Problem**

- Cause: Fetching one record causes N child queries
- Symptom: 1000 requests to database for 1 API call
- Solution:

  ```powershell
  # Review recent ORM queries
  # Check for missing eager loading:
  # BAD: incidents.map(i => i.user)
  # GOOD: incidents include: [user]

  # Enable query logging
  export DEBUG=sequelize
  npm run dev
  ```

**C. Connection Pool Exhaustion**

- Error: `Error: getconnection timeout exceeded`
- Cause: Too many simultaneous database connections
- Solution:

  ```powershell
  # Increase connection pool size in .env
  DB_POOL_MAX=20
  DB_POOL_MIN=5

  # Or close idle connections
  psql -U postgres rescuelink_dev -c "
    SELECT pid, usename, application_name, state, query
    FROM pg_stat_activity;
  "

  # Kill idle connections if needed
  psql -U postgres rescuelink_dev -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle' AND query_start < now() - interval '5 min';
  "
  ```

---

## RescueLink AI Service Troubleshooting

### Issue: AI Service Won't Start

**Symptoms:**

- Python process fails to launch
- Virtual environment not activated
- Module import errors

**Diagnostic Steps:**

```powershell
# 1. Verify Python installation
python --version                       # Should be 3.9+
python -m venv --help                 # Should work

# 2. Check virtual environment
.venv\Scripts\activate                # Activate venv

# 3. Check dependencies
pip list                              # Should show all packages from requirements.txt
pip show torch                        # Check specific package

# 4. Check .env exists
ls "RescueLink AI/.env"
```

**Common Root Causes & Solutions:**

**A. Virtual Environment Not Activated**

- Error: `python: No module named 'torch'`
- Cause: Using system Python instead of venv
- Solution:

  ```powershell
  # Activate virtual environment
  cd "RescueLink AI"
  .\.venv\Scripts\activate            # Windows
  # source .venv/bin/activate          # macOS/Linux

  # Verify activation (should show .venv prefix)
  python -m site
  ```

**B. Missing Dependencies**

- Error: `ModuleNotFoundError: No module named 'whisper'`
- Cause: requirements.txt not installed or corrupted
- Solution:

  ```powershell
  # Reinstall all dependencies
  pip install --upgrade pip
  pip install --force-reinstall -r requirements.txt

  # Check specific package
  pip install torch torchvision torchaudio
  ```

**C. Model Download Timeout**

- Error: `urllib.error.URLError: socket timeout`
- Cause: Downloading AI models (Whisper, XLM-RoBERTa) takes time
- Solution:

  ```powershell
  # Increase timeout
  $env:HF_HUB_DOWNLOAD_TIMEOUT=3600

  # Pre-download models manually
  python scripts/predownload_models.py

  # Or check disk space (need 2+ GB)
  Get-PSDrive C
  ```

**D. GPU/CUDA Issues**

- Error: `RuntimeError: CUDA out of memory` or `No GPU detected`
- Cause: GPU not available or insufficient GPU memory
- Solution:

  ```powershell
  # Check if GPU available
  python -c "import torch; print(torch.cuda.is_available())"

  # Use CPU instead
  # Edit RescueLink AI/.env
  # DEVICE=cpu

  # Or reduce batch size
  # TORCH_BATCH_SIZE=4
  ```

### Issue: AI Service Returns Errors on Transcription

**Symptoms:**

- /transcribe endpoint returns 500 error
- Audio file not processed
- Confidence scores not returned

**Diagnostic Steps:**

```powershell
# 1. Test with curl
curl -X POST http://localhost:8000/transcribe \
  -F "file=@test-audio.mp3"

# 2. Check AI logs
tail -50 logs/ai-service.log

# 3. Verify audio file
# Check format, duration, encoding
ffprobe test-audio.mp3

# 4. Test model loading
python -c "
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration
model = WhisperForConditionalGeneration.from_pretrained('openai/whisper-base')
print('Models loaded successfully')
"
```

**Common Root Causes & Solutions:**

**A. Unsupported Audio Format**

- Error: `Error: Unsupported audio format` or garbled text output
- Cause: Audio codec not supported by Whisper
- Solution:

  ```powershell
  # Convert to supported format (WAV or MP3)
  ffmpeg -i input.m4a -acodec libmp3lame -ab 128k output.mp3

  # Test conversion
  ffprobe output.mp3

  # Add format detection in AI service
  # Update audio_processor.py to auto-convert
  ```

**B. Models Not Fully Loaded**

- Error: `RuntimeError: model not fully loaded` or timeout
- Cause: Models partially downloaded or corrupted
- Solution:

  ```powershell
  # Clear model cache
  rm -r ~/.cache/huggingface/hub/*

  # Re-download
  python -c "
  from transformers import WhisperForConditionalGeneration
  model = WhisperForConditionalGeneration.from_pretrained('openai/whisper-base')
  "

  # Verify download completed
  ls ~/.cache/huggingface/hub/
  ```

**C. Out of Memory During Processing**

- Error: `RuntimeError: CUDA out of memory` or process killed
- Cause: Audio file too long or batch size too large
- Solution:

  ```powershell
  # Clear GPU cache
  python -c "
  import torch
  if torch.cuda.is_available():
    torch.cuda.empty_cache()
    print('GPU cache cleared')
  "

  # Reduce batch size in RescueLink AI/.env
  # BATCH_SIZE=1

  # Or use CPU
  # DEVICE=cpu
  ```

### Issue: AI Classification Returns Low Confidence

**Symptoms:**

- Incident type suggestions have <50% confidence
- Wrong incident types suggested
- Dispatcher cannot trust AI recommendations

**Diagnostic Steps:**

```powershell
# 1. Test classifier directly
python -c "
from services.classifier import classify_incident
result = classify_incident('Building fire at 123 Main St')
print(result)
"

# 2. Check training data
ls models/training/

# 3. Test with known incidents
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{"description": \"Medical emergency\"}'

# 4. Review model performance
python scripts/evaluate_classifier.py
```

**Common Root Causes & Solutions:**

**A. Model Drift (Trained on Old Data)**

- Cause: Classifier trained with limited incident types
- Solution:

  ```powershell
  # Retrain classifier with more labeled data
  python scripts/train_classifier.py \
    --epochs 10 \
    --batch_size 16 \
    --learning_rate 0.0001

  # Evaluate performance
  python scripts/evaluate_classifier.py
  ```

**B. Short or Ambiguous Text**

- Cause: Single-word descriptions don't provide enough context
- Solution:

  ```powershell
  # Add minimum text length requirement
  # In transcription processor, combine transcription + description

  # Test with longer descriptions
  curl -X POST http://localhost:8000/classify \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Fire in residential building, flames on second floor",
      "audio_transcript": "There is a fire...",
      "location": "123 Main Street"
    }'
  ```

**C. Mismatched Incident Categories**

- Cause: Classifier trained on different incident types than backend supports
- Solution:

  ```powershell
  # Verify incident types match
  # Backend: Backend/src/constants/incidents.ts
  # AI: RescueLink AI/services/incident_types.py

  # Retrain if types changed
  python scripts/train_classifier.py --classes-file Backend/incident-types.json
  ```

---

## Blockchain Service Troubleshooting

### Issue: Blockchain Service Won't Connect to Ganache

**Symptoms:**

- Service fails to start with Ganache connection error
- `Error: connect ECONNREFUSED 127.0.0.1:8545`
- Smart contracts not deployed

**Diagnostic Steps:**

```powershell
# 1. Verify Ganache is running
# Desktop: Check if Ganache app is open and green status
# CLI:
netstat -ano | findstr :8545    # Check if port 8545 used
ps aux | grep ganache           # Check process running

# 2. Test connection to Ganache
curl http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 3. Check .env configuration
cat Blockchain/.env | grep ETH_

# 4. Verify private key format
echo $PRIVATE_KEY | wc -c          # Should be 64 chars (32 bytes hex)
```

**Common Root Causes & Solutions:**

**A. Ganache Not Running**

- Error: `ECONNREFUSED` on port 8545 or 7545
- Solution:

  ```powershell
  # Start Ganache Desktop
  # macOS: open -a Ganache
  # Windows: Start Ganache application

  # OR start CLI:
  ganache --deterministic --host 0.0.0.0 --port 8545 --accounts 10
  ```

**B. Wrong Port in Configuration**

- Error: `Error: connect ECONNREFUSED` but Ganache is running
- Cause: Blockchain/.env points to wrong port
- Solution:

  ```powershell
  # Check Ganache running port
  # Desktop: Settings → Server (default 7545)
  # CLI: Check startup message (default 8545)

  # Update Blockchain/.env
  # For Desktop: ETH_RPC_URL=http://localhost:7545
  # For CLI: ETH_RPC_URL=http://localhost:8545
  ```

**C. Ganache Workspace Not Persisting**

- Error: Smart contracts deployed but disappeared after restart
- Cause: Ganache not configured to save state
- Solution:

  ```powershell
  # Desktop: Check workspace save location
  # Create new workspace: File → New Workspace
  # Save workspace before restarting

  # CLI: Use same mnemonic for deterministic accounts
  ganache --deterministic \
    --host 0.0.0.0 \
    --port 8545 \
    --mnemonic "SAME_MNEMONIC_FOR_CONSISTENCY"
  ```

### Issue: Smart Contracts Won't Deploy

**Symptoms:**

- Deployment script fails
- Contract address shows as 0x0
- "Insufficient gas" or "Transaction reverted" errors

**Diagnostic Steps:**

```powershell
# 1. Check contract compilation
cd Blockchain
npx hardhat compile

# 2. Verify private key
echo $env:PRIVATE_KEY

# 3. Check account balance
python -c "
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))
address = w3.eth.account.from_key('$env:PRIVATE_KEY').address
print(f'Address: {address}')
print(f'Balance: {w3.eth.get_balance(address)} wei')
"

# 4. Test deployment
python scripts/deploy_contracts.py
```

**Common Root Causes & Solutions:**

**A. Invalid Private Key**

- Error: `ValueError: The private key must contain 0x and 64 hex characters`
- Cause: Private key wrong format or missing
- Solution:

  ```powershell
  # Get private key from Ganache
  # Desktop: Accounts tab → click key icon
  # CLI: Will show at startup (first account)

  # Update Blockchain/.env (no 0x prefix needed)
  # PRIVATE_KEY=abc123...
  ```

**B. Insufficient Gas**

- Error: `Error: Transaction reverted: VM Exception while processing transaction: out of gas`
- Cause: Gas limit too low for contract bytecode
- Solution:

  ```powershell
  # Increase gas limit in Blockchain/.env
  # GAS_LIMIT=8000000  # Default for large contracts
  # GAS_PRICE=20000000000

  # Or optimize contract size (remove unused functions)
  ```

**C. Wrong Network Chain ID**

- Error: `Error: Chain ID mismatch` or account not found
- Cause: Contract deployment to wrong network
- Solution:

  ```powershell
  # Verify chain ID matches Ganache
  # Desktop: Settings → Server → Network ID (usually 1337)
  # CLI: Default chain ID 1337

  # Update Blockchain/.env
  # ETH_CHAIN_ID=1337

  # Verify Web3 connection
  python -c "
  from web3 import Web3
  w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))
  print(f'Chain ID: {w3.eth.chain_id}')
  print(f'Network: {w3.net.version}')
  "
  ```

### Issue: Incident Verification Endpoint Returns Error

**Symptoms:**

- `POST /api/incidents/:id/verify` returns 500
- Transaction won't submit to blockchain
- "Contract not found" or "Invalid incident ID"

**Diagnostic Steps:**

```powershell
# 1. Check contract is deployed
curl http://localhost:8001/health

# 2. Verify incident exists in database
psql -U postgres rescuelink_dev -c "
  SELECT id, title, status FROM incidents WHERE id = 123;
"

# 3. Test blockchain directly
python -c "
from services.blockchain import IncidentVerifier
verifier = IncidentVerifier()
result = verifier.verify_incident(123, 'test_evidence_hash')
print(result)
"

# 4. Check gas estimation
# Transaction might fail due to insufficient gas
```

**Common Root Causes & Solutions:**

**A. Incident Not Found**

- Error: `Error: Incident 123 not found`
- Solution:

  ```powershell
  # Use valid incident ID
  psql -U postgres rescuelink_dev -c "
    SELECT id FROM incidents ORDER BY created_at DESC LIMIT 5;
  "

  # Test with valid ID
  curl http://localhost:3000/api/incidents/1/verify
  ```

**B. Contract Function Not Matching**

- Error: `Error: Contract method signature mismatch`
- Cause: Solidity contract API changed but Python service hasn't updated
- Solution:

  ```powershell
  # Verify contract deployed correctly
  python scripts/check_contract_functions.py

  # Redeploy if needed
  python scripts/deploy_contracts.py --force
  ```

---

## Web Dashboard Troubleshooting

### Issue: Web App Won't Load

**Symptoms:**

- Browser shows blank page
- 404 error on localhost:5173
- Network error connecting to backend

**Diagnostic Steps:**

```powershell
# 1. Check if dev server running
netstat -ano | findstr :5173

# 2. Start dev server
cd Frontend/Web/dispatcher_dashboard
npm run dev

# 3. Check browser console (F12)
# Look for JavaScript errors or CORS issues

# 4. Verify backend connectivity
# In browser console:
fetch('http://localhost:3000/health')
  .then(r => r.json())
  .then(d => console.log(d))
  .catch(e => console.error(e))
```

**Common Root Causes & Solutions:**

**A. Dev Server Not Started**

- Error: `Connection refused` on localhost:5173
- Solution:
  ```powershell
  cd Frontend/Web/dispatcher_dashboard
  npm install
  npm run dev
  ```

**B. Backend CORS Blocked**

- Error: `Access to XMLHttpRequest blocked by CORS policy`
- Cause: Frontend origin not whitelisted in backend
- Solution:

  ```powershell
  # Check Backend/.env
  # CORS_ORIGIN should include http://localhost:5173

  # Update if needed
  # CORS_ORIGIN=http://localhost:5173,http://localhost:3000

  # Restart backend
  cd Backend
  npm run dev
  ```

**C. API Base URL Wrong**

- Error: Requests going to wrong URL or failing silently
- Solution:

  ```powershell
  # Check Frontend/.env
  # VITE_API_BASE_URL=http://localhost:3000/api

  # Verify in browser Network tab (F12)
  # Requests should go to http://localhost:3000/api/*
  ```

### Issue: Login Not Working

**Symptoms:**

- Login button doesn't respond
- Redirects back to login after auth
- "Invalid credentials" even with correct password

**Diagnostic Steps:**

```powershell
# 1. Test backend auth endpoint directly
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@rescuelink.test","password":"dispatcher123"}'

# 2. Check backend logs
# Look for authentication errors

# 3. Verify user exists in database
psql -U postgres rescuelink_dev -c "
  SELECT id, email, role FROM users WHERE email='dispatcher@rescuelink.test';
"

# 4. Check browser storage (F12)
# localStorage should have JWT token after login
```

**Common Root Causes & Solutions:**

**A. User Account Not Created**

- Error: `User not found` from backend
- Solution:

  ```powershell
  # Seed test users
  cd Backend
  npm run seed-db

  # Or create manually
  psql -U postgres rescuelink_dev -c "
    INSERT INTO users (email, password_hash, role)
    VALUES ('test@example.com', 'bcrypt_hash', 'dispatcher');
  "
  ```

**B. Wrong Password**

- Error: `Invalid password` from backend
- Solution:

  ```powershell
  # Use seeded test account
  # Email: dispatcher@rescuelink.test
  # Password: dispatcher123

  # Or reset password via API
  curl -X POST http://localhost:3000/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com"}'
  ```

**C. Cookie/Token Not Persisting**

- Error: Login succeeds but logged out on page refresh
- Cause: Browser blocking localStorage or insecure cookie settings
- Solution:

  ```powershell
  # Check browser settings (F12 → Storage → Cookies/LocalStorage)
  # Verify token is being saved

  # Try incognito mode (no extensions blocking)

  # Check backend .env for secure cookie settings
  # SECURE_COOKIE should be false for development
  ```

---

## Mobile App Troubleshooting

### Issue: App Won't Connect to Backend

**Symptoms:**

- "Network error" when trying to create incident
- App loads but all API calls fail
- Location cannot be obtained

**Diagnostic Steps:**

```powershell
# 1. Verify backend running and accessible
curl http://localhost:3000/health

# 2. Check app API_BASE_URL configuration
# Look for API_BASE_URL in app startup logs

# 3. Test from emulator/device
# Use 10.0.2.2 for Android emulator (special alias for host)
# Use actual LAN IP for physical device

# 4. Check firewall
# Verify port 3000 is accessible from device/emulator
```

**Common Root Causes & Solutions:**

**A. Using localhost Instead of LAN IP**

- Error: `Connection refused` from emulator/physical device
- Cause: localhost refers to device itself, not development machine
- Solution:

  ```powershell
  # Get LAN IP
  ipconfig | findstr "IPv4 Address"

  # Run with correct IP
  flutter run --dart-define=API_BASE_URL=http://192.168.1.100:3000
  ```

**B. Android Emulator Special Alias**

- Error: `Connection refused` specifically on Android emulator
- Solution:

  ```powershell
  # Android emulator maps host as 10.0.2.2
  flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

  # iOS simulator uses host's actual IP
  # Physical devices use LAN IP
  ```

**C. Firewall Blocking Port**

- Error: `Connection timeout` after 30 seconds
- Cause: Firewall or router blocking port 3000
- Solution:

  ```powershell
  # Check Windows Firewall
  # Settings → Privacy & Security → Windows Defender Firewall → Allow an app through firewall
  # Add Node.js or disable firewall for testing

  # Or test with enabled firewall
  netsh advfirewall firewall add rule name="Allow Port 3000" dir=in action=allow protocol=tcp localport=3000
  ```

### Issue: Microphone Permission Not Granted

**Symptoms:**

- App prompts for microphone but doesn't use it
- Audio recording fails silently
- "Permission denied" error

**Diagnostic Steps:**

```powershell
# 1. Check device permissions
# Android: Settings → Apps → RescueLink → Permissions → Microphone
# iOS: Settings → Privacy → Microphone → Find RescueLink

# 2. Test microphone directly
# Android: Android Studio → Logcat → search for "RECORD_AUDIO"
# iOS: Console.app → search for microphone

# 3. Check app logs
flutter run  # View console output
```

**Common Root Causes & Solutions:**

**A. Permissions Not Declared in Manifest**

- Cause: AndroidManifest.xml or Info.plist missing permission declarations
- Solution:
  ```xml
  <!-- android/app/src/main/AndroidManifest.xml -->
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  ```
  ```xml
  <!-- ios/Runner/Info.plist -->
  <key>NSMicrophoneUsageDescription</key>
  <string>RescueLink needs microphone to record emergency reports</string>
  ```

**B. Runtime Permissions Not Requested**

- Cause: Android 6+ requires runtime permission requests
- Solution:

  ```dart
  // Fix in Flutter code
  import 'package:permission_handler/permission_handler.dart';

  final status = await Permission.microphone.request();
  if (status.isDenied) {
    print('Microphone permission denied');
  }
  ```

**C. Microphone Not Available**

- Cause: Device has no microphone or it's hardware-disabled
- Solution:
  ```powershell
  # Test with emulator that has audio support
  # Android Emulator: AVD Manager → Edit device → Advanced Settings → Audio Input
  ```

---

## Database Troubleshooting

### Issue: Database Connection Fails on Startup

**Symptoms:**

- "connect ECONNREFUSED"
- Backend won't start
- "Error: database connection failed"

**Diagnostic Steps:**

```powershell
# 1. Check PostgreSQL service status
# Windows: Services → PostgreSQL
# macOS: brew services list | grep postgres
# Linux: sudo systemctl status postgresql

# 2. Verify connection string format
# Should be: postgresql://user:password@host:port/database

# 3. Test connection directly
psql -U postgres -h localhost -p 5432 -d rescuelink_dev

# 4. Check PostgreSQL logs
# Windows: C:\Program Files\PostgreSQL\15\data\log\
# macOS: /usr/local/var/log/postgres.log
```

**Common Root Causes & Solutions:**

**A. PostgreSQL Service Not Running**

- Solution:

  ```powershell
  # Windows
  net start postgresql-x64-15

  # macOS
  brew services start postgresql

  # Linux
  sudo systemctl start postgresql
  ```

**B. Wrong Credentials in .env**

- Solution:

  ```powershell
  # Verify .env DATABASE_URL format
  # postgresql://postgres:postgres@localhost:5432/rescuelink_dev

  # Test with psql directly
  psql -U postgres -p 5432 -c "SELECT 1"
  ```

**C. Database Doesn't Exist**

- Error: `FATAL: database "rescuelink_dev" does not exist`
- Solution:

  ```powershell
  # Create database
  createdb -U postgres rescuelink_dev

  # Or through backend setup
  cd Backend
  npm run setup-db
  ```

### Issue: Migration Errors or Rollback Failures

**Symptoms:**

- "Migration failed: column already exists"
- Rollback won't work
- Schema inconsistent with migrations

**Diagnostic Steps:**

```powershell
# 1. Check migration status
npm run migrate:status

# 2. Verify schema
psql -U postgres rescuelink_dev -c "\dt"
psql -U postgres rescuelink_dev -c "\d incidents"

# 3. Check migrations directory
ls Backend/migrations/ | sort

# 4. Look for partial migrations
psql -U postgres rescuelink_dev -c "
  SELECT * FROM sequelize_meta ORDER BY name;
"
```

**Common Root Causes & Solutions:**

**A. Duplicate Column or Index**

- Error: `Error: column "x" already exists`
- Cause: Migration ran partially or ran twice
- Solution:

  ```powershell
  # Check if column exists
  psql -U postgres rescuelink_dev -c "\d incidents" | grep column_name

  # If it does, skip migration
  # Edit migration to add IF NOT EXISTS

  # Or reset and reapply
  npm run migrate:reset
  npm run migrate
  ```

**B. Migration Out of Order**

- Cause: Migrations ran in wrong sequence
- Solution:

  ```powershell
  # Check execution order
  psql -U postgres rescuelink_dev -c "
    SELECT name FROM sequelize_meta ORDER BY name;
  "

  # Rename migrations with timestamps if needed
  # Format: YYYYMMDDHHMMSS-description.js
  ```

**C. Rollback Not Reverting Changes**

- Cause: Undo migration incomplete or missing
- Solution:

  ```powershell
  # Manually revert problematic migration
  psql -U postgres rescuelink_dev -c "
    DELETE FROM sequelize_meta WHERE name = 'problematic_migration.js';
  "

  # Or fix the migration file .down() method
  ```

---

## File Upload & Scanning Troubleshooting

### Issue: File Upload Fails or Hangs

**Symptoms:**

- Upload endpoint returns error
- Request times out after 30 seconds
- File partially uploaded

**Diagnostic Steps:**

```powershell
# 1. Check disk space
Get-PSDrive
# Need at least 5 GB free for uploads directory

# 2. Verify upload directory exists and writable
ls Backend/uploads/
ls Backend/uploads/_quarantine/

# 3. Test with small file
curl -X POST http://localhost:3000/api/incidents/with-audio \
  -F "file=@small-test.mp3" \
  -F "latitude=16.0433" \
  -F "longitude=120.7275"

# 4. Check file size limits
cat Backend/.env | grep MAX_FILE_SIZE
```

**Common Root Causes & Solutions:**

**A. Disk Space Exhausted**

- Error: `Error: ENOSPC: no space left on device`
- Solution:

  ```powershell
  # Free up disk space
  # Delete old uploads if safe
  rm -r Backend/uploads/*

  # Or move uploads to different drive
  # Update Backend/.env UPLOAD_DIR=/mnt/large-drive/uploads
  ```

**B. File Size Exceeds Limit**

- Error: `413 Payload Too Large`
- Solution:

  ```
  # Increase limit in Backend/.env
  MAX_FILE_SIZE_AUDIO=104857600    # 100 MB
  MAX_FILE_SIZE_VIDEO=1073741824   # 1 GB

  # Or compress file before upload
  ffmpeg -i large-video.mp4 -c:v libx264 -crf 28 compressed-video.mp4
  ```

**C. Upload Directory Not Writable**

- Error: `Error: EACCES: permission denied`
- Solution:
  ```powershell
  # Set correct permissions
  # Windows: Right-click uploads/ → Properties → Security → Full Control
  # macOS/Linux: chmod 755 Backend/uploads/
  ```

### Issue: File Scan Gets Stuck

**Symptoms:**

- File stuck in "pending" scan status
- Scan worker not processing files
- Admin sees endless procrastination for incidents

**Diagnostic Steps:**

```powershell
# 1. Check scan worker running
# Look for scan worker process
ps aux | grep scan

# 2. Check scan queue
psql -U postgres rescuelink_dev -c "
  SELECT id, scan_status, file_path, created_at
  FROM incident_files
  WHERE scan_status = 'pending'
  ORDER BY created_at DESC;
"

# 3. Check scanner service health
curl http://localhost:8000/health

# 4. Check logs for errors
tail -100 logs/error.log | grep -i scan
```

**Common Root Causes & Solutions:**

**A. Scan Worker Process Crashed**

- Cause: Scanner worker died silently
- Solution:

  ```powershell
  # Restart worker
  npm run start:scan-worker

  # Or add to PM2 for auto-restart
  pm2 start "npm run start:scan-worker" --name "scan-worker"
  pm2 logs scan-worker
  ```

**B. Scanner Service Unreachable**

- Error: Cannot connect to VirusTotal/ClamAV API
- Solution:

  ```powershell
  # Test scanner connectivity
  curl https://www.virustotal.com/api/v3/health -H "x-apikey: YOUR_API_KEY"

  # Update Backend/.env with valid API key
  # SCANNER_API_KEY=your_valid_api_key

  # Or switch to local ClamAV
  # SCANNER_TYPE=clamav
  # CLAMAV_HOST=localhost
  # CLAMAV_PORT=3310
  ```

**C. File Path Not Found**

- Error: Scanner tries to scan but file missing
- Cause: File deleted but database record remains
- Solution:

  ```powershell
  # Verify files exist
  ls Backend/uploads/ | wc -l

  # Clean up orphaned records
  psql -U postgres rescuelink_dev -c "
    DELETE FROM incident_files
    WHERE scan_status = 'pending'
    AND created_at < NOW() - interval '24 hours';
  "
  ```

### Issue: Quarantined File Can't Be Released

**Symptoms:**

- Admin clicks "Release" button but nothing happens
- File remains in quarantine
- Error on release operation

**Diagnostic Steps:**

```powershell
# 1. Check quarantine directory
ls Backend/uploads/_quarantine/

# 2. Verify file permissions
# File should be readable and writable

# 3. Check incident scan status
psql -U postgres rescuelink_dev -c "
  SELECT id, scan_status FROM incident_files
  WHERE scan_status = 'quarantined';
"

# 4. Test release directly
curl -X POST http://localhost:3000/api/admin/quarantine/123/release \
  -H "Authorization: Bearer <admin_token>"
```

**Common Root Causes & Solutions:**

**A. Admin Not Authorized**

- Error: `403 Forbidden`
- Cause: User doesn't have admin role
- Solution:

  ```powershell
  # Verify user is admin
  psql -U postgres rescuelink_dev -c "
    SELECT email, role FROM users WHERE email = 'your-email@test.com';
  "

  # Update role if needed
  psql -U postgres rescuelink_dev -c "
    UPDATE users SET role = 'admin' WHERE email = 'your-email@test.com';
  "
  ```

**B. File Already Deleted**

- Error: File not found after claiming it's quarantined
- Solution:
  ```powershell
  # Check what happened
  # Review audit logs for deletion
  psql -U postgres rescuelink_dev -c "
    SELECT * FROM audit_logs
    WHERE action = 'file_deleted'
    ORDER BY created_at DESC;
  "
  ```

**C. Incident Not Found**

- Error: `404 Incident not found`
- Solution:
  ```powershell
  # Use valid incident ID
  psql -U postgres rescuelink_dev -c "
    SELECT id FROM incidents ORDER BY created_at DESC LIMIT 5;
  "
  ```

---

## Security & Authentication Troubleshooting

### Issue: JWT Token Validation Fails

**Symptoms:**

- `401 Unauthorized` on protected endpoints
- Token is valid but rejected
- "Invalid signature" error

**Diagnostic Steps:**

```powershell
# 1. Decode JWT to check contents
node -e "
const jwt = require('jsonwebtoken');
const token = 'eyJh...'; // Your token
const decoded = jwt.decode(token, {complete: true});
console.log(JSON.stringify(decoded, null, 2));
"

# 2. Verify expiry
node -e "
const jwt = require('jsonwebtoken');
const token = 'eyJh...';
const decoded = jwt.decode(token);
console.log('Expires:', new Date(decoded.exp * 1000));
"

# 3. Check JWT_SECRET matches
grep JWT_SECRET Backend/.env

# 4. Test token manually
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/me
```

**Common Root Causes & Solutions:**

**A. Token Expired**

- Error: `401 Unauthorized - Token expired`
- Cause: Token issued >7 days ago
- Solution:
  ```powershell
  # Generate new token
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"password"}'
  ```

**B. Wrong JWT_SECRET**

- Error: `401 Unauthorized - Invalid signature`
- Cause: Backend .env JWT_SECRET changed but token issued with old secret
- Solution:

  ```powershell
  # Check current JWT_SECRET
  grep JWT_SECRET Backend/.env

  # If changed, all old tokens invalid - users must re-login
  # Or revert JWT_SECRET to previous value if known
  ```

**C. Token Blacklisted After Logout**

- Error: `401 Unauthorized - Token blacklisted`
- Cause: User logged out and token added to blacklist
- Solution:

  ```powershell
  # User must login again to get new token

  # Or check blacklist storage
  # Blacklist kept in memory; cleared on server restart
  ```

### Issue: Password Reset Link Doesn't Work

**Symptoms:**

- Reset link returns 404
- Token invalid or expired
- "Invalid token" error

**Diagnostic Steps:**

```powershell
# 1. Test reset endpoint
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# 2. Check if email configured
grep EMAIL Backend/.env

# 3. Verify token generation
# Check database for reset tokens
psql -U postgres rescuelink_dev -c "
  SELECT id, email, reset_token, reset_token_expires
  FROM users
  WHERE reset_token IS NOT NULL;
"

# 4. Test token validation
curl -X POST http://localhost:3000/api/auth/reset-password-with-token \
  -H "Content-Type: application/json" \
  -d '{
    "token":"<reset_token>",
    "password":"NewPass123!"
  }'
```

**Common Root Causes & Solutions:**

**A. Token Expired**

- Error: `400 Bad Request - Token expired`
- Cause: Reset token valid for only 2 hours
- Solution:
  ```powershell
  # Request new reset link
  curl -X POST http://localhost:3000/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com"}'
  ```

**B. Email Not Configured**

- Symptom: Email endpoint succeeds but no email received
- Solution:
  ```
  # Configure email service in Backend/.env
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@gmail.com
  SMTP_PASS=app-password
  SMTP_FROM=noreply@rescuelink.app
  ```

**C. Token Already Used**

- Error: `400 Bad Request - Token already used`
- Cause: Same reset token used twice
- Solution:
  ```powershell
  # Request new reset link
  # Each reset token can only be used once for security
  ```

---

## Performance & Optimization Troubleshooting

### Issue: Slow Incident Creation

**Symptoms:**

- Incident creation takes >5 seconds
- Users report timeout errors
- AI transcription is bottleneck

**Diagnostic Steps:**

```powershell
# 1. Profile endpoint timing
# Add timing logs to see which step is slow
curl -X POST http://localhost:3000/api/incidents/with-audio \
  -H "Authorization: Bearer <token>" \
  -F "file=@audio.mp3" \
  -F "latitude=16.0433" \
  -F "longitude=120.7275" \
  -v 2>&1 | grep -i time

# 2. Check AI service response time
time curl http://localhost:8000/transcribe -F "file=@audio.mp3"

# 3. Monitor database queries
tail logs/queries.log | grep slow

# 4. Check system resources
Get-Process | Sort-Object CPU -Descending | Select -First 5
```

**Common Root Causes & Solutions:**

**A. AI Transcription Slow**

- Cause: Whisper model processing takes 10-30 seconds per audio
- Solution:

  ```powershell
  # Use faster Whisper model variant
  # RescueLink AI/.env
  MODEL_WHISPER_PATH=./models/whisper-tiny  # Faster, less accurate
  # or
  MODEL_WHISPER_PATH=./models/whisper-small

  # Or disable transcription for development
  SKIP_TRANSCRIPTION=true
  ```

**B. Database Insert is Slow**

- Cause: Many indexes being updated on large table
- Solution:
  ```powershell
  # Disable indexes during bulk inserts
  # Or add index for frequently queried columns
  psql -U postgres rescuelink_dev -c "
    CREATE INDEX CONCURRENTLY idx_incidents_created_at
    ON incidents(created_at)
    WHERE status != 'closed';
  "
  ```

**C. File Upload is Slow**

- Cause: Large audio file upload limited by network
- Solution:
  ```powershell
  # Implement chunked uploads
  # Or use background job for file processing
  # Make API response immediately, process async
  ```

---

## VS Code Debugger Troubleshooting

### Issue: Breakpoints Not Triggering

**Symptoms:**

- Set breakpoint but it doesn't pause
- Debugger doesn't attach
- "Unverified breakpoint" warning

**Solutions:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend Debug",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/Backend/node_modules/.bin/nodemon",
      "args": ["src/index.js"],
      "cwd": "${workspaceFolder}/Backend",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "runtimeArgs": ["--inspect-brk=9229"]
    },
    {
      "type": "python",
      "name": "AI Debug",
      "request": "launch",
      "program": "-m",
      "module": "uvicorn",
      "args": ["api.main:app", "--reload"],
      "jinja": true,
      "cwd": "${workspaceFolder}/RescueLink AI",
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  ]
}
```

---

## Network & Connectivity Troubleshooting

### Issue: Services Can't Communicate

**Symptoms:**

- Backend can't reach AI service
- "Connection refused" between services
- Timeout errors on inter-service calls

**Solutions:**

```powershell
# 1. Test direct connectivity
# Backend → AI
curl http://localhost:8000/health

# Backend → Blockchain
curl http://localhost:8001/health

# 2. Check DNS resolution
nslookup localhost
nslookup 127.0.0.1

# 3. Check firewall rules
# Verify ports are accessible from each service

# 4. Test with verbose output
curl -v http://localhost:8000/health
```

---

## Getting Help & Escalation

If troubleshooting steps above don't resolve your issue:

1. **Gather diagnostic information**:

   ```powershell
   # Create diagnostic report
   npm run diagnostics > diag-report.txt
   flutter doctor > flutter-diag.txt
   python --version > python-diag.txt
   ```

2. **Check project issues**:
   - GitHub Issues: Search for similar problems
   - Documentation: Review README files in each service folder

3. **Review logs thoroughly**:

   ```powershell
   # Combine all logs
   cat logs/*.log > combined-logs.txt

   # Search for errors
   grep -i error combined-logs.txt
   grep -i exception combined-logs.txt
   ```

4. **Ask for help with context**:
   - Diagnostic reports
   - Error messages (full text, not summarized)
   - `.env` file (with secrets redacted)
   - Steps to reproduce
   - What you've already tried
