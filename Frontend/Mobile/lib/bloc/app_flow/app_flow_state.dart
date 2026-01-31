import 'package:equatable/equatable.dart';

enum AppFlowStep {
  login,
  signup,
  forgotPassword,
  forgotVerifyNumber,
  forgotVerified,
  forgotIdentityError,
  forgotCreateNewPassword,
  forgotPasswordUpdated,
  signupLocation,
  signupPhoneRequestOtp,
  signupPhoneEnterOtp,
  accountCreated,
  residencyCheck,
  residencyOutsideArea,
  residencyRequestOtp,
  residencyEnterOtp,
  dashboard,
}

class AppFlowState extends Equatable {
  final AppFlowStep step;
  final String? forgotPhoneNumber;
  final String? signupFirstName;
  final String? signupLastName;
  final String? signupPhone;
  final String? signupBarangay;
  final String? signupPassword;
  final double signupLatitude;
  final double signupLongitude;
  final String? residencyVerificationPhone;
  final String? residencyBarangay;
  final String? residencyCityRegion;
  final bool isInsideDagupan;

  const AppFlowState({
    this.step = AppFlowStep.login,
    this.forgotPhoneNumber,
    this.signupFirstName,
    this.signupLastName,
    this.signupPhone,
    this.signupBarangay,
    this.signupPassword,
    this.signupLatitude = 0.0,
    this.signupLongitude = 0.0,
    this.residencyVerificationPhone,
    this.residencyBarangay,
    this.residencyCityRegion,
    this.isInsideDagupan = true,
  });

  AppFlowState copyWith({
    AppFlowStep? step,
    String? forgotPhoneNumber,
    String? signupFirstName,
    String? signupLastName,
    String? signupPhone,
    String? signupBarangay,
    String? signupPassword,
    double? signupLatitude,
    double? signupLongitude,
    String? residencyVerificationPhone,
    String? residencyBarangay,
    String? residencyCityRegion,
    bool? isInsideDagupan,
    bool clearSignupData = false,
    bool clearForgotData = false,
  }) {
    return AppFlowState(
      step: step ?? this.step,
      forgotPhoneNumber: clearForgotData ? null : (forgotPhoneNumber ?? this.forgotPhoneNumber),
      signupFirstName: clearSignupData ? null : (signupFirstName ?? this.signupFirstName),
      signupLastName: clearSignupData ? null : (signupLastName ?? this.signupLastName),
      signupPhone: clearSignupData ? null : (signupPhone ?? this.signupPhone),
      signupBarangay: clearSignupData ? null : (signupBarangay ?? this.signupBarangay),
      signupPassword: clearSignupData ? null : (signupPassword ?? this.signupPassword),
      signupLatitude: signupLatitude ?? this.signupLatitude,
      signupLongitude: signupLongitude ?? this.signupLongitude,
      residencyVerificationPhone: residencyVerificationPhone ?? this.residencyVerificationPhone,
      residencyBarangay: residencyBarangay ?? this.residencyBarangay,
      residencyCityRegion: residencyCityRegion ?? this.residencyCityRegion,
      isInsideDagupan: isInsideDagupan ?? this.isInsideDagupan,
    );
  }

  @override
  List<Object?> get props => [
        step,
        forgotPhoneNumber,
        signupFirstName,
        signupLastName,
        signupPhone,
        signupBarangay,
        signupPassword,
        signupLatitude,
        signupLongitude,
        residencyVerificationPhone,
        residencyBarangay,
        residencyCityRegion,
        isInsideDagupan,
      ];
}
