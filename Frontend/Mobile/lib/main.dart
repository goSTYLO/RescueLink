import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'firebase_options.dart';
import 'bloc/app_flow/app_flow_bloc.dart';
import 'bloc/app_flow/app_flow_event.dart';
import 'bloc/app_flow/app_flow_state.dart';
import 'bloc/auth/auth_bloc.dart';
import 'bloc/auth/auth_event.dart';
import 'bloc/auth/auth_state.dart';
import 'repositories/auth_repository.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/verify_number_screen.dart';
import 'screens/verified_screen.dart';
import 'screens/identity_error_screen.dart';
import 'screens/create_new_password_screen.dart';
import 'screens/password_updated_screen.dart';
import 'screens/verify_dagupan_residency_screen.dart';
import 'screens/verification_screen.dart';
import 'screens/verification_otp_screen.dart';
import 'screens/outside_service_area_screen.dart';
import 'screens/home_placeholder_screen.dart';
import 'screens/account_created_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const RescueLinkApp());
}

class RescueLinkApp extends StatelessWidget {
  const RescueLinkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return RepositoryProvider<AuthRepository>(
      create: (_) => AuthRepository(authService: AuthService()),
      child: MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>(
            create: (context) => AuthBloc(authRepository: context.read<AuthRepository>())..add(const AuthInit()),
          ),
          BlocProvider<AppFlowBloc>(
            create: (_) => AppFlowBloc()..add(const ShowLogin()),
          ),
        ],
        child: MaterialApp(
          title: 'RescueLink',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
            useMaterial3: true,
          ),
          home: const AppNavigator(),
        ),
      ),
    );
  }
}

