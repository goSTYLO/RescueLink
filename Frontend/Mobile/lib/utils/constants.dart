class AppConstants {
  // App Information
  static const String appName = 'RescueLink';
  static const String appVersion = '1.0.0';

  // API Endpoints
  static const String apiAuth = '/api/auth';
  static const String apiIncidents = '/api/incidents';
  static const String apiLocation = '/api/location';
  static const String apiResponders = '/api/responders';
  static const String apiDispatches = '/api/dispatches';
  static const String apiNotifications = '/api/notifications';

  // Auth Endpoints
  static const String endpointRegister = '$apiAuth/register';
  static const String endpointLogin = '$apiAuth/login';
  static const String endpointOnboardPhone = '$apiAuth/onboard-phone';

  // Incident Endpoints
  static const String endpointEmergency = '$apiIncidents/emergency';
  static const String endpointMyIncidents = '$apiIncidents/user/my';

  // Location Endpoints
  static const String endpointCheckLocation = '$apiLocation/check';

  // Storage Keys
  static const String storageTokenKey = 'auth_token';
  static const String storageUserIdKey = 'user_id';
  static const String storageUserDataKey = 'user_data';

  // Error Messages
  static const String errorNetwork = 'Network error. Please check your connection.';
  static const String errorUnauthorized = 'Unauthorized. Please login again.';
  static const String errorServer = 'Server error. Please try again later.';
  static const String errorUnknown = 'An unknown error occurred.';

  // Success Messages
  static const String successEmergencyReported = 'Emergency incident reported successfully';
  static const String successLogin = 'Login successful';
  static const String successRegister = 'Registration successful';
}
