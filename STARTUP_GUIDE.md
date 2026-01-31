# RescueLink Startup Guide

Quick reference for starting all required services before manual testing.

---

## Prerequisites

- ✅ PostgreSQL database running (default port 5432)
- ✅ Node.js installed (Backend)
- ✅ Python 3.13+ with virtual environment (AI Service)
  - **Note:** Virtual environment is located at `RescueLink/.venv` (root folder, not in RescueLink AI)
- ✅ Flutter SDK installed and in PATH (Mobile)
- ✅ Android Emulator or Physical Device connected (Mobile)

---

## Services to Start (in order)

### 1. Backend Server (Node.js/Express)

**Location:** `Backend/`

**Command:**
```powershell
cd Backend
npm run dev
```

**Expected Output:**
- Server runs on `http://localhost:3000` (or configured port)
- Database connection established

**API Endpoints:**
- Auth: `/api/auth/register`, `/api/auth/login`
- Incidents: `/api/incidents`
- Dispatch: `/api/dispatch`
- Responders: `/api/responders`

---

### 2. AI Classification Service (FastAPI)

**Location:** `RescueLink AI/`

**Commands:**
```powershell
cd "RescueLink AI"
& "../.venv/Scripts/Activate.ps1"  # Or use absolute path if relative path fails
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**If activation fails, use absolute path:**
```powershell
cd "RescueLink AI"
& "C:\Users\Aaron\GitHub Repos\RescueLink\.venv\Scripts\Activate.ps1"
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
- FastAPI server runs on `http://localhost:8000`
- Model loaded successfully
- Interactive docs at `http://localhost:8000/docs`

**API Endpoints:**
- Health: `GET /health`
- Classify: `POST /classify`
- Labels: `GET /labels`

**Note:** Ensure `models/emergency_model.pt` and `models/label_meta.json` exist before starting.

---

### 3. Mobile App (Flutter)

**Location:** `Frontend/Mobile/`

**Commands:**
```powershell
cd Frontend\Mobile
flutter pub get  # Get dependencies (first time or after pubspec changes)
flutter run      # Run on connected device/emulator
```

**Expected Output:**
- App compiles and launches on connected device/emulator
- Hot reload enabled for development

**Alternative:** Use `run.bat` or `run.ps1` in the Mobile folder.

---

### 4. Jupyter Notebook (Optional - For AI Training/Testing)

**Location:** `RescueLink AI/`

**Commands:**
```powershell
cd "RescueLink AI"
& "../.venv/Scripts/Activate.ps1"  # Virtual environment is in parent folder
jupyter notebook RescueLinkAi.ipynb
```

**Expected Output:**
- Jupyter server runs on `http://localhost:8888`
- Browser opens with notebook interface
- Used for training AI model or manual testing

**Note:** Only needed if you want to retrain the model or test predictions interactively. Not required for running the app.

---

## Quick Start (All Services)

Open **3 separate terminals** in VS Code (required):

**Terminal 1 - Backend:**
```powershell
cd Backend
npm run dev
```

**Terminal 2 - AI Service:**
```powershell
cd "RescueLink AI"
& "../.venv/Scripts/Activate.ps1"
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Mobile:**
```powershell
cd Frontend\Mobile
flutter run
```

**Optional Terminal 4 - Jupyter (for AI training/testing):**
```powershell
cd "RescueLink AI"
& "../.venv/Scripts/Activate.ps1"
jupyter notebook RescueLinkAi.ipynb
```

---

## Service Status Check

### Backend
```powershell
curl http://localhost:3000/api/health  # Or your configured health endpoint
```

### AI Service
```powershell
curl http://localhost:8000/health
```

### Mobile
- App should be visible on device/emulator
- Check VS Code debug console for logs

---

## Stopping Services

- **Backend:** Press `Ctrl+C` in terminal
- **AI Service:** Press `Ctrl+C` in terminal
- **Mobile:** Press `Ctrl+C` in terminal or press `q` in Flutter CLI

---

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify `.env` file exists with correct `DATABASE_URL` and `JWT_SECRET`
- Run `npm install` if dependencies missing

### AI Service won't start
- **Virtual environment path error:** The venv is in `RescueLink/.venv`, not `RescueLink AI/.venv`
  - Use relative path: `& "../.venv/Scripts/Activate.ps1"` from RescueLink AI folder
  - Or use absolute path: `& "C:\Users\Aaron\GitHub Repos\RescueLink\.venv\Scripts\Activate.ps1"`
- Check model files exist: `models/emergency_model.pt` and `models/label_meta.json`
- Run `pip install -r requirements.txt` if dependencies missing
- Run from `RescueLink AI/` folder using `uvicorn api.main:app`
- Verify current directory with `pwd` before running uvicorn

### Mobile won't run
- Verify Flutter is in PATH: `flutter --version`
- Check device/emulator is connected: `flutter devices`
- Run `flutter pub get` to install dependencies
- Clear build cache: `flutter clean` then `flutter pub get`

### Port conflicts
- Backend default: 3000 (check `.env` for PORT variable)
- AI Service default: 8000 (change with `--port` flag)
- Change ports if already in use by other applications

---

## Development Tips

- Use **nodemon** for backend auto-reload (included with `npm run dev`)
- Use **--reload** flag for AI service auto-reload (included in command)
- Use **hot reload** in Flutter (press `r` in terminal or save files)
- Keep all 3 terminals visible for monitoring logs
- Check backend `.env` file for AI service URL configuration

---

## Testing Workflow

1. Start all services (Backend → AI → Mobile)
2. Verify all health endpoints respond
3. Open mobile app on device/emulator
4. Test emergency report submission
5. Monitor terminal logs for request flow:
   - Mobile → Backend → AI Service → Backend → Mobile

---

## Production Notes

For production deployment:
- Backend: Use `npm start` instead of `npm run dev`
- AI Service: Remove `--reload` flag and set workers: `uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4`
- Mobile: Build release APK/IPA instead of debug version
- Configure environment variables for production URLs
