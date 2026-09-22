import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/auth_service.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._authService) : super(const AuthInitial()) {
    on<LocationCheckRequested>(_onLocationCheckRequested);
    on<RegisterRequested>(_onRegisterRequested);
    on<OtpVerified>(_onOtpVerified);
    on<ResendOtpRequested>(_onResendOtpRequested);
    on<LoginRequested>(_onLoginRequested);
    on<BiometricLoginRequested>(_onBiometricLoginRequested);
    on<AuthReset>(_onAuthReset);
  }

  final AuthService _authService;

  Future<void> _onLocationCheckRequested(
    LocationCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await _authService.checkLocationInDagupan(
        latitude: event.latitude,
        longitude: event.longitude,
      );
      final success = result['success'] as bool? ?? false;
      final isInDagupan = result['isInDagupan'] as bool? ?? false;
      final message = result['message'] as String? ??
          result['error'] as String? ??
          'Location check failed';
      if (success) {
        emit(LocationVerified(isInDagupan: isInDagupan, message: message));
      } else {
        emit(LocationError(message));
      }
    } catch (e) {
      emit(LocationError(e.toString()));
    }
  }

  Future<void> _onRegisterRequested(
    RegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await _authService.register(
        firstName: event.firstName,
        lastName: event.lastName,
        phone: event.phone,
        barangay: event.address,
        password: event.password,
        latitude: event.latitude,
        longitude: event.longitude,
        captchaToken: event.captchaToken,
        storeToken: false,
      );
      if (result['success'] == true) {
        emit(RegisterSuccess(event.phone));
      } else {
        final error = result['error'] as String? ?? 'Registration failed';
        emit(RegisterError(error));
      }
    } catch (e) {
      emit(RegisterError(e.toString()));
    }
  }

  Future<void> _onOtpVerified(
    OtpVerified event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await _authService.verifyOtp(
        phone: event.phone,
        otp: event.otp,
        storeToken: event.storeToken,
      );
      if (result['success'] == true) {
        if (event.storeToken) {
          final data = result['data'] as Map<String, dynamic>?;
          final user = data?['user'] as Map<String, dynamic>? ?? {};
          final token = data?['token'] as String? ?? '';
          emit(LoginSuccess(user: user, token: token));
        } else {
          emit(const PhoneVerified());
        }
      } else {
        final error = result['error'] as String? ?? 'Verification failed';
        emit(OtpError(error));
      }
    } catch (e) {
      emit(OtpError(e.toString()));
    }
  }

  Future<void> _onResendOtpRequested(
    ResendOtpRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await _authService.resendOtp(
        phone: event.phone,
        captchaToken: event.captchaToken,
      );
      if (result['success'] == true) {
        emit(const OtpSent());
      } else {
        final error = result['error'] as String? ?? 'Failed to resend OTP';
        emit(OtpError(error));
      }
    } catch (e) {
      emit(OtpError(e.toString()));
    }
  }

  Future<void> _onLoginRequested(
    LoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final result = await _authService.login(
        phone: event.phone,
        password: event.password,
      );
      if (result['success'] == true) {
        final user = result['user'] as Map<String, dynamic>? ?? {};
        final token = result['token'] as String? ?? '';
        emit(LoginSuccess(user: user, token: token));
      } else {
        final error = result['error'] as String? ?? 'Login failed';
        emit(LoginError(error));
      }
    } catch (e) {
      emit(LoginError(e.toString()));
    }
  }

  Future<void> _onBiometricLoginRequested(
    BiometricLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    try {
      final biometricEnabled = await _authService.isBiometricLoginEnabled();
      if (!biometricEnabled) {
        emit(const LoginError(
          'Biometric login is turned off. Enable it in Privacy & Security settings.',
        ));
        return;
      }

      // Prefer stored credentials to obtain a fresh token (handles blacklisted/expired
      // tokens after app exit)
      final credentials = await _authService.getCredentialsForBiometric();
      if (credentials != null) {
        final result = await _authService.login(
          phone: credentials.phone,
          password: credentials.password,
        );
        if (result['success'] == true && result['user'] != null && result['token'] != null) {
          final user = (result['user'] as Map<String, dynamic>?) ?? {};
          emit(LoginSuccess(user: user, token: result['token'] as String));
          return;
        }
        emit(LoginError(
          result['error']?.toString() ?? 'Incorrect password or number. Please log in manually.',
        ));
        return;
      }

      // Fallback: try stored token (legacy or when credentials not yet saved)
      final token = await _authService.getTokenForBiometric();
      if (token == null || token.isEmpty) {
        emit(const LoginError('Biometric login not set up. Log in with phone and password first.'));
        return;
      }
      await _authService.setToken(token);
      final profile = await _authService.getProfile();
      if (profile['success'] == true) {
        final user = (profile['user'] as Map<String, dynamic>?) ?? {};
        emit(LoginSuccess(user: user, token: token));
      } else {
        // Token is blacklisted/expired; clear it so user uses phone+password (which saves credentials)
        await _authService.clearBiometricToken();
        emit(const LoginError(
          'Session expired. Please log in with your phone number and password. Biometric login will work again after that.',
        ));
      }
    } catch (e) {
      emit(LoginError(e.toString()));
    }
  }

  void _onAuthReset(AuthReset event, Emitter<AuthState> emit) {
    emit(const AuthInitial());
  }
}
