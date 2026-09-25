import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  // API base URL: from .env (API_BASE_URL) or --dart-define=API_BASE_URL=...
  // Emulator: defaults to 10.0.2.2:3000. Real device: use your PC's LAN IP in .env
  static String get apiBaseUrl =>
      dotenv.env['API_BASE_URL']?.trim() ??
      const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000',
      );

  // Google reCAPTCHA v2 site key: from .env (RECAPTCHA_SITE_KEY) or --dart-define.
  // Get keys at https://www.google.com/recaptcha/admin (reCAPTCHA v2 "I'm not a robot").
  // If not set, verification screen falls back to a simple checkbox (no real reCAPTCHA).
  static String get recaptchaSiteKey =>
      dotenv.env['RECAPTCHA_SITE_KEY']?.trim() ??
      const String.fromEnvironment('RECAPTCHA_SITE_KEY', defaultValue: '');

  /// When true, Dagupan residency screen skips GPS/API and uses fixed in-city coords.
  /// Dev/test only — keep false for real devices / production builds.
  static bool get bypassLocationCheck {
    final fromEnv = dotenv.env['BYPASS_LOCATION_CHECK']?.trim().toLowerCase();
    if (fromEnv != null && fromEnv.isNotEmpty) {
      return fromEnv == 'true' || fromEnv == '1' || fromEnv == 'yes';
    }
    return const bool.fromEnvironment('BYPASS_LOCATION_CHECK', defaultValue: false);
  }

  // API Timeout
  static const Duration apiTimeout = Duration(seconds: 30);

  /// Incident with-audio: Render + Cloud Run cold start and local STT can exceed 30s.
  static const Duration audioUploadTimeout = Duration(seconds: 180);

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
