import 'package:equatable/equatable.dart';

abstract class AppFlowEvent extends Equatable {
  const AppFlowEvent();

  @override
  List<Object?> get props => [];
}

class ShowLogin extends AppFlowEvent {
  const ShowLogin();
}

class ShowSignUp extends AppFlowEvent {
  const ShowSignUp();
}

class BackToLogin extends AppFlowEvent {
  const BackToLogin();
}

class ShowForgotPassword extends AppFlowEvent {
  const ShowForgotPassword();
}

class SetForgotPhone extends AppFlowEvent {
  final String phone;

  const SetForgotPhone(this.phone);

  @override
  List<Object?> get props => [phone];
}

class SetForgotStep extends AppFlowEvent {
  final String step;

  const SetForgotStep(this.step);

  @override
  List<Object?> get props => [step];
}

class SignUpFormSubmitted extends AppFlowEvent {
  final String firstName;
  final String lastName;
  final String phone;
  final String barangay;
  final String password;

  const SignUpFormSubmitted({
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.barangay,
    required this.password,
  });

  @override
  List<Object?> get props => [firstName, lastName, phone, barangay, password];
}

class SignUpLocationVerified extends AppFlowEvent {
  final double lat;
  final double lng;

  const SignUpLocationVerified({required this.lat, required this.lng});

  @override
  List<Object?> get props => [lat, lng];
}

class SignUpLocationFailed extends AppFlowEvent {
  const SignUpLocationFailed();
}

class SignUpPhoneOtpSent extends AppFlowEvent {
  const SignUpPhoneOtpSent();
}

class SignUpPhoneOtpBack extends AppFlowEvent {
  const SignUpPhoneOtpBack();
}

class SignUpPhoneVerified extends AppFlowEvent {
  const SignUpPhoneVerified();
}

class ShowAccountCreated extends AppFlowEvent {
  const ShowAccountCreated();
}

class ShowResidencyCheck extends AppFlowEvent {
  const ShowResidencyCheck();
}

class SetResidencyInsideDagupan extends AppFlowEvent {
  final bool isInside;

  const SetResidencyInsideDagupan(this.isInside);

  @override
  List<Object?> get props => [isInside];
}

class SetResidencyVerificationStep extends AppFlowEvent {
  final String step;

  const SetResidencyVerificationStep(this.step);

  @override
  List<Object?> get props => [step];
}

class ShowDashboard extends AppFlowEvent {
  const ShowDashboard();
}

class LoginSuccessNavigateToDashboard extends AppFlowEvent {
  const LoginSuccessNavigateToDashboard();
}

class RegisterSuccessNavigateToPhoneVerify extends AppFlowEvent {
  const RegisterSuccessNavigateToPhoneVerify();
}

class OtpVerifiedNavigateToAccountCreated extends AppFlowEvent {
  const OtpVerifiedNavigateToAccountCreated();
}

class OtpVerifiedNavigateToDashboard extends AppFlowEvent {
  const OtpVerifiedNavigateToDashboard();
}
