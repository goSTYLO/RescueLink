class AppConfig {
  // API Configuration
  // Change this to your backend URL
  // For development: http://10.0.2.2:3000 (Android emulator)
  // For development (iOS simulator): http://localhost:3000
  // For production: https://your-api-domain.com
  static const String apiBaseUrl = 'http://10.0.2.2:3000';

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
