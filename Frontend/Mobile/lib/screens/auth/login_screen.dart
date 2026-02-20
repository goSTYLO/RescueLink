import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_event.dart';
import '../../bloc/auth/auth_state.dart';
import '../../utils/validators.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback? onSignUpTap;
  final VoidCallback? onForgotPasswordTap;
  /// Called when login succeeds (parent navigates to dashboard).
  final VoidCallback? onLoginSuccess;

  const LoginScreen({
    super.key,
    this.onSignUpTap,
    this.onForgotPasswordTap,
    this.onLoginSuccess,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  final bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin(BuildContext context) {
    if (!_formKey.currentState!.validate()) return;
    context.read<AuthBloc>().add(LoginRequested(
          phone: _phoneController.text.trim(),
          password: _passwordController.text,
        ));
  }

  Widget _buildLogo() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Logo PNG
        Image.asset(
          'assets/logo/logo.png',
          width: 80,
          height: 80,
          fit: BoxFit.contain,
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Color(0xFFEF4444))),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Emergency Response & Safety',
              style: TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildIllustration() {
    return SizedBox(
      height: 200,
      child: Image.asset(
        'assets/images/login_illustrations.png',
        height: 200,
        fit: BoxFit.contain,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listenWhen: (previous, current) {
        // Only react when we transition to LoginError (avoid duplicate snackbars)
        return current is LoginError && previous is! LoginError;
      },
      listener: (context, state) {
        if (state is LoginSuccess) {
          widget.onLoginSuccess?.call();
        }
        if (state is LoginError) {
          final message = state.message.trim().isEmpty
              ? 'Incorrect password or number.'
              : state.message;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading || _isLoading;
        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                const SizedBox(height: 20),
                // Logo Section
                _buildLogo(),
                const SizedBox(height: 20),
                // Illustration
                _buildIllustration(),
                const SizedBox(height: 20),
                // Welcome Message
                const Text(
                  'Welcome Back',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Log in to RescueLink',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 40),
                // Form Section
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Phone Number Input
                      const Row(
                        children: [
                          Icon(
                            Icons.phone,
                            size: 18,
                            color: Color(0xFF374151),
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Phone Number',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF374151),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          hintText: 'Enter your number',
                          prefixIcon: const Icon(
                            Icons.phone,
                            color: Color(0xFF9CA3AF),
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFEF4444),
                            ),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                        ),
                        validator: Validators.validatePhoneNumber,
                      ),
                      const SizedBox(height: 20),

                      // Password Input
                      const Row(
                        children: [
                          Icon(
                            Icons.lock,
                            size: 18,
                            color: Color(0xFF374151),
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Password',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF374151),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        decoration: InputDecoration(
                          hintText: 'Enter your password',
                          prefixIcon: const Icon(
                            Icons.lock,
                            color: Color(0xFF9CA3AF),
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off
                                  : Icons.visibility,
                              color: const Color(0xFF9CA3AF),
                            ),
                            onPressed: () {
                              setState(() {
                                _obscurePassword = !_obscurePassword;
                              });
                            },
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFEF4444),
                            ),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Password is required';
                          }
                          if (value.length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 8),

                      // Forgot Password Link
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: widget.onForgotPasswordTap,
                          child: const Text(
                            'Forgot Password?',
                            style: TextStyle(
                              color: Color(0xFFEF4444),
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Log In Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: isLoading ? null : () => _handleLogin(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEF4444),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 2,
                          ),
                          child: isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : const Text(
                                  'Log In',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // OR Separator
                      Row(
                        children: [
                          Expanded(
                            child: Divider(
                              color: Colors.grey[300],
                              thickness: 1,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              'OR',
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 14,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Divider(
                              color: Colors.grey[300],
                              thickness: 1,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Sign Up Link
                      Center(
                        child: GestureDetector(
                          onTap: widget.onSignUpTap,
                          child: RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                color: Color(0xFF6B7280),
                                fontSize: 14,
                              ),
                              children: [
                                TextSpan(text: "Don't have an account? "),
                                TextSpan(
                                  text: 'Sign up',
                                  style: TextStyle(
                                    color: Color(0xFFEF4444),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // Footer Badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFFBFDBFE),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.shield,
                        color: Color(0xFF2563EB),
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Secure Login',
                        style: TextStyle(
                          color: Color(0xFF1E40AF),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Container(
                        width: 4,
                        height: 4,
                        margin: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: const BoxDecoration(
                          color: Color(0xFF1E40AF),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const Text(
                        'Dagupan City Verified',
                        style: TextStyle(
                          color: Color(0xFF1E40AF),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

