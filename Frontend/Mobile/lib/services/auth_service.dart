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

  // Initiate Firebase phone verification
  Future<Map<String, dynamic>> initializePhoneVerification(
    String phoneNumber,
  ) async {
    try {
      final Completer<Map<String, dynamic>> completer = Completer();

      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
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

  // Verify OTP with Firebase and onboard phone
  Future<Map<String, dynamic>> verifyOtpAndLocation({
    required String otp,
    required double latitude,
    required double longitude,
  }) async {
    try {
      if (_verificationId == null) {
        return {
          'success': false,
          'error': 'Verification ID not found. Please request OTP again.',
        };
      }

      // Sign in with OTP to get Firebase ID token
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: otp,
      );

      final userCredential =
          await _firebaseAuth.signInWithCredential(credential);
      final idToken = await userCredential.user?.getIdToken();

      if (idToken == null) {
        return {
          'success': false,
          'error': 'Failed to get Firebase ID token.',
        };
      }

      // Get current token to send to backend
      String? currentToken = getToken();
      if (currentToken == null) {
        return {
          'success': false,
          'error': 'User registration token not found.',
        };
      }

      // Call backend onboard-phone endpoint (just verify Firebase token)
      final onboardResponse = await _apiService.post(
        '/api/auth/onboard-phone',
        body: {'idToken': idToken},
        headers: {'Authorization': 'Bearer $currentToken'},
      );

      if (onboardResponse['token'] == null) {
        return {
          'success': false,
          'error': 'Failed to complete phone verification.',
        };
      }

      // Store the new JWT token after successful verification
      await _storeToken(onboardResponse['token']);

      return {
        'success': true,
        'data': onboardResponse,
      };
    } on FirebaseAuthException catch (e) {
      return {
        'success': false,
        'error': e.message ?? 'Firebase authentication error',
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
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
}
