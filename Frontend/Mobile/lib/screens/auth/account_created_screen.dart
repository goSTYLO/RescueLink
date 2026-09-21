import 'package:flutter/material.dart';
import '../../utils/responsive.dart';

class AccountCreatedScreen extends StatelessWidget {
  final VoidCallback? onBackToLogin;
  final VoidCallback? onDone;
  final String? registeredPhone;
  final VoidCallback? onContinueToVerifyPhone;
  final String? subtitle;

  const AccountCreatedScreen({
    super.key,
    this.onBackToLogin,
    this.onDone,
    this.registeredPhone,
    this.onContinueToVerifyPhone,
    this.subtitle,
  });

  void _goToLogin() {
    // Prefer a single navigation callback (avoid double setState).
    if (onDone != null) {
      onDone!();
      return;
    }
    onBackToLogin?.call();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = Responsive.horizontalPadding(screenWidth);
    final phoneVerifiedDone = onContinueToVerifyPhone == null;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: const Color(0xFFEF4444),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _goToLogin,
                    icon: const CircleAvatar(
                      backgroundColor: Colors.white,
                      child: Icon(Icons.arrow_back,
                          color: Color(0xFF111827), size: 22),
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const Expanded(
                    child: Text(
                      'Back to Log In',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Image.asset(
                    'assets/logo/icon.png',
                    width: Responsive.headerLogoSize,
                    height: Responsive.headerLogoSize,
                    fit: BoxFit.contain,
                    color: Colors.white,
                    colorBlendMode: BlendMode.srcIn,
                    errorBuilder: (_, __, ___) =>
                        const Icon(Icons.shield, color: Colors.white, size: 28),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          SizedBox(
                            height: 180,
                            child: Image.asset(
                              'assets/images/accountcreateddone_-illustration.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Account Created!',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF22C55E),
                            ),
                          ),
                          if (registeredPhone != null &&
                              registeredPhone!.trim().isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              registeredPhone!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),
                          if (onContinueToVerifyPhone != null)
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: onContinueToVerifyPhone,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFEF4444),
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 16),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text(
                                  'Continue to verify phone',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ),
                          if (onContinueToVerifyPhone != null)
                            const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: phoneVerifiedDone
                                ? ElevatedButton(
                                    onPressed: _goToLogin,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF22C55E),
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 16),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: const Text(
                                      'Continue to Log In',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                  )
                                : OutlinedButton(
                                    onPressed: _goToLogin,
                                    style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 16),
                                      side: const BorderSide(
                                          color: Color(0xFF22C55E)),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: const Text(
                                      'Back to Log In',
                                      style: TextStyle(
                                        color: Color(0xFF22C55E),
                                        fontWeight: FontWeight.w600,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      subtitle ??
                          'Verify your phone to complete registration.',
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF6B7280),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
