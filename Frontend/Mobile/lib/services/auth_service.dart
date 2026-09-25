import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_config.dart';
import '../utils/constants.dart';
import '../utils/otp_error_messages.dart';
import 'api_service.dart';

/// Parses API `user_id` (int or numeric string). Used for prefs + OneSignal External ID.
int? parsePositiveUserId(dynamic value) {
  if (value is int) return value > 0 ? value : null;
  if (value is num) {
    final n = value.toInt();
    return n > 0 ? n : null;
  }
  final parsed = int.tryParse(value?.toString() ?? '');
  return (parsed != null && parsed > 0) ? parsed : null;
}

class AuthService {
  static final AuthService _instance = AuthService._internal();

  factory AuthService() {
    return _instance;
  }

  AuthService._internal();

  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final ApiService _apiService = ApiService();
  late SharedPreferences _prefs;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  static const _keyBiometricEnabled = 'biometric_login_enabled';
  static const _keyBiometricToken = 'biometric_token';
  static const _keyBiometricPhone = 'biometric_phone';
  static const _keyBiometricPassword = 'biometric_password';
  static const _keyUserRole = 'user_role';
  static const _keyDepartmentCode = 'user_department_code';
  static const _keyDepartmentName = 'user_department_name';

  // Initialize shared preferences
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Get stored JWT token
  String? getToken() {
    return _prefs.getString('jwt_token');
  }

  /// Returns the cached role of the logged-in user (e.g. 'user', 'responder', 'dispatcher').
  /// Returns null if not logged in or role not yet cached.
  String? getUserRole() {
    return _prefs.getString(_keyUserRole);
  }

  bool get isPersonnelResponder => getUserRole() == 'responder';

  bool get isVolunteer => getUserRole() == 'volunteer';

  bool get isDepartmentOps {
    final role = getUserRole();
    return role == 'department-admin' || role == 'department-head';
  }

  bool get hasResponderTab => isPersonnelResponder || isVolunteer;

  bool get hasOpsTab => hasResponderTab || isDepartmentOps;

  String? getDepartmentCode() => _prefs.getString(_keyDepartmentCode);

  String? getDepartmentName() => _prefs.getString(_keyDepartmentName);

  Future<void> _cacheUserProfileFields(Map<String, dynamic>? user) async {
    if (user == null) return;
    final userId = parsePositiveUserId(user['user_id']);
    if (userId != null) {
      await _prefs.setInt('user_id', userId);
    }
    final role = user['role']?.toString();
    if (role != null && role.isNotEmpty) {
      await _prefs.setString(_keyUserRole, role);
    }
    final deptCode = user['department_code']?.toString();
    if (deptCode != null && deptCode.isNotEmpty) {
      await _prefs.setString(_keyDepartmentCode, deptCode);
    } else {
      await _prefs.remove(_keyDepartmentCode);
    }
    final deptName = user['department']?.toString();
    if (deptName != null && deptName.isNotEmpty) {
      await _prefs.setString(_keyDepartmentName, deptName);
    } else {
      await _prefs.remove(_keyDepartmentName);
    }
  }

