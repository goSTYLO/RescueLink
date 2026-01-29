import 'package:flutter/material.dart';
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

void main() {
  runApp(const RescueLinkApp());
}

class RescueLinkApp extends StatelessWidget {
  const RescueLinkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RescueLink',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const AuthNavigator(),
    );
  }
}

class AuthNavigator extends StatefulWidget {
  const AuthNavigator({super.key});

  @override
  State<AuthNavigator> createState() => _AuthNavigatorState();
}

class _AuthNavigatorState extends State<AuthNavigator> {
  bool _showSignUp = false;
  String? _forgotFlowScreen;
  String _forgotPhoneNumber = '';

  // After signup: show Account Created confirmation
  bool _showAccountCreated = false;

  // After login: show residency verification (inside or outside Dagupan)
  bool _showResidencyCheck = false;
  bool _isInsideDagupan = true; // Replace with real location/API check
  bool _showDashboard = false;

  // Verification flow: null -> human (Request OTP) -> otp (Enter OTP) -> dashboard
  String? _verificationStep;
  static const String _verificationPhone = '+63 917 123 4567'; // TODO: use logged-in user phone

  void _toggleView() {
    setState(() {
      _showSignUp = !_showSignUp;
      _forgotFlowScreen = null;
    });
  }

  void _showForgotPassword() {
    setState(() {
      _forgotFlowScreen = 'forgot_password';
      _forgotPhoneNumber = '';
    });
  }

  void _backToLogin() {
    setState(() {
      _forgotFlowScreen = null;
      _showSignUp = false;
      _showAccountCreated = false;
      _showResidencyCheck = false;
      _showDashboard = false;
      _verificationStep = null;
    });
  }

  void _handleSkip() {
    print('Skip pressed');
  }

  Future<void> _handleLogin(String phone, String password) async {
    print('Login: $phone, $password');
    // On login success, show residency verification.
    // Replace _isInsideDagupan with real API call: e.g. POST /api/location/check with lat/lng
    setState(() {
      _showResidencyCheck = true;
      _isInsideDagupan = true; // Set false to test Outside Service Area screen
    });
  }

  Future<void> _handleSignUp(
    String firstName,
    String lastName,
    String phone,
    String barangay,
    String password,
  ) async {
    print('SignUp: $firstName $lastName, $phone, $barangay, $password');
    // When account is created successfully, show Account Created screen
    setState(() => _showAccountCreated = true);
  }

  void _onResidencyRetry() {
    // Re-check location; for demo you can toggle to see the other screen
    setState(() {
      _isInsideDagupan = !_isInsideDagupan;
    });
  }

  @override
  Widget build(BuildContext context) {
    // Dashboard (after residency verified)
    if (_showDashboard) {
      return HomePlaceholderScreen(onLogout: _backToLogin);
    }

    // Residency check (after login): inside Dagupan vs outside service area
    if (_showResidencyCheck) {
      if (_isInsideDagupan) {
        // Verification flow: Dagupan screen -> Verification (Request OTP) -> Enter OTP -> dashboard
        if (_verificationStep == 'human') {
          return VerificationScreen(
            onRequestOtp: () => setState(() => _verificationStep = 'otp'),
            onBack: () => setState(() => _verificationStep = null),
            selectedBarangay: 'Barangay Poblacion Oeste',
            cityRegion: 'Dagupan City, Pangasinan',
          );
        }
        if (_verificationStep == 'otp') {
          return VerificationOtpScreen(
            phoneNumber: _verificationPhone,
            onVerifyAndContinue: () {
              setState(() {
                _verificationStep = null;
                _showResidencyCheck = false;
                _showDashboard = true;
              });
            },
            onBack: () => setState(() => _verificationStep = 'human'),
            selectedBarangay: 'Barangay Poblacion Oeste',
            cityRegion: 'Dagupan City, Pangasinan',
          );
        }
        return VerifyDagupanResidencyScreen(
          onVerificationComplete: () => setState(() => _verificationStep = 'human'),
          onRefreshGps: () {
            // TODO: re-fetch GPS and update _isInsideDagupan via API
            setState(() {});
          },
          selectedBarangay: 'Barangay Poblacion Oeste',
        );
      } else {
        return OutsideServiceAreaScreen(
          onRetry: _onResidencyRetry,
          onGoBack: _backToLogin,
        );
      }
    }

    // Account Created (after signup success)
    if (_showAccountCreated) {
      return AccountCreatedScreen(
        onBackToLogin: _backToLogin,
        onDone: _backToLogin,
      );
    }

    // Forgot password flow
    if (_forgotFlowScreen != null) {
      switch (_forgotFlowScreen!) {
        case 'forgot_password':
          return ForgotPasswordScreen(
            onBackToLogin: _backToLogin,
            onRequestCode: (phone) {
              setState(() {
                _forgotPhoneNumber = phone;
                _forgotFlowScreen = 'verify_number';
              });
            },
          );
        case 'verify_number':
          return VerifyNumberScreen(
            phoneNumber: _forgotPhoneNumber,
            onBack: () => setState(() => _forgotFlowScreen = 'forgot_password'),
            onVerifyCode: (code) {
              setState(() => _forgotFlowScreen = 'verified');
            },
          );
        case 'verified':
          return VerifiedScreen(
            onDone: () => setState(() => _forgotFlowScreen = 'create_new_password'),
          );
        case 'identity_error':
          return IdentityErrorScreen(
            onTryAgain: () => setState(() => _forgotFlowScreen = 'verify_number'),
          );
        case 'create_new_password':
          return CreateNewPasswordScreen(
            phoneNumber: _forgotPhoneNumber,
            onBack: () => setState(() => _forgotFlowScreen = 'verified'),
            onResetPassword: (newPassword) {
              setState(() => _forgotFlowScreen = 'password_updated');
            },
          );
        case 'password_updated':
          return PasswordUpdatedScreen(
            onBackToLogin: _backToLogin,
          );
        default:
          _backToLogin();
      }
    }

    // Login / SignUp
    if (_showSignUp) {
      return SignUpScreen(
        onLoginTap: _toggleView,
        onSignUp: _handleSignUp,
      );
    }

    return LoginScreen(
      onSignUpTap: _toggleView,
      onSkip: _handleSkip,
      onForgotPasswordTap: _showForgotPassword,
      onLogin: _handleLogin,
    );
  }
}
