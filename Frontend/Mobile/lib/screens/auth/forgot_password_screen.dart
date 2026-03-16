import 'package:flutter/material.dart';
import '../../utils/app_config.dart';
import '../../widgets/recaptcha_webview.dart';
import '../../widgets/glass_card.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final VoidCallback? onBackToLogin;
  final Future<bool> Function(String phone)? onRequestCode;

  const ForgotPasswordScreen({
    super.key,
    this.onBackToLogin,
    this.onRequestCode,
  });

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phoneController = TextEditingController();
  bool _recaptchaChecked = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Widget _buildLogo() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/logo2.png',
          width: 64,
          height: 64,
          fit: BoxFit.contain,
        ),
        const SizedBox(width: 0),
        Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Color(0xFF2563EB))),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _showRecaptchaDialog(BuildContext context) {
    if (AppConfig.recaptchaSiteKey.isEmpty) {
      setState(() => _recaptchaChecked = true);
      return;
    }
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: true,
        child: Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400, maxHeight: 480),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      const Text(
                        "Verify you're human",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: const Icon(Icons.close, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                Flexible(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: RecaptchaWebView(
                      siteKey: AppConfig.recaptchaSiteKey,
                      onSuccess: (token) {
                        if (!ctx.mounted) return;
                        Navigator.of(ctx).pop();
                        setState(() => _recaptchaChecked = true);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleRequestCode() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your registered phone number')),
      );
      return;
    }
    if (!_recaptchaChecked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please confirm you are not a robot')),
      );
      return;
    }
    setState(() => _isLoading = true);
    final formattedPhone = phone.startsWith('+') ? phone : '+63$phone';
    final ok = await widget.onRequestCode?.call(formattedPhone) ?? false;
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not send code. Check the number and try again.'),
          backgroundColor: Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF374151)),
          onPressed: widget.onBackToLogin,
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 28),
              Center(child: _buildLogo()),
              const SizedBox(height: 20),
              SizedBox(
                height: 180,
                child: Image.asset(
                  'assets/images/forgotpassword_illustration.png',
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Forgot Password',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 24),
              GlassCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: const BoxDecoration(
                        border: Border(
                          right: BorderSide(color: Color(0xFFE5E7EB)),
                        ),
                      ),
                      child: const Text('+63', style: TextStyle(color: Color(0xFF6B7280), fontSize: 16)),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          hintText: '917 123 4567',
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              InkWell(
                onTap: _recaptchaChecked ? null : () => _showRecaptchaDialog(context),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _recaptchaChecked ? Icons.check_box : Icons.check_box_outline_blank,
                        size: 24,
                        color: _recaptchaChecked ? const Color(0xFFEF4444) : const Color(0xFF374151),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        "I'm not a robot",
                        style: TextStyle(color: Color(0xFF374151), fontSize: 14),
                      ),
                      const Spacer(),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'reCAPTCHA',
                            style: TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                          ),
                          Text(
                            'Privacy - Terms',
                            style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: (_recaptchaChecked && !_isLoading) ? _handleRequestCode : null,
                  icon: const Icon(Icons.phone, color: Colors.white, size: 20),
                  label: const Text(
                    'Request Verification Code',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
    );
  }
}