  /// Returns the logged-in user's id from cache or JWT payload.
  int? getUserId() {
    final cached = _prefs.getInt('user_id');
    if (cached != null && cached > 0) {
      return cached;
    }

    final token = getToken();
    if (token == null || token.isEmpty) {
      return null;
    }

    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = jsonDecode(_decodeBase64Url(parts[1])) as Map<String, dynamic>;
      final id = payload['user_id'];
      if (id is int) return id;
      return int.tryParse(id?.toString() ?? '');
    } catch (_) {
      return null;
    }
  }

  // Store JWT token
  Future<void> _storeToken(String token) async {
    await _prefs.setString('jwt_token', token);
  }

  // Clear session token on logout. Keep biometric token if biometric login
  // is still enabled so the fingerprint option remains available on login.
  Future<void> logout() async {
    final token = getToken();
    if (token != null) {
      try {
        await _apiService.post(
          '/api/auth/logout',
          headers: {'Authorization': 'Bearer $token'},
        );
      } catch (_) {
        // Best-effort; proceed with local logout regardless
      }
    }
    await _prefs.remove('jwt_token');
    await _prefs.remove(_keyUserRole);
    await _prefs.remove(_keyDepartmentCode);
    await _prefs.remove(_keyDepartmentName);
    await _prefs.remove('user_id');
    final biometricEnabled = await isBiometricLoginEnabled();
    if (!biometricEnabled) {
      await clearBiometricData();
    }
    await _firebaseAuth.signOut();
  }

  // --- Biometric login (after initial credential verification) ---

  Future<bool> isBiometricLoginEnabled() async {
    return _prefs.getBool(_keyBiometricEnabled) ?? false;
  }

  Future<void> setBiometricLoginEnabled(bool enabled) async {
    await _prefs.setBool(_keyBiometricEnabled, enabled);
    if (!enabled) await clearBiometricData();
  }

  /// Saves token to secure storage for biometric login. Call after successful
  /// phone+password login when biometric is enabled.
  Future<void> saveTokenForBiometric(String token) async {
    final enabled = await isBiometricLoginEnabled();
    if (!enabled) return;
    await _secureStorage.write(key: _keyBiometricToken, value: token);
  }

  /// Saves credentials to secure storage for credential-based biometric login.
  /// Used when token may be blacklisted (e.g. after app exit) — biometric login
  /// will use these to obtain a fresh token.
  Future<void> saveCredentialsForBiometric({
    required String phone,
    required String password,
  }) async {
    final enabled = await isBiometricLoginEnabled();
    if (!enabled) return;
    final formattedPhone = _formatPhoneNumberE164(phone);
    await _secureStorage.write(key: _keyBiometricPhone, value: formattedPhone);
    await _secureStorage.write(key: _keyBiometricPassword, value: password);
  }

  /// Reads stored credentials for biometric login. Call only after user has
  /// passed local_auth biometric prompt.
  Future<({String phone, String password})?> getCredentialsForBiometric() async {
    final phone = await _secureStorage.read(key: _keyBiometricPhone);
    final password = await _secureStorage.read(key: _keyBiometricPassword);
    if (phone == null || password == null || phone.isEmpty || password.isEmpty) {
      return null;
    }
    return (phone: phone, password: password);
  }

  /// Reads token from secure storage. Call only after user has passed
  /// local_auth biometric prompt in the UI.
  Future<String?> getTokenForBiometric() async {
    return _secureStorage.read(key: _keyBiometricToken);
  }

  Future<void> clearBiometricToken() async {
    await _secureStorage.delete(key: _keyBiometricToken);
  }

  /// Clears all biometric data (token and credentials).
  Future<void> clearBiometricData() async {
    await _secureStorage.delete(key: _keyBiometricToken);
    await _secureStorage.delete(key: _keyBiometricPhone);
    await _secureStorage.delete(key: _keyBiometricPassword);
  }

  /// Stores token in session (SharedPreferences). Used after biometric
  /// login to restore session before fetching profile.
  Future<void> setToken(String token) async {
    await _storeToken(token);
  }

  // Clear token only (no Firebase sign-out)
  Future<void> clearToken() async {
    await _prefs.remove('jwt_token');
  }

  bool hasValidToken() {
    final token = getToken();
    if (token == null || token.isEmpty) return false;
    return _isTokenValid(token);
  }

  bool _isTokenValid(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return false;
      final payload = _decodeBase64Url(parts[1]);
      final payloadMap = jsonDecode(payload) as Map<String, dynamic>;
      final exp = payloadMap['exp'];
      if (exp == null) return false;
      final expSeconds = exp is int ? exp : int.tryParse(exp.toString());
      if (expSeconds == null) return false;
      final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      return expSeconds > nowSeconds;
    } catch (_) {
      return false;
    }
  }

  String _decodeBase64Url(String input) {
    var normalized = input.replaceAll('-', '+').replaceAll('_', '/');
    switch (normalized.length % 4) {
      case 0:
        break;
      case 2:
        normalized += '==';
        break;
      case 3:
        normalized += '=';
        break;
      default:
        return '';
    }
    return utf8.decode(base64Url.decode(normalized));
  }

  /// Cache role locally after a realtime role change (e.g. approve/revoke via WebSocket).
  Future<void> cacheUserRole(String role) async {
    if (role.isNotEmpty) {
      await _prefs.setString(_keyUserRole, role);
    }
  }

  // Get current user's profile from backend
  Future<Map<String, dynamic>> getProfile() async {
    try {
      final token = getToken();
      if (token == null || token.isEmpty) {
        return {
          'success': false,
          'error': 'Missing auth token',
        };
      }

      final response = await _apiService.get(
        '/api/auth/me',
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      final user = (response['user'] ?? response) as Map<String, dynamic>;
      // Cache role + department + user_id for synchronous access across the UI
      await _cacheUserProfileFields(user);
      return {
        'success': true,
        'user': user,
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  /// Search Dagupan locations (address autocomplete)
  Future<Map<String, dynamic>> searchLocations(String query, {int limit = 5}) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      final response = await _apiService.get(
        '/api/location/search',
        queryParameters: {'q': query, 'limit': limit.toString()},
        headers: {'Authorization': 'Bearer $token'},
      );
      return response;
    } catch (e) {
      return {'success': false, 'error': e.toString(), 'results': []};
    }
  }

  /// Reverse geocode coordinates to address
  Future<Map<String, dynamic>> reverseGeocode(double latitude, double longitude) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      final response = await _apiService.get(
        '/api/location/reverse',
        queryParameters: {'latitude': latitude.toString(), 'longitude': longitude.toString()},
        headers: {'Authorization': 'Bearer $token'},
      );
      return response;
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Update user profile (partial: address and/or name)
  Future<Map<String, dynamic>> updateProfile({
    String? address,
    String? firstName,
    String? lastName,
  }) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    final body = <String, dynamic>{};
    if (address != null) body['address'] = address;
    if (firstName != null) body['firstName'] = firstName;
    if (lastName != null) body['lastName'] = lastName;
    if (body.isEmpty) {
      return {'success': false, 'error': 'No fields to update'};
    }
    try {
      final response = await _apiService.patch(
        '/api/auth/me',
        body: body,
        headers: {'Authorization': 'Bearer $token'},
      );
      return {'success': true, 'user': response['user'] ?? response};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Uint8List?> fetchAvatarBytes() async {
    final token = getToken();
    if (token == null || token.isEmpty) return null;
    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/auth/me/avatar');
      final response = await http.get(
        uri,
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(AppConfig.apiTimeout);
      if (response.statusCode == 200) {
        return response.bodyBytes;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> uploadAvatar(File file) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/auth/me/avatar');
      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(
        await http.MultipartFile.fromPath('avatar', file.path),
      );
      final streamed = await request.send().timeout(AppConfig.apiTimeout);
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final decoded = jsonDecode(body) as Map<String, dynamic>;
        return {'success': true, 'user': decoded['user'] ?? decoded};
      }
      String message = 'Failed to upload photo';
      try {
        final err = jsonDecode(body) as Map<String, dynamic>;
        message = err['message']?.toString() ?? message;
      } catch (_) {}
      return {'success': false, 'error': message};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteAvatar() async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      final response = await _apiService.delete(
        '/api/auth/me/avatar',
        headers: {'Authorization': 'Bearer $token'},
      );
      return {'success': true, 'user': response['user'] ?? response};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Change password for authenticated user (no OTP required).
  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      await _apiService.post(
        '/api/auth/change-password',
        body: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
        headers: {'Authorization': 'Bearer $token'},
      );
      // Update stored biometric credentials with new password
      final profile = await getProfile();
      if (profile['success'] == true) {
        final user = profile['user'] as Map<String, dynamic>?;
        final phone = (user?['phone'] ?? user?['phone_number'])?.toString();
        if (phone != null && phone.isNotEmpty) {
          await saveCredentialsForBiometric(phone: phone, password: newPassword);
          await saveTokenForBiometric(token);
        }
      }
      return {'success': true};
    } catch (e) {
      if (e is ApiException) {
        return {'success': false, 'error': e.message};
      }
      return {'success': false, 'error': 'Failed to change password. Please try again.'};
    }
  }

  /// Get barangay name for coordinates (for incident report UI).
  /// Returns null if not in Dagupan or on API error.
  Future<String?> getBarangayFromCoordinates(double latitude, double longitude) async {
    final token = getToken();
    if (token == null || token.isEmpty) return null;
    try {
      final response = await _apiService.get(
        '/api/location/barangay',
        queryParameters: {'lat': latitude.toString(), 'lng': longitude.toString()},
        headers: {'Authorization': 'Bearer $token'},
      );
      return response['barangay'] as String?;
    } catch (_) {
      return null;
    }
  }

  // Check if location is within Dagupan City
  Future<Map<String, dynamic>> checkLocationInDagupan({
      required double latitude,
      required double longitude,
    }) async {
      try {
        final response = await _apiService.post(
          '/api/location/check',
          body: {
            'latitude': latitude,
            'longitude': longitude,
          },
        );

        return {
          'success': response['success'] ?? false,
          'isInDagupan': response['isInDagupan'] ?? false,
          'message': response['message'] ?? 'Location check failed',
        };
      } catch (e) {
        return {
          'success': false,
          'isInDagupan': false,
          'error': e.toString(),
        };
      }
    }

  /// Submit registration + CAPTCHA. Backend validates CAPTCHA, sends IPROG OTP,
  /// and holds pending registration — account is created only after verify-otp.
  Future<Map<String, dynamic>> register({
    required String firstName,
    required String lastName,
    required String phone,
    required String barangay,
    required String password,
    required double latitude,
    required double longitude,
    required String captchaToken,
    bool storeToken = false,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointRegister,
        body: {
          'firstName': firstName,
          'lastName': lastName,
          'phone': phone,
          'address': barangay,
          'password': password,
          'latitude': latitude,
          'longitude': longitude,
          'captchaToken': captchaToken,
        },
      );

      // Signup must never persist a session before OTP completes.
      final verificationRequired = response['verificationRequired'] != false;
      if (!verificationRequired && storeToken && response['token'] != null) {
        await _storeToken(response['token']);
      }

      return {
        'success': true,
        'verificationRequired': verificationRequired,
        'message': response['message'] as String?,
        'data': response,
      };
    } catch (e) {
      String errorMessage = 'Registration could not be completed. Please try again.';
      final msg = e.toString().toLowerCase();
      if (msg.contains('already have an account') ||
          msg.contains('account already exists') ||
          msg.contains('already registered') ||
          msg.contains('phone.*taken') ||
          msg.contains('duplicate')) {
        errorMessage = 'An account with this phone number already exists. Please sign in instead.';
      } else if (e is ApiException) {
        final apiMsg = e.message.toLowerCase();
        if (apiMsg.contains('already have an account') ||
            apiMsg.contains('account already exists') ||
            apiMsg.contains('already registered')) {
          errorMessage = 'An account with this phone number already exists. Please sign in instead.';
        } else if (apiMsg.contains('captcha')) {
          errorMessage = 'CAPTCHA verification failed. Please try again.';
        } else {
          errorMessage = e.message;
        }
      } else if (msg.contains('socketexception') ||
          msg.contains('connection') ||
          msg.contains('failed host lookup')) {
        errorMessage = 'Unable to connect. Please check your network and try again.';
      }
      return {
        'success': false,
        'error': errorMessage,
      };
    }
  }

  // Login user with phone and password
  Future<Map<String, dynamic>> login({
    required String phone,
    required String password,
  }) async {
    try {
      // Format phone to E.164 to match database format
      final formattedPhone = _formatPhoneNumberE164(phone);
      debugPrint('🔐 Logging in with phone: $formattedPhone');

      final response = await _apiService.post(
        '/api/auth/login',
        body: {
          'phone': formattedPhone,
          'password': password,
        },
      );

      // Store token on successful login
      if (response['token'] != null) {
        await _storeToken(response['token']);
        await saveTokenForBiometric(response['token'] as String);
        await saveCredentialsForBiometric(phone: formattedPhone, password: password);
        final user = response['user'];
        if (user is Map<String, dynamic>) {
          await _cacheUserProfileFields(user);
        }
        debugPrint('✅ Login successful, token stored');
      }

      return {
        'success': true,
        'user': response['user'],
        'token': response['token'],
      };
    } catch (e) {
      debugPrint('❌ Login error: $e');
      String errorMessage = 'Incorrect password or number.';
      if (e is ApiException) {
        final code = e.statusCode;
        final msg = e.message.toLowerCase();
        if (code == 401 || msg.contains('invalid credentials') || msg.contains('invalid phone') || msg.contains('invalid password')) {
          errorMessage = 'Incorrect password or number.';
        } else {
          errorMessage = e.message;
        }
      } else if (e.toString().contains('SocketException') ||
          e.toString().contains('Connection') ||
          e.toString().contains('Failed host lookup')) {
        errorMessage = 'Unable to connect. Please check your network and try again.';
      }
      return {
        'success': false,
        'error': errorMessage,
      };
    }
  }

  // Format phone number to E.164 format for Firebase
  String _formatPhoneNumberE164(String phoneNumber) {
    // Remove all non-digit characters
    String digitsOnly = phoneNumber.replaceAll(RegExp(r'[^\d]'), '');
    
    // If starts with 0 (local format), replace with +63
    if (digitsOnly.startsWith('0')) {
      digitsOnly = '63${digitsOnly.substring(1)}';
    }
    
    // If doesn't start with country code, add +63
    if (!digitsOnly.startsWith('63')) {
      digitsOnly = '63$digitsOnly';
    }
    
    // Add + prefix for E.164 format
    final e164Format = '+$digitsOnly';
    debugPrint('📱 Phone formatting: $phoneNumber → $e164Format');
    return e164Format;
  }

  /// Verify registration OTP via RescueLink backend (IPROG on server).
  /// Signup flow uses [storeToken]: false and navigates to Login.
  Future<Map<String, dynamic>> verifyOtp({
    required String phone,
    required String otp,
    bool storeToken = false,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointVerifyOtp,
        body: {
          'phone': phone,
          'otp': otp,
        },
      );

      if (storeToken && response['token'] != null) {
        await _storeToken(response['token']);
      }

      return {
        'success': true,
        'data': response,
      };
    } catch (e) {
      final message = e is ApiException ? e.message : null;
      return {
        'success': false,
        'error': mapOtpVerifyError(e, message: message),
      };
    }
  }

  /// Request forgot-password SMS OTP via backend (IPROG). Generic success either way.
  Future<Map<String, dynamic>> requestPasswordResetOtp({
    required String phone,
    required String captchaToken,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointForgotPasswordSms,
        body: {
          'phone': phone,
          'captchaToken': captchaToken,
        },
      );
      return {
        'success': true,
        'message': response['message'] as String? ??
            'If an account exists with this phone number, you will receive a verification code.',
      };
    } catch (e) {
      final message = e is ApiException ? e.message : null;
      return {
        'success': false,
        'error': mapOtpResendError(e, message: message),
      };
    }
  }

  /// Resend forgot-password SMS OTP. Requires a fresh CAPTCHA token.
  Future<Map<String, dynamic>> resendPasswordResetOtp({
    required String phone,
    required String captchaToken,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointForgotPasswordSmsResend,
        body: {
          'phone': phone,
          'captchaToken': captchaToken,
        },
      );
      return {
        'success': true,
        'message': response['message'] as String? ??
            'If an account exists with this phone number, you will receive a verification code.',
      };
    } catch (e) {
      final message = e is ApiException ? e.message : null;
      return {
        'success': false,
        'error': mapOtpResendError(e, message: message),
      };
    }
  }

  /// Verify forgot-password OTP; returns short-lived [resetToken] (no Firebase).
  Future<Map<String, dynamic>> verifyPasswordResetOtp({
    required String phone,
    required String otp,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointForgotPasswordSmsVerify,
        body: {
          'phone': phone,
          'otp': otp,
        },
      );
      final resetToken = response['resetToken'] as String?;
      if (resetToken == null || resetToken.isEmpty) {
        return {
          'success': false,
          'error': 'Verification failed. Please try again.',
        };
      }
      return {
        'success': true,
        'resetToken': resetToken,
      };
    } catch (e) {
      final message = e is ApiException ? e.message : null;
      return {
        'success': false,
        'error': mapOtpVerifyError(e, message: message),
      };
    }
  }

  /// Reset password (forgot-password flow). Does not store any token.
  Future<Map<String, dynamic>> resetPassword(
    String resetToken,
    String newPassword,
  ) async {
    try {
      await _apiService.post(
        AppConstants.endpointResetPassword,
        body: {'resetToken': resetToken, 'newPassword': newPassword},
      );
      return {'success': true};
    } catch (e) {
      if (e is ApiException) {
        return {'success': false, 'error': e.message};
      }
      return {
        'success': false,
        'error': 'Could not reset password. Please try again.',
      };
    }
  }

  // Get current device location with retry logic
  Future<Map<String, dynamic>> getCurrentLocation({
    int maxRetries = 2,
    int timeoutSeconds = 30,
  }) async {
    try {
      // Check and request location permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return {
            'success': false,
            'error': 'Location permissions are denied.',
          };
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return {
          'success': false,
          'error':
              'Location permissions are denied permanently. Please enable in settings.',
        };
      }

      // Get location with timeout and retry logic
      int attempt = 0;
      while (attempt <= maxRetries) {
        try {
          final position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.best,
            timeLimit: Duration(seconds: timeoutSeconds),
          );

          return {
            'success': true,
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracy': position.accuracy,
          };
        } catch (e) {
          if (e.toString().contains('timeout') ||
              e.toString().contains('Timeout')) {
            attempt++;
            if (attempt <= maxRetries) {
              debugPrint('Location timeout, retrying... (attempt $attempt)');
              continue;
            } else {
              return {
                'success': false,
                'error':
                    'Failed to get location after $maxRetries retries. Please ensure GPS is enabled.',
                'timeout': true,
              };
            }
          } else {
            rethrow;
          }
        }
      }

      return {
        'success': false,
        'error': 'Failed to get location.',
      };
    } catch (e) {
      return {
        'success': false,
        'error': 'Error getting location: ${e.toString()}',
      };
    }
  }

  /// Resend registration OTP via backend. Requires a fresh CAPTCHA token.
  Future<Map<String, dynamic>> resendOtp({
    required String phone,
    required String captchaToken,
  }) async {
    try {
      final response = await _apiService.post(
        AppConstants.endpointResendOtp,
        body: {
          'phone': phone,
          'captchaToken': captchaToken,
        },
      );
      return {
        'success': true,
        'message': response['message'] as String? ??
            'A new verification code has been sent.',
      };
    } catch (e) {
      final message = e is ApiException ? e.message : null;
      return {
        'success': false,
        'error': mapOtpResendError(e, message: message),
      };
    }
  }
}
