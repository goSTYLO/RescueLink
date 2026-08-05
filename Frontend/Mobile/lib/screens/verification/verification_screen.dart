import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_event.dart';
import '../../bloc/auth/auth_state.dart';
import '../../utils/app_config.dart';
import '../../utils/responsive.dart';
import '../../widgets/recaptcha_webview.dart';

/// First step: Location Verified + Human Verification (reCAPTCHA + Request OTP).
class VerificationScreen extends StatefulWidget {
  final String phone;
  final VoidCallback? onRequestOtp;
  final VoidCallback? onBack;
  final String? selectedBarangay;
  final String? cityRegion;

  const VerificationScreen({
    super.key,
    required this.phone,
    this.onRequestOtp,
    this.onBack,
    this.selectedBarangay,
    this.cityRegion,
  });

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  bool _recaptchaChecked = false;

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
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
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

  Widget _buildLogo(double width) {
    final logoSize = Responsive.logoSize(width);
    final titleSize = Responsive.brandTitleSize(width);
    final subtitleSize = Responsive.brandSubtitleSize(width);
    final compact = Responsive.isCompact(width);

    return Row(
      mainAxisSize: MainAxisSize.max,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset('assets/logo/icon.png',
            width: logoSize, height: logoSize, fit: BoxFit.contain),
        SizedBox(width: compact ? 6 : 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text.rich(
                TextSpan(
                  style: TextStyle(
                      fontSize: titleSize, fontWeight: FontWeight.bold),
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
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                'Emergency Response and Safety',
                style: TextStyle(
                    color: const Color(0xFF6B7280), fontSize: subtitleSize),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _requestOtp(BuildContext context) {
    context.read<AuthBloc>().add(OtpRequested(widget.phone));
  }

  @override
  Widget build(BuildContext context) {
    final barangay = widget.selectedBarangay ?? 'Barangay Poblacion Oeste';
    final cityRegion = widget.cityRegion ?? 'Dagupan City, Pangasinan';

    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is OtpError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        // Parent (main) listens for OtpSent and navigates to VerificationOtpScreen
      },
      builder: (context, state) {
        final isLoading = state is AuthLoading;
        final screenWidth = MediaQuery.sizeOf(context).width;
        final compact = Responsive.isCompact(screenWidth);
        final horizontalPadding = Responsive.horizontalPadding(screenWidth);
        final headingSize = compact ? 24.0 : 26.0;
        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.onBack != null) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IconButton(
                        onPressed: widget.onBack,
                        icon: const Icon(Icons.arrow_back,
                            color: Color(0xFF374151)),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _buildLogo(screenWidth),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: compact ? 140 : 160,
                    child: Image.asset(
                      'assets/images/verificationdone_illustration.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Verification',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: headingSize,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Confirm your identity and location',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                  ),
                  const SizedBox(height: 24),
                  // Location Verified card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Location Verified',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Color(0xFFFCE7F3),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.location_on,
                                  color: Color(0xFFEC4899), size: 24),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cityRegion,
                                    style: const TextStyle(
                                        fontSize: 14, color: Color(0xFF6B7280)),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    barangay,
                                    style: const TextStyle(
                                        fontSize: 14, color: Color(0xFF6B7280)),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 8),
                                  const Row(
                                    children: [
                                      Icon(Icons.check_circle,
                                          color: Color(0xFF22C55E), size: 18),
                                      SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Within city boundary',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 13,
                                              color: Color(0xFF22C55E),
                                              fontWeight: FontWeight.w500),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Container(
                          height: 100,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.location_on,
                                    color: Color(0xFFEC4899), size: 32),
                                SizedBox(height: 6),
                                Text(
                                  'Map Preview',
                                  style: TextStyle(
                                      fontSize: 12, color: Color(0xFF6B7280)),
                                ),
                                Text(
                                  'Dagupan City',
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF374151)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Human Verification card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Human Verification',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 14),
                        InkWell(
                          onTap: _recaptchaChecked
                              ? null
                              : () => _showRecaptchaDialog(context),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border:
                                  Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _recaptchaChecked
                                      ? Icons.check_box
                                      : Icons.check_box_outline_blank,
                                  size: 24,
                                  color: _recaptchaChecked
                                      ? const Color(0xFF2563EB)
                                      : const Color(0xFF374151),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Text(
                                    "I'm not a robot",
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        fontSize: 14, color: Color(0xFF374151)),
                                  ),
                                ),
                                const Text(
                                  'reCAPTCHA',
                                  style: TextStyle(
                                      fontSize: 12, color: Color(0xFF6B7280)),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: (_recaptchaChecked && !isLoading)
                                ? () => _requestOtp(context)
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEF4444),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            child: isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Colors.white),
                                    ),
                                  )
                                : const Text(
                                    'Request OTP',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 16),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle,
                            color: Color(0xFF2563EB), size: 22),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Verification ensures only Dagupan City residents can report emergencies',
                            style: TextStyle(
                                fontSize: 13, color: Color(0xFF1E40AF)),
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
      },
    );
  }
}
