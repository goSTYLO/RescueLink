import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';

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

  void _toggleView() {
    setState(() {
      _showSignUp = !_showSignUp;
    });
  }

  Future<void> _handleLogin(String phone, String password) async {
    // TODO: Implement login functionality
    // This is a placeholder - you can integrate with your BLoC or API service
    print('Login: $phone, $password');
    
    // Example: Navigate to dashboard after successful login
    // Navigator.pushReplacement(
    //   context,
    //   MaterialPageRoute(builder: (context) => DashboardScreen()),
    // );
  }

  Future<void> _handleSignUp(
    String firstName,
    String lastName,
    String phone,
    String barangay,
    String password,
  ) async {
    // TODO: Implement sign up functionality
    // This is a placeholder - you can integrate with your BLoC or API service
    print('SignUp: $firstName $lastName, $phone, $barangay, $password');
    
    // Example: Navigate to phone verification or dashboard
    // Navigator.pushReplacement(
    //   context,
    //   MaterialPageRoute(builder: (context) => PhoneVerificationScreen()),
    // );
  }

  @override
  Widget build(BuildContext context) {
    if (_showSignUp) {
      return SignUpScreen(
        onLoginTap: _toggleView,
        onSignUp: _handleSignUp,
      );
    } else {
      return LoginScreen(
        onSignUpTap: _toggleView,
        onLogin: _handleLogin,
      );
    }
  }
}
