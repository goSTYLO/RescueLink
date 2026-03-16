import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class ChangePasswordScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onUpdatePassword;

  const ChangePasswordScreen({
    super.key,
    this.onBack,
    this.onUpdatePassword,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  bool _showCurrentError = false;
  bool _showConfirmError = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  int _passwordStrength(String s) {
    if (s.isEmpty) return 0;
    int n = 0;
    if (s.length >= 6) n++;
    if (s.length >= 8) n++;
    if (RegExp(r'[A-Z]').hasMatch(s)) n++;
    if (RegExp(r'[a-z]').hasMatch(s)) n++;
    if (RegExp(r'[0-9]').hasMatch(s)) n++;
    if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(s)) n++;
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    return 3;
  }

  String _strengthLabel(int level) {
    switch (level) {
      case 1:
        return 'Weak';
      case 2:
        return 'Medium';
      case 3:
        return 'Strong';
      default:
        return 'Weak';
    }
  }

  void _onUpdatePassword() {
    final current = _currentController.text;
    final newP = _newController.text;
    final confirm = _confirmController.text;

    setState(() {
      _showCurrentError = current.isEmpty;
      _showConfirmError = newP.isNotEmpty && newP != confirm;
    });
    if (current.isEmpty || newP.isEmpty || newP != confirm) return;
    widget.onUpdatePassword?.call();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onBack?.call();
      },
      child: Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // Red header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                borderRadius: BorderRadius.only(bottomLeft: Radius.circular(20), bottomRight: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.onBack,
                    icon: const CircleAvatar(
                      backgroundColor: Colors.white,
                      child: Icon(Icons.arrow_back, color: Color(0xFF111827), size: 22),
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Change Password',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Image.asset(
                    'assets/logo/logo2.png',
                    width: 32,
                    height: 32,
                    fit: BoxFit.contain,
                    color: Colors.white,
                    colorBlendMode: BlendMode.srcIn,
                    errorBuilder: (_, __, ___) => const Icon(Icons.shield, color: Colors.white, size: 28),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Illustration
                    Center(
                      child: Image.asset(
                        'assets/images/changepassword_illustration.png',
                        height: 160,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Image.asset(
                          'assets/images/forgotpassword_illustration.png',
                          height: 160,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(Icons.lock_reset, size: 80, color: Color(0xFF9CA3AF)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Current Password card
                    _inputCard(
                      label: 'Current Password',
                      controller: _currentController,
                      obscure: _obscureCurrent,
                      hint: 'Enter current password',
                      onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                      error: _showCurrentError ? 'Passwords do not match' : null,
                    ),
                    const SizedBox(height: 16),
                    // New Password card
                    _newPasswordCard(),
                    const SizedBox(height: 16),
                    // Confirm New Password card
                    _inputCard(
                      label: 'Confirm New Password',
                      controller: _confirmController,
                      obscure: _obscureConfirm,
                      hint: 'Re-enter new password',
                      onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                      error: _showConfirmError ? 'Passwords do not match' : null,
                    ),
                    const SizedBox(height: 24),
                    // Update Password button
                    ElevatedButton.icon(
                      onPressed: _onUpdatePassword,
                      icon: const Icon(Icons.lock, color: Colors.white, size: 22),
                      label: const Text(
                        'Update Password',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Security Tip
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF93C5FD)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Security Tip',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E40AF),
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Never share your password with anyone. RescueLink staff will never ask for your password. Change it regularly to keep your account secure.',
                            style: TextStyle(fontSize: 13, color: Color(0xFF1E3A8A), height: 1.4),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _inputCard({
    required String label,
    required TextEditingController controller,
    required bool obscure,
    required String hint,
    required VoidCallback onToggle,
    String? error,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: controller,
            obscureText: obscure,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              suffixIcon: IconButton(
                icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF6B7280)),
                onPressed: onToggle,
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.cancel_outlined, size: 18, color: Colors.red.shade700),
                const SizedBox(width: 6),
                Text(error, style: TextStyle(fontSize: 12, color: Colors.red.shade700)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _newPasswordCard() {
    final level = _passwordStrength(_newController.text);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'New Password',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _newController,
            obscureText: _obscureNew,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Enter new password',
              hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              suffixIcon: IconButton(
                icon: Icon(_obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF6B7280)),
                onPressed: () => setState(() => _obscureNew = !_obscureNew),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: List.generate(5, (i) {
              final filled = i < level;
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.only(right: 4),
                  height: 4,
                  decoration: BoxDecoration(
                    color: filled ? const Color(0xFFEF4444) : const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 4),
          Text(
            'Password strength: ${_strengthLabel(level)}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF22C55E), fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
