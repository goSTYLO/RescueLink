import 'package:flutter/material.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/signup_screen.dart';
import 'screens/auth/account_created_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/verify_number_screen.dart';
import 'screens/auth/verified_screen.dart';
import 'screens/auth/identity_error_screen.dart';
import 'screens/auth/create_new_password_screen.dart';
import 'screens/auth/password_updated_screen.dart';
import 'screens/verification/verify_dagupan_residency_screen.dart';
import 'screens/verification/verification_screen.dart';
import 'screens/verification/verification_otp_screen.dart';
import 'screens/verification/outside_service_area_screen.dart';
import 'screens/home/home_placeholder_screen.dart';
import 'screens/home/emergency_report_screen.dart';
import 'screens/home/emergency_tracking_screen.dart';
import 'screens/home/report_details_screen.dart';
import 'screens/home/change_phone_number_screen.dart';
import 'screens/home/enter_new_phone_number_screen.dart';
import 'screens/home/verify_new_phone_otp_screen.dart';
import 'screens/home/phone_number_updated_screen.dart';
import 'screens/home/barangay_information_screen.dart';
import 'screens/home/emergency_contacts_screen.dart';
import 'screens/home/change_password_screen.dart';
import 'screens/home/privacy_security_screen.dart';
import 'screens/home/logout_confirmation_screen.dart';

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
  bool _showEmergencyReport = false;
  bool _showEmergencyTracking = false;
  bool _showReportDetails = false;
  bool _showChangePhoneNumber = false;
  bool _showEnterNewPhoneNumber = false;
  bool _showVerifyNewPhoneOtp = false;
  bool _showPhoneNumberUpdated = false;
  bool _showBarangayInformation = false;
  bool _showEmergencyContacts = false;
  bool _showChangePassword = false;
  bool _showPasswordUpdatedFromSettings = false;
  bool _showPrivacySecurity = false;
  bool _showLogoutConfirmation = false;
  bool _returnToSettingsTab = false;
  String _newPhoneNumberForOtp = '';

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
      _showEmergencyReport = false;
      _showEmergencyTracking = false;
      _showReportDetails = false;
      _showChangePhoneNumber = false;
      _showEnterNewPhoneNumber = false;
      _showVerifyNewPhoneOtp = false;
      _showPhoneNumberUpdated = false;
      _showBarangayInformation = false;
      _showEmergencyContacts = false;
      _showChangePassword = false;
      _showPasswordUpdatedFromSettings = false;
      _showPrivacySecurity = false;
      _showLogoutConfirmation = false;
      _returnToSettingsTab = false;
      _newPhoneNumberForOtp = '';
      _verificationStep = null;
    });
  }

  void _handleSkip() {
    print('Skip pressed');
  }

  /// Returns true if login succeeded, false if credentials are invalid.
  /// Replace with real API call (e.g. POST /api/auth/login) and return based on response.
  Future<bool> _handleLogin(String phone, String password) async {
    final trimmedPhone = phone.trim();
    if (trimmedPhone.isEmpty || password.isEmpty) {
      return false;
    }
    // Demo validation: replace with real API call.
    // For demo, accept e.g. phone 09171234567 and password "password123"
    final normalizedPhone = trimmedPhone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    final isDemoValid = (normalizedPhone == '09171234567' || normalizedPhone == '639171234567') &&
        password == 'password123';
    if (!isDemoValid) {
      return false;
    }
    print('Login success: $trimmedPhone');
    setState(() {
      _showResidencyCheck = true;
      _isInsideDagupan = true; // Replace with real location/API check
    });
    return true;
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
      if (_showEmergencyReport) {
        return EmergencyReportScreen(
          onBack: () => setState(() => _showEmergencyReport = false),
          onSubmit: () {
            // TODO: submit report to API
            setState(() {
              _showEmergencyReport = false;
              _showEmergencyTracking = true;
            });
          },
        );
      }
      if (_showEmergencyTracking) {
        return EmergencyTrackingScreen(
          onBack: () => setState(() => _showEmergencyTracking = false),
        );
      }
      if (_showReportDetails) {
        return ReportDetailsScreen(
          onBack: () => setState(() => _showReportDetails = false),
        );
      }
      if (_showChangePhoneNumber) {
        return ChangePhoneNumberScreen(
          onBack: () => setState(() => _showChangePhoneNumber = false),
          onChangePhoneNumber: () => setState(() {
            _showChangePhoneNumber = false;
            _showEnterNewPhoneNumber = true;
          }),
        );
      }
      if (_showEnterNewPhoneNumber) {
        return EnterNewPhoneNumberScreen(
          onBack: () => setState(() {
            _showEnterNewPhoneNumber = false;
            _showChangePhoneNumber = true;
          }),
          onSendOtp: (newNumber) {
            setState(() {
              _newPhoneNumberForOtp = newNumber;
              _showEnterNewPhoneNumber = false;
              _showVerifyNewPhoneOtp = true;
            });
          },
        );
      }
      if (_showVerifyNewPhoneOtp) {
        return VerifyNewPhoneOtpScreen(
          phoneNumber: _newPhoneNumberForOtp,
          onBack: () => setState(() {
            _showVerifyNewPhoneOtp = false;
            _showEnterNewPhoneNumber = true;
          }),
          onVerifySuccess: () {
            setState(() {
              _showVerifyNewPhoneOtp = false;
              _showPhoneNumberUpdated = true;
            });
          },
        );
      }
      if (_showPhoneNumberUpdated) {
        return PhoneNumberUpdatedScreen(
          onDone: () => setState(() => _showPhoneNumberUpdated = false),
        );
      }
      if (_showBarangayInformation) {
        return BarangayInformationScreen(
          onBack: () => setState(() => _showBarangayInformation = false),
        );
      }
      if (_showEmergencyContacts) {
        return EmergencyContactsScreen(
          onBack: () => setState(() {
            _showEmergencyContacts = false;
            _returnToSettingsTab = true;
          }),
        );
      }
      if (_showPasswordUpdatedFromSettings) {
        return PasswordUpdatedScreen(
          onBackToLogin: _backToLogin,
        );
      }
      if (_showChangePassword) {
        return ChangePasswordScreen(
          onBack: () => setState(() {
            _showChangePassword = false;
            _returnToSettingsTab = true;
          }),
          onUpdatePassword: () => setState(() {
            _showChangePassword = false;
            _showPasswordUpdatedFromSettings = true;
          }),
        );
      }
      if (_showPrivacySecurity) {
        return PrivacySecurityScreen(
          onBack: () => setState(() {
            _showPrivacySecurity = false;
            _returnToSettingsTab = true;
          }),
        );
      }
      if (_showLogoutConfirmation) {
        return LogoutConfirmationScreen(
          onBack: () => setState(() {
            _showLogoutConfirmation = false;
            _returnToSettingsTab = true;
          }),
          onCancel: () => setState(() {
            _showLogoutConfirmation = false;
            _returnToSettingsTab = true;
          }),
          onConfirm: _backToLogin,
        );
      }
      return HomePlaceholderScreen(
        initialTabIndex: _returnToSettingsTab ? 3 : null,
        onInitialTabApplied: _returnToSettingsTab ? () => setState(() => _returnToSettingsTab = false) : null,
        onLogout: () => setState(() => _showLogoutConfirmation = true),
        onSosPressed: () => setState(() => _showEmergencyReport = true),
        onReportTap: () => setState(() => _showReportDetails = true),
        onPhoneNumberTap: () => setState(() => _showChangePhoneNumber = true),
        onBarangayTap: () => setState(() => _showBarangayInformation = true),
        onEmergencyContactsTap: () => setState(() => _showEmergencyContacts = true),
        onChangePasswordTap: () => setState(() => _showChangePassword = true),
        onPrivacySecurityTap: () => setState(() => _showPrivacySecurity = true),
      );
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
