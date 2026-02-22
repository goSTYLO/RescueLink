import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_state.dart';

// Dagupan City Barangays
const List<String> dagupanBarangays = [
  'Select your barangay',
  'Bacayao Norte',
  'Bacayao Sur',
  'Barangay I',
  'Barangay II',
  'Barangay III',
  'Barangay IV',
  'Bolosan',
  'Bonuan Binloc',
  'Bonuan Boquig',
  'Bonuan Gueset',
  'Calmay',
  'Carael',
  'Caranglaan',
  'Herrero',
  'Lasip Chico',
  'Lasip Grande',
  'Lomboy',
  'Lucao',
  'Malued',
  'Mamalingling',
  'Mangin',
  'Mayombo',
  'Pantal',
  'Poblacion Oeste',
  'Pogo Chico',
  'Pogo Grande',
  'Pugaro Suit',
  'Salapingao',
  'Salisay',
  'Tambac',
  'Tapuac',
  'Tebeng',
];

class SignUpScreen extends StatefulWidget {
  final VoidCallback? onLoginTap;
  final void Function(String firstName, String lastName, String phone, String address, String password)? onRequestLocationVerification;

  const SignUpScreen({
    super.key,
    this.onLoginTap,
    this.onRequestLocationVerification,
  });

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String _selectedBarangay = 'Select your barangay';
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  final bool _isLoading = false;
  String _passwordStrength = 'weak'; // weak, medium, strong

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  // Calculate password strength
  void _updatePasswordStrength(String password) {
    setState(() {
      if (password.isEmpty) {
        _passwordStrength = 'weak';
      } else if (password.length < 8 || !RegExp(r'[0-9]').hasMatch(password)) {
        _passwordStrength = 'weak';
      } else if (password.length >= 8 &&
          RegExp(r'[0-9]').hasMatch(password) &&
          RegExp(r'[a-z]').hasMatch(password) &&
          RegExp(r'[A-Z]').hasMatch(password)) {
        _passwordStrength = 'strong';
      } else {
        _passwordStrength = 'medium';
      }
    });
  }

  // Validate password requirements
  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Password must contain at least one number';
    }
    return null;
  }

  // Validate phone number (Philippine format)
  String? _validatePhone(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    // Remove all non-digit characters
    final digitsOnly = value.replaceAll(RegExp(r'[^\d]'), '');
    
    // Philippine phone number formats:
    // 10 digits: 9XXXXXXXXX (without 0 prefix)
    // 11 digits: 09XXXXXXXXX (with 0 prefix)
    // 12 digits: 639XXXXXXXXX (with +63 country code, no +)
    if (digitsOnly.length == 10 && digitsOnly.startsWith('9')) {
      return null; // Valid: 9XXXXXXXXX
    }
    if (digitsOnly.length == 11 && digitsOnly.startsWith('09')) {
      return null; // Valid: 09XXXXXXXXX
    }
    if (digitsOnly.length == 12 && digitsOnly.startsWith('639')) {
      return null; // Valid: 639XXXXXXXXX
    }
    
    return 'Please enter a valid Philippine phone number (e.g., 09XX-XXXX-XXXX)';
  }

  // Validate name
  String? _validateName(String? value) {
    if (value == null || value.isEmpty) {
      return 'This field is required';
    }
    if (value.length < 2) {
      return 'Name must be at least 2 characters';
    }
    return null;
  }

  void _handleSignUp(BuildContext context) {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedBarangay == 'Select your barangay') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select your barangay'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    widget.onRequestLocationVerification?.call(
      _firstNameController.text.trim(),
      _lastNameController.text.trim(),
      _phoneController.text.trim(),
      _selectedBarangay,
      _passwordController.text,
    );
  }

