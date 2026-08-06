import 'dart:async';
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

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
  String? _verificationId;
  int? _forceResendingToken;

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
      // Cache role for synchronous access across the UI
      final role = user['role']?.toString();
      if (role != null && role.isNotEmpty) {
        await _prefs.setString(_keyUserRole, role);
      }
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

  /// Update user profile (address/barangay)
  Future<Map<String, dynamic>> updateProfile({String? address}) async {
    final token = getToken();
    if (token == null || token.isEmpty) {
      return {'success': false, 'error': 'Not authenticated'};
    }
    try {
      final response = await _apiService.patch(
        '/api/auth/me',
        body: {'address': address},
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

  // Register user with backend (now includes location validation)
  Future<Map<String, dynamic>> register({
    required String firstName,
    required String lastName,
    required String phone,
    required String barangay,
    required String password,
    required double latitude,
    required double longitude,
    bool storeToken = true,
  }) async {
    try {
      final response = await _apiService.post(
        '/api/auth/register',
        body: {
          'firstName': firstName,
          'lastName': lastName,
          'phone': phone,
          'address': barangay,
          'password': password,
          'latitude': latitude,
          'longitude': longitude,
        },
      );

      // Only store token if requested (signup flow uses storeToken: false)
      if (storeToken && response['token'] != null) {
        await _storeToken(response['token']);
      }

      return {'success': true, 'data': response};
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
      print('🔐 Logging in with phone: $formattedPhone');

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
        print('✅ Login successful, token stored');
      }

      return {
        'success': true,
        'user': response['user'],
        'token': response['token'],
      };
    } catch (e) {
      print('❌ Login error: $e');
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
    print('📱 Phone formatting: $phoneNumber → $e164Format');
    return e164Format;
  }

  // Initiate Firebase phone verification
  Future<Map<String, dynamic>> initializePhoneVerification(
    String phoneNumber,
  ) async {
    try {
      // Format phone number to E.164
      final formattedPhone = _formatPhoneNumberE164(phoneNumber);
      print('🔐 Initializing phone verification for: $formattedPhone');
      
      final Completer<Map<String, dynamic>> completer = Completer();

      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: formattedPhone,
        timeout: const Duration(seconds: 60),
        verificationCompleted: (PhoneAuthCredential credential) {
          // Auto-verification on Android
          print('Phone verification auto-completed');
        },
        verificationFailed: (FirebaseAuthException e) {
          print('Phone verification failed: ${e.message}');
          if (!completer.isCompleted) {
            completer.complete({
              'success': false,
              'error': e.message ?? 'Phone verification failed',
            });
          }
        },
        codeSent: (String verificationId, int? forceResendingToken) {
          _verificationId = verificationId;
          _forceResendingToken = forceResendingToken;
          print('✅ OTP code sent! Verification ID: ${verificationId.substring(0, 20)}...');
          if (!completer.isCompleted) {
            completer.complete({'success': true});
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId = verificationId;
        },
      );

      return await completer.future;
    } catch (e) {
      print('❌ Phone verification initialization error: $e');
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  // Verify OTP with Firebase and onboard phone
  Future<Map<String, dynamic>> verifyOtpAndLocation({
    required String otp,
    required double latitude,
    required double longitude,
    bool storeToken = true,
  }) async {
    try {
      if (_verificationId == null) {
        print('❌ Verification ID is null');
        return {
          'success': false,
          'error': 'Verification ID not found. Please request OTP again.',
        };
      }

      print('🔐 Attempting to verify OTP: $otp with verificationId: $_verificationId');

      // Sign in with OTP to get Firebase ID token
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );

      print('📱 Firebase credential created, signing in with credential...');
      final userCredential =
          await _firebaseAuth.signInWithCredential(credential);
      final user = userCredential.user;
      
      if (user == null) {
        print('❌ Firebase sign in returned null user');
        return {
          'success': false,
          'error': 'Firebase sign in failed.',
        };
      }
      
      print('✅ Firebase sign in successful. User UID: ${user.uid}');
      print('🔑 Getting Firebase ID token...');
      
      final idToken = await user.getIdToken();

      if (idToken == null || idToken.isEmpty) {
        print('❌ Failed to get Firebase ID token - token is null or empty');
        return {
          'success': false,
          'error': 'Failed to get Firebase ID token.',
        };
      }

      print('✅ Firebase ID token obtained: ${idToken.substring(0, 50)}...');

      // Get current token to send to backend
      String? currentToken = getToken();
      if (currentToken == null) {
        print('⚠️ Registration token not found in SharedPreferences - trying without auth header');
        // Continue without auth header for now
      } else {
        print('✅ Registration token found');
      }

      print('🌐 Making API call to /api/auth/onboard-phone');
      print('📤 Request body: { idToken: "${idToken.substring(0, 50)}..." }');
      print('📤 Authorization header: ${currentToken != null ? "Bearer $currentToken" : "NONE"}');

      // Call backend onboard-phone endpoint with only idToken (password is optional)
      Map<String, String> headers = {};
      if (currentToken != null) {
        headers['Authorization'] = 'Bearer $currentToken';
      }
      
      final onboardResponse = await _apiService.post(
        '/api/auth/onboard-phone',
        body: {'idToken': idToken},
        headers: headers,
      );

      print('✅ Backend responded successfully');
      print('📊 Backend response: $onboardResponse');

      if (onboardResponse['token'] == null) {
        print('❌ Backend did not return token. Response: $onboardResponse');
        final message = onboardResponse['message'] ?? onboardResponse['error'] ?? 'Failed to complete phone verification.';
        return {
          'success': false,
          'error': message,
        };
      }

      // Only store token if requested (signup flow uses storeToken: false, then navigate to Login)
      if (storeToken) {
        await _storeToken(onboardResponse['token']);
        print('✅ JWT token stored successfully');
      }
      print('✅ Phone verification complete!');

      return {
        'success': true,
        'data': onboardResponse,
      };
    } on FirebaseAuthException catch (e) {
      print('❌ Firebase Auth Exception: ${e.code}');
      print('❌ Firebase error message: ${e.message}');
      return {
        'success': false,
        'error': e.message ?? 'Firebase authentication error (${e.code})',
      };
    } catch (e) {
      print('❌ Unexpected error during OTP verification: $e');
      print('❌ Error type: ${e.runtimeType}');
      return {
        'success': false,
        'error': 'Verification error: ${e.toString()}',
      };
    }
  }

  /// Verify OTP and return Firebase idToken only (for forgot-password flow). Does not call backend.
  Future<Map<String, dynamic>> verifyOtpAndGetIdToken(String otp) async {
    try {
      if (_verificationId == null) {
        return {
          'success': false,
          'error': 'Verification ID not found. Please request a new code.',
        };
      }
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );
      final userCredential = await _firebaseAuth.signInWithCredential(credential);
      final user = userCredential.user;
      if (user == null) {
        return { 'success': false, 'error': 'Verification failed.' };
      }
      final idToken = await user.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        return { 'success': false, 'error': 'Failed to get verification token.' };
      }
      return { 'success': true, 'idToken': idToken };
    } on FirebaseAuthException catch (e) {
      return {
        'success': false,
        'error': e.message ?? 'Invalid or expired code. Please try again.',
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString().contains('invalid') ? 'Invalid code. Please try again.' : 'Verification failed. Please try again.',
      };
    }
  }

  /// Reset password (forgot-password flow). Does not store any token.
  Future<Map<String, dynamic>> resetPassword(String idToken, String newPassword) async {
    try {
      await _apiService.post(
        '/api/auth/reset-password',
        body: { 'idToken': idToken, 'newPassword': newPassword },
      );
      return { 'success': true };
    } catch (e) {
      if (e is ApiException) {
        return { 'success': false, 'error': e.message };
      }
      return { 'success': false, 'error': 'Could not reset password. Please try again.' };
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
              print('Location timeout, retrying... (attempt $attempt)');
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

  // Resend OTP
  Future<Map<String, dynamic>> resendOtp(String phoneNumber) async {
    try {
      final Completer<Map<String, dynamic>> completer = Completer();

      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        timeout: const Duration(seconds: 60),
        forceResendingToken: _forceResendingToken,
        verificationCompleted: (PhoneAuthCredential credential) {
          print('Phone verification auto-completed');
        },
        verificationFailed: (FirebaseAuthException e) {
          print('Phone verification failed: ${e.message}');
          if (!completer.isCompleted) {
            completer.complete({
              'success': false,
              'error': e.message ?? 'Phone verification failed',
            });
          }
        },
        codeSent: (String verificationId, int? forceResendingToken) {
          _verificationId = verificationId;
          _forceResendingToken = forceResendingToken;
          if (!completer.isCompleted) {
            completer.complete({'success': true});
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId = verificationId;
        },
      );

      return await completer.future;
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  // Verify phone code via backend
  Future<Map<String, dynamic>> verifyPhoneCode({
    required String phone,
    required String code,
  }) async {
    try {
      final response = await _apiService.post(
        '/api/auth/verify-phone',
        body: {
          'phone': phone,
          'code': code,
        },
      );

      if (response['success'] == true) {
        // Store the token if provided
        if (response['token'] != null) {
          await _storeToken(response['token']);
        }
        return {
          'success': true,
          'data': response,
        };
      } else {
        return {
          'success': false,
          'message': response['message'] ?? 'Verification failed',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }
}
