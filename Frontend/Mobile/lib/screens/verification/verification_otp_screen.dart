import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../bloc/auth/auth_bloc.dart';
import '../../bloc/auth/auth_event.dart';
import '../../bloc/auth/auth_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/app_config.dart';
import '../../utils/responsive.dart';
import '../../widgets/recaptcha_webview.dart';

/// Enter OTP after registration; verify/resend via RescueLink backend (IPROG).
class VerificationOtpScreen extends StatefulWidget {
  final String phoneNumber;
  final Function(Map<String, dynamic>)? onVerifyAndContinue;
  final VoidCallback? onBack;
  final String? selectedBarangay;
  final String? cityRegion;

  /// When false (signup flow), app does not store token; navigate to Login.
  final bool storeTokenAfterVerify;

  /// Called when OTP verified and storeTokenAfterVerify is false (signup flow).
  final VoidCallback? onPhoneVerified;

  const VerificationOtpScreen({
    super.key,
    required this.phoneNumber,
    this.onVerifyAndContinue,
    this.onBack,
    this.selectedBarangay,
    this.cityRegion,
    this.storeTokenAfterVerify = false,
    this.onPhoneVerified,
  });

  @override
  State<VerificationOtpScreen> createState() => _VerificationOtpScreenState();
}

class _VerificationOtpScreenState extends State<VerificationOtpScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  int _resendCountdown = 30;
  bool _canResend = false;
  bool _resendInFlight = false;

  @override
  void initState() {
    super.initState();
    _startResendTimer();
  }

  void _startResendTimer() {
    setState(() {
      _resendCountdown = 30;
      _canResend = false;
    });
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      var shouldStop = false;
      setState(() {
        _resendCountdown--;
        if (_resendCountdown <= 0) {
          _canResend = true;
          shouldStop = true;
        }
      });
      return !shouldStop;
    });
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otpCode => _controllers.map((c) => c.text).join();

  void _verifyOtp(BuildContext context) {
    if (_otpCode.length != 6 || !RegExp(r'^[0-9]{6}$').hasMatch(_otpCode)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid 6-digit code.'),
          backgroundColor: AppTheme.primaryRed,
        ),
      );
      return;
    }
    context.read<AuthBloc>().add(OtpVerified(
          phone: widget.phoneNumber,
          otp: _otpCode,
          storeToken: widget.storeTokenAfterVerify,
        ));
  }

  Future<String?> _obtainCaptchaToken(BuildContext context) async {
    if (AppConfig.recaptchaSiteKey.isEmpty) {
      return '';
    }
    return showDialog<String>(
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
                        icon: Icon(Icons.close,
                            color: Theme.of(ctx).colorScheme.onSurfaceVariant),
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
                        Navigator.of(ctx).pop(token);
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

  Future<void> _resendOtp(BuildContext context) async {
    if (!_canResend || _resendInFlight) return;
    final authBloc = context.read<AuthBloc>();
    setState(() => _resendInFlight = true);
    try {
      final token = await _obtainCaptchaToken(context);
      if (!mounted) return;
      if (token == null) {
        setState(() => _resendInFlight = false);
        return;
      }
      authBloc.add(ResendOtpRequested(
        phone: widget.phoneNumber,
        captchaToken: token,
      ));
      _startResendTimer();
    } finally {
      if (mounted) setState(() => _resendInFlight = false);
    }
  }

  Widget _buildLogo(double width) {
    final logoSize = Responsive.logoSize(width);
    final titleSize = Responsive.brandTitleSize(width);
    final subtitleSize = Responsive.brandSubtitleSize(width);
    final compact = Responsive.isCompact(width);
    final colorScheme = Theme.of(context).colorScheme;

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
                            color:
                                Theme.of(context).brightness == Brightness.dark
                                    ? Colors.white
                                    : const Color(0xFF0F172A))),
                    const TextSpan(
                        text: 'Link',
                        style: TextStyle(color: AppTheme.primaryRed)),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                'Emergency Response and Safety',
                style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontSize: subtitleSize),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is OtpError || state is AuthError) {
          final message =
              state is OtpError ? state.message : (state as AuthError).message;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: AppTheme.primaryRed,
              duration: const Duration(seconds: 4),
              behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.all(16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        if (state is OtpSent) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('A new verification code has been sent.'),
              backgroundColor: AppTheme.successGreen,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        if (state is PhoneVerified) {
          widget.onPhoneVerified?.call();
        }
      },
      builder: (context, authState) {
        final isVerifying = authState is AuthLoading;
        final barangay = widget.selectedBarangay ?? 'Barangay Poblacion Oeste';
        final cityRegion = widget.cityRegion ?? 'Dagupan City, Pangasinan';
        final screenWidth = MediaQuery.sizeOf(context).width;
        final compact = Responsive.isCompact(screenWidth);
        final horizontalPadding = Responsive.horizontalPadding(screenWidth);
        final headingSize = compact ? 24.0 : 26.0;
        final otpBoxWidth = compact ? 38.0 : 44.0;
        final canTapResend = _canResend && !isVerifying && !_resendInFlight;
        final colorScheme = Theme.of(context).colorScheme;
        const locationPink = Color(0xFFEC4899);

        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
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
                        onPressed: isVerifying ? null : widget.onBack,
                        icon: Icon(Icons.arrow_back,
                            color: colorScheme.onSurface),
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
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Enter the code sent to your phone',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 14, color: colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colorScheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: colorScheme.outline.withValues(alpha: 0.5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Location Verified',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: locationPink.withValues(alpha: 0.14),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.location_on,
                                  color: locationPink, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    cityRegion,
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colorScheme.onSurfaceVariant),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    barangay,
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colorScheme.onSurfaceVariant),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  const Row(
                                    children: [
                                      Icon(Icons.check_circle,
                                          color: AppTheme.successGreen,
                                          size: 16),
                                      SizedBox(width: 4),
                                      Expanded(
                                        child: Text(
                                          'Within city boundary',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.successGreen,
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
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colorScheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: colorScheme.outline.withValues(alpha: 0.5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryBlue
                                    .withValues(alpha: 0.14),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.phone_android,
                                  color: AppTheme.primaryBlue, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Enter OTP Code',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: colorScheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Sent to ${widget.phoneNumber}',
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colorScheme.onSurfaceVariant),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: List.generate(6, (i) {
                            return SizedBox(
                              width: otpBoxWidth,
                              child: TextField(
                                controller: _controllers[i],
                                focusNode: _focusNodes[i],
                                enabled: !isVerifying,
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                maxLength: 1,
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                                decoration: InputDecoration(
                                  counterText: '',
                                  filled: true,
                                  fillColor: colorScheme.surface,
                                  contentPadding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(
                                        color: colorScheme.outline
                                            .withValues(alpha: 0.5)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(
                                        color: colorScheme.outline
                                            .withValues(alpha: 0.5)),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: const BorderSide(
                                        color: AppTheme.primaryBlue, width: 2),
                                  ),
                                ),
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly
                                ],
                                onChanged: (v) {
                                  if (v.isNotEmpty && i < 5) {
                                    _focusNodes[i + 1].requestFocus();
                                  }
                                  setState(() {});
                                },
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 16),
                        Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                onPressed: canTapResend
                                    ? () => _resendOtp(context)
                                    : null,
                                icon: Icon(Icons.refresh,
                                    color: canTapResend
                                        ? AppTheme.primaryRed
                                        : colorScheme.onSurfaceVariant,
                                    size: 20),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                visualDensity: VisualDensity.compact,
                              ),
                              const SizedBox(width: 6),
                              TextButton(
                                onPressed: canTapResend
                                    ? () => _resendOtp(context)
                                    : null,
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                  visualDensity: VisualDensity.compact,
                                ),
                                child: Text(
                                  canTapResend
                                      ? 'Resend OTP'
                                      : 'Resend OTP in ${_resendCountdown}s',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: canTapResend
                                        ? AppTheme.primaryRed
                                        : colorScheme.onSurfaceVariant,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: isVerifying || _otpCode.length != 6
                                ? null
                                : () => _verifyOtp(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryRed,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            child: isVerifying
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Colors.white),
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'Verify & Continue',
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
                      color: AppTheme.primaryBlue.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: AppTheme.primaryBlue.withValues(alpha: 0.45)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle,
                            color: AppTheme.primaryBlue, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Verification ensures only Dagupan City residents can report emergencies',
                            style: TextStyle(
                                fontSize: 13, color: colorScheme.onSurface),
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