Widget _buildLogo() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Logo PNG - Larger size
        Image.asset(
          'assets/logo/logo.png',
          width: 80,
          height: 80,
          fit: BoxFit.contain,
        ),
      ],
    );
  }

  Widget _buildIllustration() {
    return SizedBox(
      height: 200,
      child: Image.asset(
        'assets/images/createaccount_illustration.png',
        height: 200,
        fit: BoxFit.contain,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is RegisterError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: const Color(0xFFEF4444),
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
                // Title and Subtitle
                const Text(
                  'Create Account',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Join RescueLink Dagupan City',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 32),
                // Form Section
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // First Name
                      const Text(
                        'First Name',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF374151),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _firstNameController,
                        decoration: InputDecoration(
                          hintText: 'Enter your first name',
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
                        validator: _validateName,
                      ),
                      const SizedBox(height: 20),

                      // Last Name
                      const Text(
                        'Last Name',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF374151),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _lastNameController,
                        decoration: InputDecoration(
                          hintText: 'Enter your last name',
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
                        validator: _validateName,
                      ),
                      const SizedBox(height: 20),

                      // Phone Number
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
                        validator: _validatePhone,
                      ),
                      const SizedBox(height: 20),

                      // Barangay Dropdown
                      const Row(
                        children: [
                          Icon(
                            Icons.location_on,
                            size: 18,
                            color: Color(0xFF374151),
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Barangay (Dagupan City)',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF374151),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: const Color(0xFFE5E7EB),
                          ),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        child: DropdownButtonFormField<String>(
                          initialValue: _selectedBarangay,
                          decoration: const InputDecoration(
                            hintText: 'Select your barangay',
                            prefixIcon: Icon(
                              Icons.location_on,
                              color: Color(0xFF9CA3AF),
                            ),
                            suffixIcon: Icon(
                              Icons.arrow_drop_down,
                              color: Color(0xFF9CA3AF),
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                          ),
                          items: dagupanBarangays.map((barangay) {
                            return DropdownMenuItem<String>(
                              value: barangay,
                              child: Text(barangay),
                            );
                          }).toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() {
                                _selectedBarangay = value;
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Password
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
                        onChanged: (value) {
                          _updatePasswordStrength(value);
                        },
                        decoration: InputDecoration(
                          hintText: 'Minimum 8 characters',
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
                        validator: _validatePassword,
                      ),
                      const SizedBox(height: 12),
                      // Password Strength Indicator
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: _passwordStrength == 'weak'
                                    ? 0.33
                                    : _passwordStrength == 'medium'
                                        ? 0.66
                                        : 1.0,
                                minHeight: 6,
                                backgroundColor: const Color(0xFFE5E7EB),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  _passwordStrength == 'weak'
                                      ? const Color(0xFFEF4444)
                                      : _passwordStrength == 'medium'
                                          ? const Color(0xFFFB923C)
                                          : const Color(0xFF22C55E),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            _passwordStrength == 'weak'
                                ? 'Weak'
                                : _passwordStrength == 'medium'
                                    ? 'Medium'
                                    : 'Strong',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _passwordStrength == 'weak'
                                  ? const Color(0xFFEF4444)
                                  : _passwordStrength == 'medium'
                                      ? const Color(0xFFFB923C)
                                      : const Color(0xFF22C55E),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Confirm Password
                      const Text(
                        'Confirm Password',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF374151),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: _obscureConfirmPassword,
                        decoration: InputDecoration(
                          hintText: 'Re-enter password',
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureConfirmPassword
                                  ? Icons.visibility_off
                                  : Icons.visibility,
                              color: const Color(0xFF9CA3AF),
                            ),
                            onPressed: () {
                              setState(() {
                                _obscureConfirmPassword = !_obscureConfirmPassword;
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
                            return 'Please confirm your password';
                          }
                          if (value != _passwordController.text) {
                            return 'Passwords do not match';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 32),

                      // Create Account Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: isLoading ? null : () => _handleSignUp(context),
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
                                  'Create Account',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Login Link
                      Center(
                        child: GestureDetector(
                          onTap: widget.onLoginTap,
                          child: RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                color: Color(0xFF6B7280),
                                fontSize: 14,
                              ),
                              children: [
                                TextSpan(text: 'Already have an account? '),
                                TextSpan(
                                  text: 'Log in',
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

