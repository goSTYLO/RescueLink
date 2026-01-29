import 'package:flutter_bloc/flutter_bloc.dart';
import '../../models/auth_result.dart';
import '../../models/otp_result.dart';
import '../../repositories/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository authRepository;

  AuthBloc({required this.authRepository}) : super(const AuthInitial()) {
    on<AuthInit>(_onAuthInit);
    on<LoginRequested>(_onLoginRequested);
    on<RegisterRequested>(_onRegisterRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<OtpRequested>(_onOtpRequested);
    on<OtpVerified>(_onOtpVerified);
    on<ResendOtpRequested>(_onResendOtpRequested);
  }

  Future<void> _onAuthInit(AuthInit event, Emitter<AuthState> emit) async {
    await authRepository.init();
    final token = authRepository.getToken();
    if (token != null && token.isNotEmpty) {
      emit(const Unauthenticated());
    } else {
      emit(const Unauthenticated());
    }
  }

  Future<void> _onLoginRequested(
    LoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await authRepository.login(
      phone: event.phone,
      password: event.password,
    );

    if (result is AuthSuccess) {
      emit(Authenticated(result.user, token: result.token));
    } else if (result is AuthFailure) {
      emit(AuthError(result.message));
    }
  }

  Future<void> _onRegisterRequested(
    RegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await authRepository.register(
      firstName: event.firstName,
      lastName: event.lastName,
      phone: event.phone,
      barangay: event.barangay,
      password: event.password,
      latitude: event.latitude,
      longitude: event.longitude,
    );

    if (result is AuthSuccess) {
      emit(Authenticated(result.user, token: result.token));
    } else if (result is AuthFailure) {
      emit(AuthError(result.message));
    }
  }

  Future<void> _onLogoutRequested(
    LogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    await authRepository.logout();
    emit(const Unauthenticated());
  }

  Future<void> _onOtpRequested(
    OtpRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await authRepository.requestOtp(event.phoneNumber);

    if (result is OtpSuccess) {
      emit(const Unauthenticated());
    } else if (result is OtpFailure) {
      emit(AuthError(result.error));
    }
  }

  Future<void> _onOtpVerified(
    OtpVerified event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await authRepository.verifyOtp(
      otp: event.otp,
      latitude: event.latitude,
      longitude: event.longitude,
    );

    if (result is AuthSuccess) {
      emit(Authenticated(result.user, token: result.token));
    } else if (result is AuthFailure) {
      emit(AuthError(result.message));
    }
  }

  Future<void> _onResendOtpRequested(
    ResendOtpRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(const AuthLoading());
    final result = await authRepository.resendOtp(event.phoneNumber);

    if (result is OtpSuccess) {
      emit(const Unauthenticated());
    } else if (result is OtpFailure) {
      emit(AuthError(result.error));
    }
  }
}
