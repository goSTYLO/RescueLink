import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/request_otp_screen.dart';
import 'screens/otp_verification_screen.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  final authService = AuthService();
  await authService.init();
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
  bool _showRequestOTP = false;
  bool _showOTPVerification = false;
  String? _phoneNumberForOTP;

  @override
  void initState() {
    super.initState();
  }

  void _toggleView() {
    setState(() {
      _showSignUp = !_showSignUp;
      _showRequestOTP = false;
      _showOTPVerification = false;
    });
  }

  void _goToRequestOTP(String phoneNumber) {
    setState(() {
      _showSignUp = false;
      _showRequestOTP = true;
      _showOTPVerification = false;
      _phoneNumberForOTP = phoneNumber;
    });
  }

  void _goToOTPVerification(String phoneNumber) {
    setState(() {
      _showSignUp = false;
      _showRequestOTP = false;
      _showOTPVerification = true;
      _phoneNumberForOTP = phoneNumber;
    });
  }

  void _goBackToSignUp() {
    setState(() {
      _showSignUp = true;
      _showRequestOTP = false;
      _showOTPVerification = false;
    });
  }

  void _goBackToRequestOTP() {
    setState(() {
      _showSignUp = false;
      _showRequestOTP = true;
      _showOTPVerification = false;
    });
  }

  void _handleVerificationSuccess() {
    // User has successfully completed the entire verification process
    // Navigate to home screen or dashboard
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Welcome to RescueLink!'),
        backgroundColor: Colors.green,
        duration: Duration(seconds: 2),
      ),
    );

    // Reset state and return to login screen
    setState(() {
      _showSignUp = false;
      _showRequestOTP = false;
      _showOTPVerification = false;
    });

    // TODO: Navigate to home/dashboard screen
    // Navigator.pushReplacement(
    //   context,
    //   MaterialPageRoute(builder: (context) => HomeScreen()),
    // );
  }

  Future<void> _handleLogin(String phone, String password) async {
    // TODO: Implement login functionality
    print('Login: $phone, $password');
  }

  @override
  Widget build(BuildContext context) {
    if (_showOTPVerification && _phoneNumberForOTP != null) {
      return OTPVerificationScreen(
        phoneNumber: _phoneNumberForOTP!,
        onBackTap: _goBackToRequestOTP,
        onVerificationSuccess: _handleVerificationSuccess,
      );
    } else if (_showRequestOTP && _phoneNumberForOTP != null) {
      return RequestOTPScreen(
        phoneNumber: _phoneNumberForOTP!,
        onBackTap: _goBackToSignUp,
        onOTPSent: _goToOTPVerification,
      );
    } else if (_showSignUp) {
      return SignUpScreen(
        onLoginTap: _toggleView,
        onSignupSuccess: _goToRequestOTP,
      );
    } else {
      return LoginScreen(
        onSignUpTap: _toggleView,
        onLogin: _handleLogin,
      );
    }
  }
}
