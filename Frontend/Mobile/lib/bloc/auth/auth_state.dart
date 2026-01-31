import 'package:equatable/equatable.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class LocationVerified extends AuthState {
  final bool isInDagupan;
  final String message;

  const LocationVerified({
    required this.isInDagupan,
    required this.message,
  });

  @override
  List<Object?> get props => [isInDagupan, message];
}

class LocationError extends AuthState {
  final String message;

  const LocationError(this.message);

  @override
  List<Object?> get props => [message];
}

class RegisterSuccess extends AuthState {
  final String phone;

  const RegisterSuccess(this.phone);

  @override
  List<Object?> get props => [phone];
}

class RegisterError extends AuthState {
  final String message;

  const RegisterError(this.message);

  @override
  List<Object?> get props => [message];
}

class OtpSent extends AuthState {
  const OtpSent();
}

class OtpError extends AuthState {
  final String message;

  const OtpError(this.message);

  @override
  List<Object?> get props => [message];
}

class PhoneVerified extends AuthState {
  const PhoneVerified();
}

class LoginSuccess extends AuthState {
  final Map<String, dynamic> user;
  final String token;

  const LoginSuccess({required this.user, required this.token});

  @override
  List<Object?> get props => [user, token];
}

class LoginError extends AuthState {
  final String message;

  const LoginError(this.message);

  @override
  List<Object?> get props => [message];
}

class AuthError extends AuthState {
  final String message;

  const AuthError(this.message);

  @override
  List<Object?> get props => [message];
}
