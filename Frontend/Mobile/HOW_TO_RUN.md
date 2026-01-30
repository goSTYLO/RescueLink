# How to Run the Flutter App

## Quick Start (Easiest Way)

### Option 1: Double-click the batch file
1. Navigate to: `c:\Users\User\Documents\GitHub\RescueLink\Frontend\Mobile`
2. Double-click `run.bat`
3. Wait for the app to launch

### Option 2: From Cursor/VS Code
1. **Open the Mobile folder in Cursor:**
   - File → Open Folder
   - Select: `c:\Users\User\Documents\GitHub\RescueLink\Frontend\Mobile`
   - (NOT the entire RescueLink folder - just the Mobile folder)

2. **Open the terminal in Cursor:**
   - Press `Ctrl + `` (backtick) or View → Terminal

3. **Run these commands:**
   ```bash
   flutter pub get
   flutter run
   ```

### Option 3: Using Run Button in Cursor
1. Open the entire `RescueLink` folder in Cursor
2. Open `Frontend/Mobile/lib/main.dart`
3. Press `F5` or click the Run button
4. Select "Flutter: Run Mobile App" from the dropdown

## Troubleshooting

### Error: "expected to find project root"
**Solution:** Make sure you're running Flutter commands from the `Frontend/Mobile` directory, not from the repo root.

### Error: "Unable to load asset"
**Solution:** Run `flutter pub get` first, then `flutter run`

### Error: "flutter: command not found"
**Solution:** 
1. Install Flutter: https://docs.flutter.dev/get-started/install/windows
2. Add Flutter to your PATH
3. Restart Cursor/VS Code

## Required Setup

1. **Flutter SDK installed** (version 3.0.0 or higher)
2. **Flutter extension installed in Cursor:**
   - Press `Ctrl+Shift+X` to open Extensions
   - Search for "Flutter"
   - Install the official Flutter extension

3. **Device/Emulator:**
   - Android Studio with an emulator running, OR
   - A physical device connected with USB debugging enabled

## Verify Everything Works

Run this command from `Frontend/Mobile`:
```bash
flutter doctor
```

This will check if everything is set up correctly.
