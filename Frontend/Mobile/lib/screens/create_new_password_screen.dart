import 'package:flutter/material.dart';

class CreateNewPasswordScreen extends StatefulWidget {
  final String phoneNumber;
  final VoidCallback? onBack;
  final void Function(String newPassword)? onResetPassword;

  const CreateNewPasswordScreen({
    super.key,
    required this.phoneNumber,
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
    return Column(
      children: [
        Image.asset('assets/logo/logo.png', width: 80, height: 80, fit: BoxFit.contain),
        const SizedBox(height: 12),
        const Text('Emergency Response & Safety', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
      ],
    );
  }

  void _handleReset() {
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
    setState(() => _isLoading = true);
    widget.onResetPassword?.call(_passwordController.text);
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF374151)),
          onPressed: widget.onBack,
        ),
      ),
      body: SafeArea(
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
              const Text(
                'Create New Password',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choose a strong password',
                style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.lock_outline, color: Color(0xFF2563EB), size: 20),
                        const SizedBox(width: 8),
                        const Text(
                          'Password Requirements',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E40AF), fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('• Minimum 8 characters', style: TextStyle(color: Color(0xFF1E40AF), fontSize: 13)),
                    const Text('• Include numbers and symbols', style: TextStyle(color: Color(0xFF1E40AF), fontSize: 13)),
                    const Text('• Mix of uppercase and lowercase letters', style: TextStyle(color: Color(0xFF1E40AF), fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('New Password', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF374151))),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Enter new password',
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: const Color(0xFF9CA3AF)),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              if (_passwordController.text.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: LinearProgressIndicator(
                        value: _strength == 'Weak' ? 0.25 : _strength == 'Medium' ? 0.6 : 1,
                        backgroundColor: const Color(0xFFE5E7EB),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _strength == 'Strong' ? const Color(0xFF22C55E) : _strength == 'Medium' ? const Color(0xFFF59E0B) : const Color(0xFFEF4444),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Password strength: $_strength',
                      style: TextStyle(
                        fontSize: 12,
                        color: _strength == 'Strong' ? const Color(0xFF22C55E) : _strength == 'Medium' ? const Color(0xFFF59E0B) : const Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('Confirm New Password', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF374151))),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _confirmController,
                obscureText: _obscureConfirm,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Re-enter new password',
                  suffixIcon: IconButton(
                    icon: Icon(_obscureConfirm ? Icons.visibility_off : Icons.visibility, color: const Color(0xFF9CA3AF)),
                    onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              if (_confirmController.text.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      _passwordsMatch ? Icons.check_circle : Icons.cancel,
                      size: 16,
                      color: _passwordsMatch ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _passwordsMatch ? 'Passwords match' : 'Passwords do not match',
                      style: TextStyle(fontSize: 12, color: _passwordsMatch ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _handleReset,
                  icon: const Icon(Icons.lock, color: Colors.white, size: 20),
                  label: const Text('Reset Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}
