import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/responsive.dart';
import '../../utils/validators.dart';
import '../../widgets/glass_card.dart';

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
  final void Function(String firstName, String lastName, String phone,
      String address, String password)? onRequestLocationVerification;

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
          backgroundColor: AppTheme.primaryRed,
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

  Widget _buildLogo(double width) {
    final logoSize = Responsive.logoSize(width);
    final titleSize = Responsive.brandTitleSize(width);
    final compact = Responsive.isCompact(width);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/icon.png',
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
        ),
        SizedBox(width: compact ? 8 : 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                style:
                    TextStyle(fontSize: titleSize, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(
                      text: 'Rescue',
                      style: TextStyle(
                          color:
                              isDark ? Colors.white : const Color(0xFF0F172A))),
                  const TextSpan(
                      text: 'Link',
                      style: TextStyle(color: AppTheme.primaryRed)),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'Your Safety Companion',
              style: TextStyle(
                fontSize: compact ? 10 : 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildIllustration(double width) {
    final compact = Responsive.isCompact(width);
    final imageHeight = compact ? 150.0 : 200.0;
    return SizedBox(
      height: imageHeight,
      child: Image.asset(
        'assets/images/createaccount_illustration.png',
        height: imageHeight,
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
              backgroundColor: AppTheme.primaryRed,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading || _isLoading;
        final screenWidth = MediaQuery.sizeOf(context).width;
        final horizontalPadding = Responsive.horizontalPadding(screenWidth);
        final compact = Responsive.isCompact(screenWidth);
        final headingSize = compact ? 24.0 : 28.0;
        final colorScheme = Theme.of(context).colorScheme;
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          body: SafeArea(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                child: Column(
                  children: [
                    const SizedBox(height: 28),
                    // Logo Section (centered with header space)
                    Center(child: _buildLogo(screenWidth)),
                    const SizedBox(height: 20),
                    // Illustration
                    _buildIllustration(screenWidth),
                    const SizedBox(height: 20),
                    // Title and Subtitle
                    Text(
                      'Create Account',
                      style: TextStyle(
                        fontSize: headingSize,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    // Form Section
                    GlassCard(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Error banner when account exists or other registration error
                            if (state is RegisterError) ...[
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                margin: const EdgeInsets.only(bottom: 16),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryRed,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  state.message,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w500,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ],
                            // First Name (icon + placeholder only)
                            TextFormField(
                              controller: _firstNameController,
                              decoration: InputDecoration(
                                prefixIcon: Icon(Icons.person_outline,
                                    size: 20,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6)),
                                hintText: 'Enter your first name',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                                filled: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                              ),
                              validator: _validateName,
                            ),
                            const SizedBox(height: 20),

                            // Last Name (icon + placeholder only)
                            TextFormField(
                              controller: _lastNameController,
                              decoration: InputDecoration(
                                prefixIcon: Icon(Icons.person_outline,
                                    size: 20,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6)),
                                hintText: 'Enter your last name',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                                filled: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                              ),
                              validator: _validateName,
                            ),
                            const SizedBox(height: 20),

                            // Phone Number (icon + placeholder only)
                            TextFormField(
                              controller: _phoneController,
                              keyboardType: TextInputType.phone,
                              inputFormatters: Validators.phoneInputFormatters,
                              maxLength: 11,
                              decoration: InputDecoration(
                                prefixIcon: Icon(Icons.phone,
                                    size: 20,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6)),
                                hintText: '09171234567',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                                filled: true,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                              ),
                              validator: Validators.validatePhoneNumber,
                            ),
                            const SizedBox(height: 20),

                            // Barangay Dropdown (icon in placeholder)
                            Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: colorScheme.outline
                                      .withValues(alpha: 0.5),
                                ),
                                borderRadius: BorderRadius.circular(12),
                                color: colorScheme.surface,
                              ),
                              child: DropdownButtonFormField<String>(
                                initialValue: _selectedBarangay,
                                isExpanded: true,
                                decoration: InputDecoration(
                                  prefixIcon: Icon(Icons.location_on,
                                      size: 20,
                                      color: colorScheme.onSurface
                                          .withValues(alpha: 0.6)),
                                  hintText: 'Select your barangay',
                                  suffixIcon: Icon(
                                    Icons.arrow_drop_down,
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 14,
                                  ),
                                ),
                                items: dagupanBarangays.map((barangay) {
                                  return DropdownMenuItem<String>(
                                    value: barangay,
                                    child: Text(
                                      barangay,
                                      overflow: TextOverflow.ellipsis,
                                      maxLines: 1,
                                    ),
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

                            // Password (icon + placeholder only)
                            TextFormField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              onChanged: (value) {
                                _updatePasswordStrength(value);
                              },
                              decoration: InputDecoration(
                                prefixIcon: Icon(Icons.lock,
                                    size: 20,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6)),
                                hintText: 'Minimum 8 characters',
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                                filled: true,
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
                                      backgroundColor: colorScheme.outline
                                          .withValues(alpha: 0.35),
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        _passwordStrength == 'weak'
                                            ? AppTheme.primaryRed
                                            : _passwordStrength == 'medium'
                                                ? AppTheme.warningAmber
                                                : AppTheme.successGreen,
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
                                        ? AppTheme.primaryRed
                                        : _passwordStrength == 'medium'
                                            ? AppTheme.warningAmber
                                            : AppTheme.successGreen,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),

                            // Confirm Password (icon + placeholder only)
                            TextFormField(
                              controller: _confirmPasswordController,
                              obscureText: _obscureConfirmPassword,
                              decoration: InputDecoration(
                                prefixIcon: Icon(Icons.lock_outline,
                                    size: 20,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6)),
                                hintText: 'Re-enter password',
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscureConfirmPassword
                                        ? Icons.visibility_off
                                        : Icons.visibility,
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscureConfirmPassword =
                                          !_obscureConfirmPassword;
                                    });
                                  },
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: colorScheme.outline
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: AppTheme.primaryRed,
                                  ),
                                ),
                                filled: true,
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
                                onPressed: isLoading
                                    ? null
                                    : () => _handleSignUp(context),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primaryRed,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 16),
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
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
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
                                  textAlign: TextAlign.center,
                                  text: TextSpan(
                                    style: TextStyle(
                                      color: colorScheme.onSurfaceVariant,
                                      fontSize: 14,
                                    ),
                                    children: const [
                                      TextSpan(
                                          text: 'Already have an account? '),
                                      TextSpan(
                                        text: 'Log in',
                                        style: TextStyle(
                                          color: AppTheme.primaryRed,
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
