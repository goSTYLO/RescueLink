class AppConfig {
  // API base URL from env (--dart-define=API_BASE_URL=...)
  // Emulator: flutter run (defaults to 10.0.2.2:3000)
  // Real device: flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:3000
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  // API Timeout
  static const Duration apiTimeout = Duration(seconds: 30);

  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // Location
  static const double defaultLatitude = 16.043021; // Dagupan default
  static const double defaultLongitude = 120.3337627; // Dagupan default

  // App Settings
  static const bool enableDebugLogging = true;
  static const bool enableApiLogging = true;
}
