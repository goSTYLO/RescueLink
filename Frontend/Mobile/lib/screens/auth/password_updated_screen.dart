import 'package:flutter/material.dart';

class PasswordUpdatedScreen extends StatelessWidget {
  final VoidCallback? onBackToLogin;

  const PasswordUpdatedScreen({super.key, this.onBackToLogin});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              // Top row: spacer, logo, Skip
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(width: 48),
                  _buildLogo(context),
                  TextButton(
                    onPressed: onBackToLogin,
                    child: const Text('Skip', style: TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 20, offset: const Offset(0, 4))],
                        ),
                        child: Column(
                          children: [
                            SizedBox(
                              height: 180,
                              child: Image.asset(
                                'assets/images/passwordupdated_illustration.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              'Password Updated!',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF22C55E),
                              ),
                            ),
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF4ADE80), Color(0xFF22C55E)],
                                    begin: Alignment.centerLeft,
                                    end: Alignment.centerRight,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: ElevatedButton(
                                  onPressed: onBackToLogin,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.transparent,
                                    shadowColor: Colors.transparent,
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  child: const Text('Back to Login', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Your password has been updated\nsuccessfully. You can now log in with\nyour new password.',
                        style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                        textAlign: TextAlign.center,
                      ),
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

  Widget _buildLogo(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset('assets/logo/icon.png', width: 104, height: 104, fit: BoxFit.contain),
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
            const Text('Emergency Response and Safety', style: TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          ],
        ),
      ],
    );
  }
}
