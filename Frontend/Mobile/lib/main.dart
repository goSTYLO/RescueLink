import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'firebase_options.dart';
import 'bloc/auth/auth_bloc.dart';
import 'bloc/auth/auth_event.dart';
import 'bloc/auth/auth_state.dart';
import 'services/auth_service.dart';
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
import 'services/incident_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await AuthService().init();
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
      home: BlocProvider<AuthBloc>(
        create: (_) => AuthBloc(AuthService()),
        child: const AuthNavigator(),
      ),
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
  String? _forgotPasswordIdToken;

  // Sign-up flow: form first, then Verify Dagupan on Create Account
  Map<String, String>? _pendingSignUpData;
  bool _showVerifyDagupanForSignup = false;

  // After signup (BLoC RegisterSuccess): show Account Created
  bool _showAccountCreated = false;
  String _registeredPhone = '';
  String _registeredBarangay = 'Barangay Poblacion Oeste';

  // After Account Created -> Continue to verify phone: Request OTP -> Enter OTP
  bool _showVerificationRequestOtp = false;
  bool _showVerificationOtp = false;

  // After OTP verified (PhoneVerified): show Login
  bool _showLoginAfterPhoneVerified = false;

  // After login (BLoC LoginSuccess): dashboard
  bool _showResidencyCheck = false;
  bool _isInsideDagupan = true;
  bool _showDashboard = false;
  bool _showEmergencyReport = false;
  bool _showEmergencyTracking = false;
  bool _showReportDetails = false;
  int? _selectedReportId;
  bool _emergencyNoAiInProgress = false;
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

  // Login path verification flow (after login): Request OTP -> Enter OTP -> dashboard
  String? _verificationStep;
  static const String _verificationPhone = '+63 917 123 4567';

  void _toggleView() {
    setState(() {
      _showSignUp = !_showSignUp;
      _forgotFlowScreen = null;
      _pendingSignUpData = null;
      _showVerifyDagupanForSignup = false;
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
      _pendingSignUpData = null;
      _showVerifyDagupanForSignup = false;
      _showAccountCreated = false;
      _registeredPhone = '';
      _registeredBarangay = 'Barangay Poblacion Oeste';
      _showVerificationRequestOtp = false;
      _showVerificationOtp = false;
      _showLoginAfterPhoneVerified = false;
      _showResidencyCheck = false;
      _showDashboard = false;
      _showEmergencyReport = false;
      _showEmergencyTracking = false;
      _showReportDetails = false;
      _selectedReportId = null;
      _emergencyNoAiInProgress = false;
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
      _forgotPasswordIdToken = null;
    });
  }

  void _onResidencyRetry() {
    // Re-check location; for demo you can toggle to see the other screen
    setState(() {
      _isInsideDagupan = !_isInsideDagupan;
    });
  }

  Future<void> _onEmergencyNoAiPressed(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Send emergency report?'),
        content: const Text(
          'Your location will be sent immediately. Responders will be notified. Continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _emergencyNoAiInProgress = true);

    try {
      await IncidentService().reportEmergency();
      if (!mounted) return;
      setState(() {
        _emergencyNoAiInProgress = false;
        _showEmergencyTracking = true;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report submitted.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _emergencyNoAiInProgress = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e is IncidentServiceException ? e.message : e.toString()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen to AuthBloc for sign-up and login flow
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is RegisterSuccess) {
          setState(() {
            _registeredPhone = state.phone;
            _showSignUp = false;
            _showAccountCreated = true; // Account Created first; OTP when they tap "Continue to verify phone"
          });
          context.read<AuthBloc>().add(const AuthReset());
        }
        if (state is OtpSent) {
          setState(() {
            _showVerificationRequestOtp = false;
            _showVerificationOtp = true;
          });
          context.read<AuthBloc>().add(const AuthReset());
        }
        if (state is LoginSuccess) {
          setState(() {
            _showDashboard = true;
            _showLoginAfterPhoneVerified = false;
            _showResidencyCheck = false;
          });
          context.read<AuthBloc>().add(const AuthReset());
        }
      },
      child: _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    // Dashboard (after login success)
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
          reportId: _selectedReportId,
          onBack: () => setState(() {
            _showReportDetails = false;
            _selectedReportId = null;
          }),
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
      return Stack(
        children: [
          HomePlaceholderScreen(
            initialTabIndex: _returnToSettingsTab ? 3 : null,
            onInitialTabApplied: _returnToSettingsTab ? () => setState(() => _returnToSettingsTab = false) : null,
            onLogout: () => setState(() => _showLogoutConfirmation = true),
            onSosPressed: () => setState(() => _showEmergencyReport = true),
            onEmergencyNoAiPressed: () => _onEmergencyNoAiPressed(context),
            onReportTap: (reportId) => setState(() {
          _showReportDetails = true;
          _selectedReportId = reportId;
        }),
            onPhoneNumberTap: () => setState(() => _showChangePhoneNumber = true),
            onBarangayTap: () => setState(() => _showBarangayInformation = true),
            onEmergencyContactsTap: () => setState(() => _showEmergencyContacts = true),
            onChangePasswordTap: () => setState(() => _showChangePassword = true),
            onPrivacySecurityTap: () => setState(() => _showPrivacySecurity = true),
          ),
          if (_emergencyNoAiInProgress)
            Container(
              color: Colors.black26,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      );
    }

    // Sign-up flow: Verify Dagupan (only after Create Account from form)
    if (_showSignUp && _showVerifyDagupanForSignup && _pendingSignUpData != null) {
      return VerifyDagupanResidencyScreen(
        onVerificationComplete: (double lat, double lng) {
          final data = _pendingSignUpData!;
          _registeredBarangay = data['address'] ?? 'Barangay Poblacion Oeste';
          context.read<AuthBloc>().add(RegisterRequested(
                firstName: data['firstName']!,
                lastName: data['lastName']!,
                phone: data['phone']!,
                address: data['address']!,
                password: data['password']!,
                latitude: lat,
                longitude: lng,
              ));
          setState(() {
            _showVerifyDagupanForSignup = false;
            _pendingSignUpData = null;
          });
        },
        onRefreshGps: () => setState(() {}),
        onLocationVerificationFailed: () {
          setState(() {
            _registeredBarangay = _pendingSignUpData?['address'] ?? 'Barangay Poblacion Oeste';
            _showVerifyDagupanForSignup = false;
            _pendingSignUpData = null;
          });
        },
        selectedBarangay: _pendingSignUpData!['address'] ?? 'Barangay Poblacion Oeste',
      );
    }

    // Request OTP screen (sign-up flow; after Account Created -> "Continue to verify phone")
    if (_showVerificationRequestOtp) {
      return VerificationScreen(
        phone: _registeredPhone,
        onBack: () => setState(() {
          _showVerificationRequestOtp = false;
          _showAccountCreated = true; // back to Account Created
        }),
        selectedBarangay: _registeredBarangay,
        cityRegion: 'Dagupan City, Pangasinan',
      );
    }

    // Enter OTP screen (sign-up flow; after OTP verified go to Login, do not store token)
    if (_showVerificationOtp) {
      return VerificationOtpScreen(
        phoneNumber: _registeredPhone,
        storeTokenAfterVerify: false,
        onPhoneVerified: () {
          setState(() {
            _showVerificationOtp = false;
            _showSignUp = false;
            _showAccountCreated = false;
            _showLoginAfterPhoneVerified = true; // go to Login after OTP success
          });
          context.read<AuthBloc>().add(const AuthReset());
        },
        onBack: () => setState(() {
          _showVerificationOtp = false;
          _showVerificationRequestOtp = true;
        }),
        selectedBarangay: _registeredBarangay,
        cityRegion: 'Dagupan City, Pangasinan',
      );
    }

    // Sign-up form (no location check here; Verify Dagupan is shown after Create Account)
    if (_showSignUp) {
      return SignUpScreen(
        onLoginTap: _toggleView,
        onRequestLocationVerification: (firstName, lastName, phone, address, password) {
          setState(() {
            _pendingSignUpData = {
              'firstName': firstName,
              'lastName': lastName,
              'phone': phone,
              'address': address,
              'password': password,
            };
            _showVerifyDagupanForSignup = true;
          });
        },
      );
    }

    // Account Created (optional; e.g. if user navigates from OTP back to login and re-enters)
    if (_showAccountCreated) {
      return AccountCreatedScreen(
        onBackToLogin: () {
          context.read<AuthBloc>().add(const AuthReset());
          _backToLogin();
        },
        onDone: () {
          context.read<AuthBloc>().add(const AuthReset());
          _backToLogin();
        },
        registeredPhone: _registeredPhone,
        onContinueToVerifyPhone: () {
          setState(() {
            _showAccountCreated = false;
            _showVerificationRequestOtp = true;
          });
        },
      );
    }

    // Login screen (after phone verified in sign-up flow, or direct login)
    if (_showLoginAfterPhoneVerified) {
      return LoginScreen(
        onSignUpTap: _toggleView,
        onForgotPasswordTap: _showForgotPassword,
        onLoginSuccess: () {
          setState(() {
            _showLoginAfterPhoneVerified = false;
            _showDashboard = true;
          });
        },
      );
    }

    // Residency check (after login - optional; currently go straight to dashboard)
    if (_showResidencyCheck) {
      if (_isInsideDagupan) {
        if (_verificationStep == 'human') {
          return VerificationScreen(
            phone: _verificationPhone,
            onRequestOtp: () => setState(() => _verificationStep = 'otp'),
            onBack: () => setState(() => _verificationStep = null),
            selectedBarangay: 'Barangay Poblacion Oeste',
            cityRegion: 'Dagupan City, Pangasinan',
          );
        }
        if (_verificationStep == 'otp') {
          return VerificationOtpScreen(
            phoneNumber: _verificationPhone,
            onVerifyAndContinue: (Map<String, dynamic> data) {
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
          onVerificationComplete: (double lat, double lng) => setState(() => _verificationStep = 'human'),
          onRefreshGps: () => setState(() {}),
          selectedBarangay: 'Barangay Poblacion Oeste',
        );
      } else {
        return OutsideServiceAreaScreen(
          onRetry: _onResidencyRetry,
          onGoBack: _backToLogin,
        );
      }
    }

    // Forgot password flow
    if (_forgotFlowScreen != null) {
      switch (_forgotFlowScreen!) {
        case 'forgot_password':
          return ForgotPasswordScreen(
            onBackToLogin: _backToLogin,
            onRequestCode: (phone) async {
              final r = await AuthService().initializePhoneVerification(phone);
              if (r['success'] != true) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(r['error'] as String? ?? 'Could not send code. Check the number and try again.'),
                      backgroundColor: const Color(0xFFEF4444),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
                return false;
              }
              if (context.mounted) {
                setState(() {
                  _forgotPhoneNumber = phone;
                  _forgotFlowScreen = 'verify_number';
                });
              }
              return true;
            },
          );
        case 'verify_number':
          return VerifyNumberScreen(
            phoneNumber: _forgotPhoneNumber,
            onBack: () => setState(() => _forgotFlowScreen = 'forgot_password'),
            onVerifyCode: (code) async {
              final r = await AuthService().verifyOtpAndGetIdToken(code);
              if (r['success'] != true) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(r['error'] as String? ?? 'Invalid code. Please try again.'),
                      backgroundColor: const Color(0xFFEF4444),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
                return;
              }
              if (context.mounted) {
                setState(() {
                  _forgotPasswordIdToken = r['idToken'] as String?;
                  _forgotFlowScreen = 'verified';
                });
              }
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
            idToken: _forgotPasswordIdToken,
            onBack: () => setState(() => _forgotFlowScreen = 'verified'),
            onResetPassword: (newPassword) {
              setState(() {
                _forgotPasswordIdToken = null;
                _forgotFlowScreen = 'password_updated';
              });
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

    // Default: Login screen
    return LoginScreen(
      onSignUpTap: _toggleView,
      onForgotPasswordTap: _showForgotPassword,
      onLoginSuccess: () {
        setState(() => _showDashboard = true);
      },
    );
  }
}
