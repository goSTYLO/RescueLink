import 'package:flutter/material.dart';
import '../../utils/responsive.dart';
import '../../utils/app_config.dart';
import '../../utils/validators.dart';
import '../../widgets/recaptcha_webview.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gradient_header.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final VoidCallback? onBackToLogin;
  final Future<bool> Function(String phone, String captchaToken)? onRequestCode;

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
  String? _captchaToken;
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
          'assets/logo/icon.png',
          width: Responsive.headerLogoSize,
          height: Responsive.headerLogoSize,
          fit: BoxFit.contain,
        ),
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

  void _showRecaptchaDialog(BuildContext context) {
    if (AppConfig.recaptchaSiteKey.isEmpty) {
      setState(() {
        _recaptchaChecked = true;
        _captchaToken = '';
      });
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
                      Text(
                        "Verify you're human",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(ctx).colorScheme.onSurface,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: Icon(
                          Icons.close,
                          color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                        ),
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
                        setState(() {
                          _recaptchaChecked = true;
                          _captchaToken = token;
                        });
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
    final phoneError = Validators.validatePhoneNumber(phone);
    if (phoneError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(phoneError)),
      );
      return;
    }
    if (!_recaptchaChecked || _captchaToken == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please confirm you are not a robot')),
      );
      return;
    }
    setState(() => _isLoading = true);
    final ok =
        await widget.onRequestCode?.call(phone, _captchaToken!) ?? false;
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
    final colorScheme = Theme.of(context).colorScheme;
    final outline = colorScheme.outline.withValues(alpha: 0.5);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          GradientHeader(
            title: 'Forgot Password',
            onBack: widget.onBackToLogin,
            transparentFade: true,
          ),
          Expanded(
            child: SafeArea(
              top: false,
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
                    GlassCard(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            inputFormatters: Validators.phoneInputFormatters,
                            maxLength: 11,
                            decoration: InputDecoration(
                              prefixIcon: Icon(
                                Icons.phone,
                                size: 20,
                                color: colorScheme.onSurface.withValues(alpha: 0.6),
                              ),
                              hintText: '09171234567',
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
                                borderSide: const BorderSide(
                                  color: Color(0xFFEF4444),
                                  width: 2,
                                ),
                              ),
                              filled: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          InkWell(
                            onTap: _recaptchaChecked
                                ? null
                                : () => _showRecaptchaDialog(context),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: outline),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _recaptchaChecked
                                        ? Icons.check_box
                                        : Icons.check_box_outline_blank,
                                    size: 24,
                                    color: _recaptchaChecked
                                        ? const Color(0xFFEF4444)
                                        : colorScheme.onSurface,
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    "I'm not a robot",
                                    style: TextStyle(
                                      color: colorScheme.onSurface,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const Spacer(),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'reCAPTCHA',
                                        style: TextStyle(
                                          color: colorScheme.onSurfaceVariant,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        'Privacy - Terms',
                                        style: TextStyle(
                                          color: colorScheme.onSurfaceVariant
                                              .withValues(alpha: 0.7),
                                          fontSize: 11,
                                        ),
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
                              onPressed: (_recaptchaChecked && !_isLoading)
                                  ? _handleRequestCode
                                  : null,
                              icon: const Icon(Icons.phone,
                                  color: Colors.white, size: 20),
                              label: const Text(
                                'Request Verification Code',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
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
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
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
