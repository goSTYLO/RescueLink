import 'package:flutter/material.dart';
import '../../utils/responsive.dart';
import '../../services/auth_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gradient_header.dart';

class CreateNewPasswordScreen extends StatefulWidget {
  final String phoneNumber;
  final String? resetToken;
  final VoidCallback? onBack;
  final void Function(String newPassword)? onResetPassword;

  const CreateNewPasswordScreen({
    super.key,
    required this.phoneNumber,
    this.resetToken,
    this.onBack,
    this.onResetPassword,
  });

  @override
  State<CreateNewPasswordScreen> createState() => _CreateNewPasswordScreenState();
}

class _CreateNewPasswordScreenState extends State<CreateNewPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool get _passwordsMatch =>
      _passwordController.text.isNotEmpty &&
      _passwordController.text == _confirmController.text;

  String get _strength {
    final p = _passwordController.text;
    if (p.isEmpty) return '';
    int score = 0;
    if (p.length >= 8) score++;
    if (RegExp(r'[0-9]').hasMatch(p) && RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(p)) score++;
    if (RegExp(r'[A-Z]').hasMatch(p) && RegExp(r'[a-z]').hasMatch(p)) score++;
    if (p.length >= 12) score++;
    if (score <= 1) return 'Weak';
    if (score == 2) return 'Medium';
    return 'Strong';
  }

  Widget _buildLogo() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset('assets/logo/icon.png', width: Responsive.logoSize(MediaQuery.sizeOf(context).width), height: Responsive.logoSize(MediaQuery.sizeOf(context).width), fit: BoxFit.contain),
        const SizedBox(width: 0),
        Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(
                      text: 'Rescue',
                      style: TextStyle(
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Colors.white
                              : const Color(0xFF0F172A))),
                  const TextSpan(
                      text: 'Link',
                      style: TextStyle(color: Color(0xFFFF6B6B))),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  InputDecoration _passwordDecoration({
    required String hintText,
    required bool obscure,
    required VoidCallback onToggle,
    required ColorScheme colorScheme,
    required Color outline,
  }) {
    return InputDecoration(
      hintText: hintText,
      suffixIcon: IconButton(
        icon: Icon(
          obscure ? Icons.visibility_off : Icons.visibility,
          color: colorScheme.onSurface.withValues(alpha: 0.6),
        ),
        onPressed: onToggle,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2),
      ),
      filled: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  Future<void> _handleReset() async {
    if (_passwordController.text.length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password must be at least 8 characters')),
      );
      return;
    }
    if (_passwordController.text != _confirmController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match')),
      );
      return;
    }
    if (widget.resetToken == null || widget.resetToken!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Verification expired. Please start over.'),
          backgroundColor: Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _isLoading = true);
    final result = await AuthService().resetPassword(
      widget.resetToken!,
      _passwordController.text,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (result['success'] == true) {
      widget.onResetPassword?.call(_passwordController.text);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['error'] as String? ?? 'Could not reset password. Please try again.'),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final outline = colorScheme.outline.withValues(alpha: 0.5);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          GradientHeader(
            title: 'Create New Password',
            onBack: widget.onBack,
            transparentFade: true,
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    _buildLogo(),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 160,
                      child: Image.asset(
                        'assets/images/verifynumber_illustration.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Choose a strong password',
                      style: TextStyle(
                        fontSize: 14,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 24),
                    GlassCard(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: colorScheme.secondaryContainer,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: colorScheme.secondary.withValues(alpha: 0.35),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.lock_outline,
                                      color: colorScheme.onSecondaryContainer,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Password Requirements',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: colorScheme.onSecondaryContainer,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '• Minimum 8 characters',
                                  style: TextStyle(
                                    color: colorScheme.onSecondaryContainer,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  '• Include numbers and symbols',
                                  style: TextStyle(
                                    color: colorScheme.onSecondaryContainer,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  '• Mix of uppercase and lowercase letters',
                                  style: TextStyle(
                                    color: colorScheme.onSecondaryContainer,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'New Password',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: colorScheme.onSurface,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            onChanged: (_) => setState(() {}),
                            decoration: _passwordDecoration(
                              hintText: 'Enter new password',
                              obscure: _obscurePassword,
                              onToggle: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                              colorScheme: colorScheme,
                              outline: outline,
                            ),
                          ),
                          if (_passwordController.text.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: LinearProgressIndicator(
                                    value: _strength == 'Weak'
                                        ? 0.25
                                        : _strength == 'Medium'
                                            ? 0.6
                                            : 1,
                                    backgroundColor:
                                        colorScheme.surfaceContainerHighest,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      _strength == 'Strong'
                                          ? const Color(0xFF22C55E)
                                          : _strength == 'Medium'
                                              ? const Color(0xFFF59E0B)
                                              : const Color(0xFFEF4444),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'Password strength: $_strength',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: _strength == 'Strong'
                                        ? const Color(0xFF22C55E)
                                        : _strength == 'Medium'
                                            ? const Color(0xFFF59E0B)
                                            : const Color(0xFFEF4444),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 20),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Confirm New Password',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: colorScheme.onSurface,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _confirmController,
                            obscureText: _obscureConfirm,
                            onChanged: (_) => setState(() {}),
                            decoration: _passwordDecoration(
                              hintText: 'Re-enter new password',
                              obscure: _obscureConfirm,
                              onToggle: () => setState(
                                  () => _obscureConfirm = !_obscureConfirm),
                              colorScheme: colorScheme,
                              outline: outline,
                            ),
                          ),
                          if (_confirmController.text.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(
                                  _passwordsMatch
                                      ? Icons.check_circle
                                      : Icons.cancel,
                                  size: 16,
                                  color: _passwordsMatch
                                      ? const Color(0xFF22C55E)
                                      : const Color(0xFFEF4444),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  _passwordsMatch
                                      ? 'Passwords match'
                                      : 'Passwords do not match',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: _passwordsMatch
                                        ? const Color(0xFF22C55E)
                                        : const Color(0xFFEF4444),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 32),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _isLoading ? null : _handleReset,
                              icon: const Icon(Icons.lock,
                                  color: Colors.white, size: 20),
                              label: const Text(
                                'Reset Password',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEF4444),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
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
        ],
      ),
    );
  }
}
