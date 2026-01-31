import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
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

  // Store JWT token
  Future<void> _storeToken(String token) async {
    await _prefs.setString('jwt_token', token);
  }

  // Clear token on logout
  Future<void> logout() async {
    await _prefs.remove('jwt_token');
    await _firebaseAuth.signOut();
  }

  // Register user with backend (now includes location validation)
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

      // Store token but don't set as authenticated yet (phone verification required)
      if (response['token'] != null) {
        await _storeToken(response['token']);
      }

      return {'success': true, 'data': response};
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
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
        print('✅ Login successful, token stored');
      }

      return {
        'success': true,
        'user': response['user'],
        'token': response['token'],
      };
    } catch (e) {
      print('❌ Login error: $e');
      return {
        'success': false,
        'error': e.toString(),
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

      // Store the new JWT token after successful verification
      await _storeToken(onboardResponse['token']);
      print('✅ JWT token stored successfully');
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
