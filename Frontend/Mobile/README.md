# RescueLink Mobile App

Flutter mobile application for RescueLink built with BLoC architecture.

## Volunteer Responder Onboarding (Credential-Based)

Citizens can apply to become Volunteer First Responders directly from the settings screen in the mobile app:
- **Entry Point**: `Apply as First Responder` item in `Settings` under Account Information.
- **Multi-Tab Application Flow (`ResponderOnboardingScreen`)**:
  - **Tab 1: Terms & Conditions**: Scrollable program terms with mandatory agreement checkbox.
  - **Tab 2: Role Overview**: Responsibilities and safety expectations for volunteer responders.
  - **Tab 3: Requirements Checklist**: Mandatory Government ID upload plus optional Training Certificates and Supporting Documents (supports images and PDFs via `file_picker`).
  - **Tab 4: Application Form**: Pre-filled personal details and required emergency contact person details with application submit action.
- **Status & Transparency Screen (`ApplicationStatusScreen`)**:
  - Displays application status (`Pending Review`, `Approved`, or `Not Approved`).
  - Upon rejection, reviewer notes are displayed to the user for full transparency with an option to submit a new application.

## Duplicate Incident Management

Duplicate incident linking is a **dispatcher-only** feature available on the web dashboard. The mobile app does not include duplicate management UI. When creating an incident, the backend may return a response indicating a potential related incident; that is informational only. Dispatchers verify and link duplicates via the web app.

## Session Updates (Incident + Notification Integration)

Recent mobile updates:

- **Incident Details notification access**:
  - notification bell icon added to the Incident Details header (next to logo).
  - tapping opens the Notifications screen, consistent with Report History and Settings.
  - optional `onNotificationsTap` callback allows parent override; default pushes Notifications screen.
- **Exit confirmation**:
  - `PopScope` on home shows confirmation dialog when user attempts to exit the app.
- **Logout confirmation UX**:
  - "Log out from all devices" copy updated to "End all active sessions on your phone and tablet" (removed "and web browser").
  - Cancel button uses `theme.colorScheme.onSurface` and `theme.colorScheme.outline` for correct visibility in dark mode.
- **Unified incident experience**:
  - `Emergency Tracking` and `Report Details` were merged into a single `Incident Details` screen.
  - incident layout is tracking-first (status, timeline, responder availability/location placeholders, then details/evidence).
  - opening from submit flow and report history now routes to the same incident screen.
- **Incident lifecycle UX alignment**:
  - mobile status rendering supports canonical flow including `in_progress`.
  - reporter confirmation action is available after dispatcher/admin marks incident `resolved`.
- **Swipe-to-refresh coverage**:
  - `Report History` supports pull-to-refresh for latest incidents.
  - `Incident Details` supports pull-to-refresh for latest status, AI fields, and evidence metadata.
- **Inline evidence UX**:
  - voice recording supports inline play/pause/progress and file download.
  - attached images support inline preview and download.
  - attached videos currently use download flow (inline video preview/playback is pending).
- **Notifications integration**:
  - notifications screen is backend-driven via `/api/notifications`.
  - pull-to-refresh, loading/error/empty states, and dynamic card styling by `sent_via`.
  - **Mark all as read** supported via `POST /api/notifications/mark-all-read`.
  - **Notification badge** on Report History, Incident Details, and Home screens.
  - **Richer notification cards**: collapsed view shows incident type + preview (e.g. "Fire • Status updated to In Progress"); expanded view shows incident type, status update, full message, and View button.
  - Tap to expand/collapse; View button navigates to incident details.
- **API error handling hardening**:
  - `ApiService` now rethrows `ApiException` consistently so screen-level messages preserve backend context.
  - incident detail loading now handles `/with-ai` fallback more strictly (falls back only when endpoint is unavailable).

## Prerequisites

- Flutter SDK (3.0.0 or higher)
- Dart SDK (3.0.0 or higher)
- Android Studio / Xcode (for mobile development)
- VS Code or Android Studio (recommended IDE)

## Setup Instructions

1. **Install Flutter**
   - Follow the official Flutter installation guide: https://flutter.dev/docs/get-started/install
   - Verify installation: `flutter doctor`

2. **Install Dependencies**
   ```bash
   cd Frontend/Mobile
   flutter pub get
   ```

3. **Configure API Base URL (emulator vs real device)**
   - **Android emulator** (default): `flutter run` — uses `http://10.0.2.2:3000`
   - **Real device**: use your PC’s LAN IP, e.g.  
     `flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3000`
   - **iOS simulator**: `flutter run --dart-define=API_BASE_URL=http://localhost:3000`  
   See `.env.example` for details.

