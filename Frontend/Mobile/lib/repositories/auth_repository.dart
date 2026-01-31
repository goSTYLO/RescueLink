import '../models/auth_result.dart';
import '../models/location_result.dart';
import '../models/otp_result.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

class AuthRepository {
  final AuthService _authService;

  AuthRepository({AuthService? authService})
      : _authService = authService ?? AuthService();

  Future<void> init() async {
    await _authService.init();
  }

  String? getToken() {
    return _authService.getToken();
  }

  Future<void> logout() async {
    await _authService.logout();
  }

  Future<AuthResult> login({
    required String phone,
    required String password,
  }) async {
    try {
      final result = await _authService.login(
        phone: phone,
        password: password,
      );

      if (result['success'] == true &&
          result['user'] != null &&
          result['token'] != null) {
        final user = User.fromJson(
          result['user'] is Map<String, dynamic>
              ? result['user'] as Map<String, dynamic>
              : Map<String, dynamic>.from(result['user'] as Map),
        );
        return AuthSuccess(user, token: result['token'] as String?);
      }

      String message = 'Login failed';
      if (result['error'] != null) {
        final error = result['error'].toString();
        if (error.contains('401') || error.contains('Invalid credentials')) {
          message = 'Invalid phone number or password';
        } else if (error.contains('network') ||
            error.contains('SocketException')) {
          message = 'Network error. Please check your connection';
        } else {
          message = error;
        }
      }
      return AuthFailure(message);
    } catch (e) {
      return AuthFailure(
        e.toString().contains('SocketException')
            ? 'Network error. Please check your connection'
            : 'An error occurred during login. Please try again.',
      );
    }
  }

  Future<AuthResult> register({
    required String firstName,
    required String lastName,
    required String phone,
    required String barangay,
    required String password,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await _authService.register(
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        barangay: barangay,
        password: password,
        latitude: latitude,
        longitude: longitude,
      );

      if (result['success'] == true) {
        final data = result['data'] as Map<String, dynamic>?;
        User? user;
        if (data != null && data['user'] != null) {
          user = User.fromJson(
            data['user'] is Map<String, dynamic>
                ? data['user'] as Map<String, dynamic>
                : Map<String, dynamic>.from(data['user'] as Map),
          );
        } else {
          user = User(
            id: 0,
            phone: phone,
            firstName: firstName,
            lastName: lastName,
          );
        }
        return AuthSuccess(user, token: data?['token'] as String?);
      }

      final message = result['message']?.toString() ??
          result['error']?.toString() ??
          'Account creation failed';
      return AuthFailure(message);
    } catch (e) {
      return AuthFailure('Error creating account: ${e.toString()}');
    }
  }

  Future<LocationCheckResult> checkLocationInDagupan({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await _authService.checkLocationInDagupan(
        latitude: latitude,
        longitude: longitude,
      );

      if (result['success'] == true) {
        return LocationCheckSuccess(
          isInDagupan: result['isInDagupan'] as bool? ?? false,
          message: result['message'] as String?,
        );
      }

      return LocationCheckFailure(
        result['error']?.toString() ?? result['message']?.toString() ?? 'Location check failed',
      );
    } catch (e) {
      return LocationCheckFailure(e.toString());
    }
  }

  Future<OtpResult> requestOtp(String phoneNumber) async {
    try {
      final result = await _authService.initializePhoneVerification(phoneNumber);

      if (result['success'] == true) {
        return const OtpSuccess(message: 'OTP sent');
      }

      return OtpFailure(
        result['error']?.toString() ?? 'Failed to send OTP',
      );
    } catch (e) {
      return OtpFailure(e.toString());
    }
  }

  Future<AuthResult> verifyOtp({
    required String otp,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await _authService.verifyOtpAndLocation(
        otp: otp,
        latitude: latitude,
        longitude: longitude,
      );

      if (result['success'] == true && result['data'] != null) {
        final data = result['data'] as Map<String, dynamic>;
        User? user;
        if (data['user'] != null) {
          user = User.fromJson(
            data['user'] is Map<String, dynamic>
                ? data['user'] as Map<String, dynamic>
                : Map<String, dynamic>.from(data['user'] as Map),
          );
        }
        if (user != null) {
          return AuthSuccess(user, token: data['token'] as String?);
        }
        return AuthSuccess(
          const User(id: 0, phone: ''),
          token: data['token'] as String?,
        );
      }

      return AuthFailure(
        result['error']?.toString() ?? 'Verification failed',
      );
    } catch (e) {
      return AuthFailure(e.toString());
    }
  }

  Future<OtpResult> resendOtp(String phoneNumber) async {
    try {
      final result = await _authService.resendOtp(phoneNumber);

      if (result['success'] == true) {
        return const OtpSuccess(message: 'OTP resent');
      }

      return OtpFailure(
        result['error']?.toString() ?? 'Failed to resend OTP',
      );
    } catch (e) {
      return OtpFailure(e.toString());
    }
  }
}
