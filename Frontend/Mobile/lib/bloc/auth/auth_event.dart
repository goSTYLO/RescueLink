import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class LocationCheckRequested extends AuthEvent {
  final double latitude;
  final double longitude;

  const LocationCheckRequested({
    required this.latitude,
    required this.longitude,
  });

  @override
  List<Object?> get props => [latitude, longitude];
}

class RegisterRequested extends AuthEvent {
  final String firstName;
  final String lastName;
  final String phone;
  final String address;
  final String password;
  final double latitude;
  final double longitude;
  final String captchaToken;

  const RegisterRequested({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.address,
    required this.password,
    required this.latitude,
    required this.longitude,
    required this.captchaToken,
  });

  @override
  List<Object?> get props => [
        firstName,
        lastName,
        phone,
        address,
        password,
        latitude,
        longitude,
        captchaToken,
      ];
}

class OtpVerified extends AuthEvent {
  final String phone;
  final String otp;
  final bool storeToken;

  const OtpVerified({
    required this.phone,
    required this.otp,
    this.storeToken = false,
  });

  @override
  List<Object?> get props => [phone, otp, storeToken];
}

class ResendOtpRequested extends AuthEvent {
  final String phone;
  final String captchaToken;

  const ResendOtpRequested({
    required this.phone,
    required this.captchaToken,
  });

  @override
  List<Object?> get props => [phone, captchaToken];
}

class LoginRequested extends AuthEvent {
  final String phone;
  final String password;

  const LoginRequested({required this.phone, required this.password});

  @override
  List<Object?> get props => [phone, password];
}

class BiometricLoginRequested extends AuthEvent {
  const BiometricLoginRequested();
}

class AuthReset extends AuthEvent {
  const AuthReset();
}