4. **Google reCAPTCHA v2 (for real verification)**  
   To use real Google reCAPTCHA on the verification screen, get your site key at https://www.google.com/recaptcha/admin (reCAPTCHA v2 "I'm not a robot"), then run:  
   `flutter run --dart-define=RECAPTCHA_SITE_KEY=your_site_key`  
   If you don't set this, the app shows a simple checkbox instead (no real reCAPTCHA).

5. **Run the App**
   ```bash
   flutter run
   ```

## Troubleshooting: Force Full Rebuild (Windows / PowerShell)

If `flutter run` installs an older version of the app, use these steps to force a full clean rebuild and reinstall.

1. Stop any running `flutter run` (Ctrl+C).
2. Clean Flutter and Gradle artifacts and refresh packages:

```powershell
flutter clean
Remove-Item -Recurse -Force .\build
Remove-Item -Recurse -Force .\android\app\build
cd android
.\gradlew.bat clean
cd ..
flutter pub get
```

3. (Optional) Repair pub cache:

```powershell
flutter pub cache repair
```

4. Rebuild and run:

```powershell
flutter run
```

5. To explicitly build and reinstall the APK (physical device):

```powershell
flutter build apk --debug
adb uninstall your.package.name
adb install -r .\build\app\outputs\apk\debug\app-debug.apk
```

Replace `your.package.name` with the app package ID (see `android/app/src/main/AndroidManifest.xml`).

Quick tips:
- In an active `flutter run` session: press `r` for hot reload, `R` for full restart.
- Android emulator uses `http://10.0.2.2:3000` for host machine APIs.

## Project Structure

```
lib/
├── bloc/              # BLoC state management
│   └── example/       # Example BLoC implementation
├── models/            # Data models
├── repositories/      # Repository pattern (data layer)
├── screens/           # UI screens/pages
├── services/          # API services, network clients
├── utils/             # Utilities, constants, helpers
│   ├── constants.dart
│   └── app_config.dart
├── widgets/           # Reusable widgets
└── main.dart          # App entry point
```

## BLoC Architecture

This project uses the BLoC (Business Logic Component) pattern for state management.

### BLoC Pattern Flow

```
UI → Event → BLoC → State → UI
```

### Components

1. **Events**: User actions or system events that trigger state changes
2. **States**: Represents the current state of the application
3. **BLoC**: Business logic component that processes events and emits states

### Example BLoC Structure

```dart
// Event
class ExampleIncrementEvent extends ExampleEvent {}

// State
class ExampleLoaded extends ExampleState {
  final int counter;
}

// BLoC
class ExampleBloc extends Bloc<ExampleEvent, ExampleState> {
  // Handle events and emit states
}
```

## Dependencies

- **flutter_bloc**: State management using BLoC pattern
- **equatable**: Value equality for states and events
- **http**: HTTP client for API calls
- **shared_preferences**: Local storage for app data
- **audioplayers**: Inline audio playback for incident evidence

## API Integration

The app is configured to work with the RescueLink backend API. The `ApiService` class provides methods for:

- GET, POST, PUT, DELETE requests
- Automatic JSON encoding/decoding
- Error handling
- Custom headers support

### Example Usage

```dart
final apiService = ApiService();
final response = await apiService.post(
  AppConstants.endpointEmergency,
  body: {
    'latitude': 16.043021,
    'longitude': 120.3337627,
  },
  headers: {
    'Authorization': 'Bearer $token',
  },
);
```

## Development

### Running Tests
```bash
flutter test
```

### Building for Production

**Android:**
```bash
flutter build apk --release
```

**iOS:**
```bash
flutter build ios --release
```

## Architecture Guidelines

1. **Separation of Concerns**: Keep UI, business logic, and data layers separate
2. **BLoC Pattern**: Use BLoC for all state management
3. **Repository Pattern**: Use repositories to abstract data sources
4. **Dependency Injection**: Inject services and repositories into BLoCs
5. **Error Handling**: Always handle errors in BLoCs and display user-friendly messages

## Next Steps

- Implement authentication BLoC
- Extend inline incident evidence support to video preview/playback
- Add location services
- Implement push notifications

## Resources

- [Flutter Documentation](https://flutter.dev/docs)
- [BLoC Library Documentation](https://bloclibrary.dev/)
- [Dart Language Tour](https://dart.dev/guides/language/language-tour)
