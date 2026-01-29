import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
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
import 'services/auth_service.dart';

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

  // Signup flow with location verification first
  bool _showSignupLocationCheck = false;
  bool _showSignupPhoneVerification = false;
  String? _signupPhoneVerificationStep; // null -> request_otp -> enter_otp
  String _signupFirstName = '';
  String _signupLastName = '';
  String _signupPhone = '';
  String _signupBarangay = '';
  String _signupPassword = '';
  double _signupLatitude = 0.0;
  double _signupLongitude = 0.0;
  
  final AuthService _authService = AuthService();
  bool _authServiceInitialized = false;

  @override
  void initState() {
    super.initState();
    // Initialize auth service asynchronously
    _authService.init().then((_) {
      if (mounted) {
        setState(() => _authServiceInitialized = true);
      }
    }).catchError((e) {
      print('Error initializing auth service: $e');
    });
  }

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
      _showSignupLocationCheck = false;
      _showSignupPhoneVerification = false;
      _signupPhoneVerificationStep = null;
      _signupFirstName = '';
      _signupLastName = '';
      _signupPhone = '';
      _signupBarangay = '';
      _signupPassword = '';
      _signupLatitude = 0.0;
      _signupLongitude = 0.0;
    });
  }

  void _handleSkip() {
    print('Skip pressed');
  }

  Future<void> _handleLogin(String phone, String password) async {
    print('🔐 Login attempt: $phone');
    
    try {
      final result = await _authService.login(
        phone: phone,
        password: password,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        print('✅ Login successful!');
        // Navigate directly to home screen after successful login
        setState(() {
          _showDashboard = true;
        });
      } else {
        // Show error message
        String errorMessage = 'Login failed';
        if (result['error'] != null) {
          final error = result['error'].toString();
          if (error.contains('401') || error.contains('Invalid credentials')) {
            errorMessage = 'Invalid phone number or password';
          } else if (error.contains('network') || error.contains('SocketException')) {
            errorMessage = 'Network error. Please check your connection';
          } else {
            errorMessage = result['error'].toString();
          }
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    } catch (e) {
      print('❌ Login exception: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('An error occurred during login. Please try again.'),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    }
  }

  Future<void> _handleSignUp(
    String firstName,
    String lastName,
    String phone,
    String barangay,
    String password,
  ) async {
    print('SignUp: $firstName $lastName, $phone, $barangay, $password');
    // Store signup data and show location verification first
    setState(() {
      _signupFirstName = firstName;
      _signupLastName = lastName;
      _signupPhone = phone;
      _signupBarangay = barangay;
      _signupPassword = password;
      _showSignupLocationCheck = true;
    });
  }

  Future<void> _createAccountAfterVerification() async {
    print('Creating account: $_signupFirstName $_signupLastName, $_signupPhone, $_signupBarangay');
    
    try {
      // Call API to create account with stored signup data
      final result = await _authService.register(
        firstName: _signupFirstName,
        lastName: _signupLastName,
        phone: _signupPhone,
        barangay: _signupBarangay,
        password: _signupPassword,
        latitude: _signupLatitude,
        longitude: _signupLongitude,
      );
      
      if (result['success'] == true) {
        print('Account created successfully!');
        // After account creation, show phone verification
        setState(() {
          _showSignupLocationCheck = false;
          _showSignupPhoneVerification = true;
        });
      } else {
        // Show error message
        print('Account creation failed: ${result['message'] ?? result['error']}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Account creation failed: ${result['message'] ?? result['error']}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      print('Error creating account: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error creating account: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _handleSignupPhoneVerified() {
    // After phone is verified, show Account Created screen
    setState(() {
      _showSignupPhoneVerification = false;
      _showAccountCreated = true;
    });
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

    // Signup location verification (before account creation)
    if (_showSignupLocationCheck) {
      return VerifyDagupanResidencyScreen(
        onVerificationComplete: (lat, lng) {
          // Store coordinates and create account
          setState(() {
            _signupLatitude = lat;
            _signupLongitude = lng;
          });
          _createAccountAfterVerification();
        },
        onRefreshGps: () {
          setState(() {});
        },
        selectedBarangay: _signupBarangay,
        onLocationVerificationFailed: () {
          // Show error or go back to signup
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('You must be in Dagupan City to create an account'),
              backgroundColor: Colors.red,
            ),
          );
          setState(() => _showSignupLocationCheck = false);
        },
      );
    }

    // Phone verification after account creation
    if (_showSignupPhoneVerification) {
      // Step 1: Request OTP
      if (_signupPhoneVerificationStep == null) {
        return VerifyNumberScreen(
          phoneNumber: _signupPhone,
          isRequestingOTP: true,
          onBack: () {
            setState(() => _showSignupPhoneVerification = false);
          },
          onOTPSent: () {
            print('✅ OTP sent! Moving to OTP verification screen');
            print('🔄 Current step: $_signupPhoneVerificationStep');
            setState(() {
              _signupPhoneVerificationStep = 'enter_otp';
              print('🔄 Updated step to: $_signupPhoneVerificationStep');
            });
            print('✅ setState completed');
          },
        );
      }

      // Step 2: Enter OTP
      if (_signupPhoneVerificationStep == 'enter_otp') {
        return VerificationOtpScreen(
          phoneNumber: _signupPhone,
          onBack: () {
            setState(() => _signupPhoneVerificationStep = null);
          },
          onVerifyAndContinue: (result) async {
            print('🔐 Received verification result: $result');
            
            if (!mounted) return;

            if (result['success']) {
              print('✅ OTP verification successful! Proceeding to account created screen.');
              _handleSignupPhoneVerified();
            } else {
              print('❌ OTP verification failed: ${result['error']}');
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('❌ ${result['error'] ?? 'Verification failed'}'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          },
        );
      }
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
            onVerifyAndContinue: (result) {
              // OTP verification successful, show dashboard
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
          onVerificationComplete: (lat, lng) {
            // For login flow, we don't need to store coordinates
            setState(() => _verificationStep = 'human');
          },
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
