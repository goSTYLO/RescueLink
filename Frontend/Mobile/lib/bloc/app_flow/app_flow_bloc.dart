import 'package:flutter_bloc/flutter_bloc.dart';
import 'app_flow_event.dart';
import 'app_flow_state.dart';

class AppFlowBloc extends Bloc<AppFlowEvent, AppFlowState> {
  AppFlowBloc() : super(const AppFlowState()) {
    on<ShowLogin>(_onShowLogin);
    on<ShowSignUp>(_onShowSignUp);
    on<BackToLogin>(_onBackToLogin);
    on<ShowForgotPassword>(_onShowForgotPassword);
    on<SetForgotPhone>(_onSetForgotPhone);
    on<SetForgotStep>(_onSetForgotStep);
    on<SignUpFormSubmitted>(_onSignUpFormSubmitted);
    on<SignUpLocationVerified>(_onSignUpLocationVerified);
    on<SignUpLocationFailed>(_onSignUpLocationFailed);
    on<SignUpPhoneOtpSent>(_onSignUpPhoneOtpSent);
    on<SignUpPhoneOtpBack>(_onSignUpPhoneOtpBack);
    on<SignUpPhoneVerified>(_onSignUpPhoneVerified);
    on<ShowAccountCreated>(_onShowAccountCreated);
    on<ShowResidencyCheck>(_onShowResidencyCheck);
    on<SetResidencyInsideDagupan>(_onSetResidencyInsideDagupan);
    on<SetResidencyVerificationStep>(_onSetResidencyVerificationStep);
    on<ShowDashboard>(_onShowDashboard);
    on<LoginSuccessNavigateToDashboard>(_onLoginSuccessNavigateToDashboard);
    on<RegisterSuccessNavigateToPhoneVerify>(_onRegisterSuccessNavigateToPhoneVerify);
    on<OtpVerifiedNavigateToAccountCreated>(_onOtpVerifiedNavigateToAccountCreated);
    on<OtpVerifiedNavigateToDashboard>(_onOtpVerifiedNavigateToDashboard);
  }

  void _onShowLogin(ShowLogin event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      step: AppFlowStep.login,
      clearForgotData: true,
      clearSignupData: true,
    ));
  }

  void _onShowSignUp(ShowSignUp event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      step: AppFlowStep.signup,
      clearForgotData: true,
    ));
  }

  void _onBackToLogin(BackToLogin event, Emitter<AppFlowState> emit) {
    emit(const AppFlowState(step: AppFlowStep.login));
  }

  void _onShowForgotPassword(ShowForgotPassword event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      step: AppFlowStep.forgotPassword,
      forgotPhoneNumber: null,
    ));
  }

  void _onSetForgotPhone(SetForgotPhone event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      forgotPhoneNumber: event.phone,
      step: AppFlowStep.forgotVerifyNumber,
    ));
  }

  void _onSetForgotStep(SetForgotStep event, Emitter<AppFlowState> emit) {
    switch (event.step) {
      case 'verify_number':
        emit(state.copyWith(step: AppFlowStep.forgotVerifyNumber));
        break;
      case 'verified':
        emit(state.copyWith(step: AppFlowStep.forgotVerified));
        break;
      case 'identity_error':
        emit(state.copyWith(step: AppFlowStep.forgotIdentityError));
        break;
      case 'create_new_password':
        emit(state.copyWith(step: AppFlowStep.forgotCreateNewPassword));
        break;
      case 'password_updated':
        emit(state.copyWith(step: AppFlowStep.forgotPasswordUpdated));
        break;
      case 'forgot_password':
        emit(state.copyWith(step: AppFlowStep.forgotPassword));
        break;
      default:
        emit(state.copyWith(step: AppFlowStep.forgotPassword));
    }
  }

  void _onSignUpFormSubmitted(SignUpFormSubmitted event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      step: AppFlowStep.signupLocation,
      signupFirstName: event.firstName,
      signupLastName: event.lastName,
      signupPhone: event.phone,
      signupBarangay: event.barangay,
      signupPassword: event.password,
    ));
  }

  void _onSignUpLocationVerified(SignUpLocationVerified event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      signupLatitude: event.lat,
      signupLongitude: event.lng,
      step: AppFlowStep.signupPhoneRequestOtp,
    ));
  }

  void _onSignUpLocationFailed(SignUpLocationFailed event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.signup));
  }

  void _onSignUpPhoneOtpSent(SignUpPhoneOtpSent event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.signupPhoneEnterOtp));
  }

  void _onSignUpPhoneOtpBack(SignUpPhoneOtpBack event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.signupPhoneRequestOtp));
  }

  void _onSignUpPhoneVerified(SignUpPhoneVerified event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.accountCreated));
  }

  void _onShowAccountCreated(ShowAccountCreated event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.accountCreated));
  }

  void _onShowResidencyCheck(ShowResidencyCheck event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      step: state.isInsideDagupan ? AppFlowStep.residencyCheck : AppFlowStep.residencyOutsideArea,
    ));
  }

  void _onSetResidencyInsideDagupan(SetResidencyInsideDagupan event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(
      isInsideDagupan: event.isInside,
      step: event.isInside ? AppFlowStep.residencyCheck : AppFlowStep.residencyOutsideArea,
    ));
  }

  void _onSetResidencyVerificationStep(SetResidencyVerificationStep event, Emitter<AppFlowState> emit) {
    switch (event.step) {
      case 'human':
        emit(state.copyWith(step: AppFlowStep.residencyRequestOtp));
        break;
      case 'otp':
        emit(state.copyWith(step: AppFlowStep.residencyEnterOtp));
        break;
      default:
        emit(state.copyWith(step: AppFlowStep.residencyCheck));
    }
  }

  void _onShowDashboard(ShowDashboard event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.dashboard));
  }

  void _onLoginSuccessNavigateToDashboard(LoginSuccessNavigateToDashboard event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.dashboard));
  }

  void _onRegisterSuccessNavigateToPhoneVerify(RegisterSuccessNavigateToPhoneVerify event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.signupPhoneRequestOtp));
  }

  void _onOtpVerifiedNavigateToAccountCreated(OtpVerifiedNavigateToAccountCreated event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.accountCreated));
  }

  void _onOtpVerifiedNavigateToDashboard(OtpVerifiedNavigateToDashboard event, Emitter<AppFlowState> emit) {
    emit(state.copyWith(step: AppFlowStep.dashboard));
  }
}
