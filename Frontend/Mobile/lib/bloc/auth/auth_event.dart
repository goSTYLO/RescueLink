import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthInit extends AuthEvent {
  const AuthInit();
}

class LoginRequested extends AuthEvent {
  final String phone;
  final String password;

  const LoginRequested({required this.phone, required this.password});

  @override
  List<Object?> get props => [phone, password];
}

class RegisterRequested extends AuthEvent {
  final String firstName;
  final String lastName;
  final String phone;
  final String barangay;
  final String password;
  final double latitude;
  final double longitude;

  const RegisterRequested({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.barangay,
    required this.password,
    required this.latitude,
    required this.longitude,
  });

  @override
  List<Object?> get props =>
      [firstName, lastName, phone, barangay, password, latitude, longitude];
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

class OtpRequested extends AuthEvent {
  final String phoneNumber;

  const OtpRequested(this.phoneNumber);

  @override
  List<Object?> get props => [phoneNumber];
}

class OtpVerified extends AuthEvent {
  final String otp;
  final double latitude;
  final double longitude;

  const OtpVerified({
    required this.otp,
    required this.latitude,
    required this.longitude,
  });

  @override
  List<Object?> get props => [otp, latitude, longitude];
}

class ResendOtpRequested extends AuthEvent {
  final String phoneNumber;

  const ResendOtpRequested(this.phoneNumber);

  @override
  List<Object?> get props => [phoneNumber];
}