class AppNavigator extends StatelessWidget {
  const AppNavigator({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (previous, current) => current is Authenticated || current is AuthError,
      listener: (context, authState) {
        if (authState is Authenticated) {
          final step = context.read<AppFlowBloc>().state.step;
          if (step == AppFlowStep.signupLocation) {
            context.read<AppFlowBloc>().add(const RegisterSuccessNavigateToPhoneVerify());
          } else if (step == AppFlowStep.signupPhoneEnterOtp) {
            context.read<AppFlowBloc>().add(const OtpVerifiedNavigateToAccountCreated());
          } else if (step == AppFlowStep.residencyEnterOtp) {
            context.read<AppFlowBloc>().add(const OtpVerifiedNavigateToDashboard());
          }
        }
        if (authState is AuthError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(authState.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: BlocBuilder<AppFlowBloc, AppFlowState>(
        builder: (context, flowState) {
          switch (flowState.step) {
            case AppFlowStep.dashboard:
              return const HomePlaceholderScreen();

            case AppFlowStep.signupLocation:
              return VerifyDagupanResidencyScreen(
                onVerificationComplete: (lat, lng) {
                  context.read<AuthBloc>().add(
                        RegisterRequested(
                          firstName: flowState.signupFirstName!,
                          lastName: flowState.signupLastName!,
                          phone: flowState.signupPhone!,
                          barangay: flowState.signupBarangay!,
                          password: flowState.signupPassword!,
                          latitude: lat,
                          longitude: lng,
                        ),
                      );
                },
              onRefreshGps: () {},
              selectedBarangay: flowState.signupBarangay,
              onLocationVerificationFailed: () {
                context.read<AppFlowBloc>().add(const SignUpLocationFailed());
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('You must be in Dagupan City to create an account'),
                    backgroundColor: Colors.red,
                  ),
                );
              },
            );

          case AppFlowStep.signupPhoneRequestOtp:
            return VerifyNumberScreen(
              phoneNumber: flowState.signupPhone ?? '',
              isRequestingOTP: true,
              onBack: () => context.read<AppFlowBloc>().add(const BackToLogin()),
            );

          case AppFlowStep.signupPhoneEnterOtp:
            return VerificationOtpScreen(
              phoneNumber: flowState.signupPhone ?? '',
              onBack: () => context.read<AppFlowBloc>().add(const SignUpPhoneOtpBack()),
              onVerifyAndContinue: (_) {},
              selectedBarangay: flowState.signupBarangay,
              cityRegion: 'Dagupan City, Pangasinan',
            );

          case AppFlowStep.residencyCheck:
            return VerifyDagupanResidencyScreen(
              onVerificationComplete: (lat, lng) {
                context.read<AppFlowBloc>().add(const SetResidencyVerificationStep('human'));
              },
              onRefreshGps: () {},
              selectedBarangay: flowState.residencyBarangay ?? 'Barangay Poblacion Oeste',
            );

          case AppFlowStep.residencyRequestOtp:
            return VerificationScreen(
              onRequestOtp: () => context.read<AppFlowBloc>().add(const SetResidencyVerificationStep('otp')),
              onBack: () => context.read<AppFlowBloc>().add(const SetResidencyVerificationStep('back')),
              selectedBarangay: flowState.residencyBarangay ?? 'Barangay Poblacion Oeste',
              cityRegion: flowState.residencyCityRegion ?? 'Dagupan City, Pangasinan',
            );

          case AppFlowStep.residencyEnterOtp:
            return VerificationOtpScreen(
              phoneNumber: flowState.residencyVerificationPhone ?? '+63 917 123 4567',
              onVerifyAndContinue: (_) {},
              onBack: () => context.read<AppFlowBloc>().add(const SetResidencyVerificationStep('human')),
              selectedBarangay: flowState.residencyBarangay ?? 'Barangay Poblacion Oeste',
              cityRegion: flowState.residencyCityRegion ?? 'Dagupan City, Pangasinan',
            );

          case AppFlowStep.residencyOutsideArea:
            return OutsideServiceAreaScreen(
              onRetry: () => context.read<AppFlowBloc>().add(const SetResidencyInsideDagupan(true)),
              onGoBack: () => context.read<AppFlowBloc>().add(const BackToLogin()),
            );

          case AppFlowStep.accountCreated:
            return const AccountCreatedScreen();

          case AppFlowStep.forgotPassword:
            return ForgotPasswordScreen(
              onBackToLogin: () => context.read<AppFlowBloc>().add(const BackToLogin()),
              onRequestCode: (phone) => context.read<AppFlowBloc>().add(SetForgotPhone(phone)),
            );

          case AppFlowStep.forgotVerifyNumber:
            return VerifyNumberScreen(
              phoneNumber: flowState.forgotPhoneNumber ?? '',
              isRequestingOTP: true,
              onBack: () => context.read<AppFlowBloc>().add(const SetForgotStep('forgot_password')),
            );

          case AppFlowStep.forgotVerified:
            return VerifiedScreen(
              onDone: () => context.read<AppFlowBloc>().add(const SetForgotStep('create_new_password')),
            );

          case AppFlowStep.forgotIdentityError:
            return IdentityErrorScreen(
              onTryAgain: () => context.read<AppFlowBloc>().add(const SetForgotStep('verify_number')),
            );

          case AppFlowStep.forgotCreateNewPassword:
            return CreateNewPasswordScreen(
              phoneNumber: flowState.forgotPhoneNumber ?? '',
              onBack: () => context.read<AppFlowBloc>().add(const SetForgotStep('verified')),
              onResetPassword: (_) => context.read<AppFlowBloc>().add(const SetForgotStep('password_updated')),
            );

          case AppFlowStep.forgotPasswordUpdated:
            return PasswordUpdatedScreen(
              onBackToLogin: () => context.read<AppFlowBloc>().add(const BackToLogin()),
            );

          case AppFlowStep.signup:
            return SignUpScreen(
              onLoginTap: () => context.read<AppFlowBloc>().add(const ShowLogin()),
              onSignUp: (firstName, lastName, phone, barangay, password) {
                context.read<AppFlowBloc>().add(
                      SignUpFormSubmitted(
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone,
                        barangay: barangay,
                        password: password,
                      ),
                    );
              },
            );

            case AppFlowStep.login:
            return LoginScreen(
              onSignUpTap: () => context.read<AppFlowBloc>().add(const ShowSignUp()),
              onSkip: () {},
              onForgotPasswordTap: () => context.read<AppFlowBloc>().add(const ShowForgotPassword()),
              onLogin: (phone, password) {
                context.read<AuthBloc>().add(LoginRequested(phone: phone, password: password));
              },
            );
        }
        },
      ),
    );
  }
}
