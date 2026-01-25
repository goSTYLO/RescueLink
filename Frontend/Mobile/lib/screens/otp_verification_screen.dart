import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class OTPVerificationScreen extends StatefulWidget {
  final String phoneNumber;
  final VoidCallback? onBackTap;
  final VoidCallback? onVerificationSuccess;

  const OTPVerificationScreen({
    super.key,
    required this.phoneNumber,
    this.onBackTap,
    this.onVerificationSuccess,
  });

  @override
  State<OTPVerificationScreen> createState() => _OTPVerificationScreenState();
}

class _OTPVerificationScreenState extends State<OTPVerificationScreen> {
  final AuthService _authService = AuthService();
  final List<TextEditingController> _otpControllers = List.generate(
    6,
    (index) => TextEditingController(),
  );
  final List<FocusNode> _otpFocusNodes =
      List.generate(6, (index) => FocusNode());

  bool _isLoading = false;
  int _resendCountdown = 60;

  @override
  void initState() {
    super.initState();
    // Start resend countdown
    _startResendCountdown();
  }

  @override
  void dispose() {
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _otpFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String _getOTPCode() {
    return _otpControllers.map((controller) => controller.text).join();
  }

  void _handleOTPInput(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _otpFocusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _otpFocusNodes[index - 1].requestFocus();
    }
  }

  void _startResendCountdown() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) {
        setState(() {
          if (_resendCountdown > 0) {
            _resendCountdown--;
          }
        });
      }
      return _resendCountdown > 0 && mounted;
    });
  }

  Future<void> _handleResendOTP() async {
    if (_resendCountdown > 0) return;

    setState(() => _isLoading = true);

    final result = await _authService.resendOtp(widget.phoneNumber);

    if (mounted) {
      if (result['success']) {
        setState(() {
          _resendCountdown = 60;
          _isLoading = false;
        });
        _startResendCountdown();

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP sent successfully'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['error'] ?? 'Failed to resend OTP'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _captureLocationAndVerify() async {
    // Verify OTP (location already validated during registration)
    setState(() => _isLoading = true);

    final otpCode = _getOTPCode();

    if (otpCode.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter all 6 digits'),
          backgroundColor: Colors.orange,
        ),
      );
      setState(() => _isLoading = false);
      return;
    }

    final result = await _authService.verifyOtpAndLocation(
      otp: otpCode,
      latitude: 0,
      longitude: 0,
    );

    if (mounted) {
      if (result['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Verification successful!'),
            backgroundColor: Colors.green,
          ),
        );

        // Navigate to home screen
        if (widget.onVerificationSuccess != null) {
          widget.onVerificationSuccess!();
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['error'] ?? 'Verification failed'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    // Card Container
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          // Gradient Header
                          Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)],
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                              ),
                              borderRadius: BorderRadius.only(
                                topLeft: Radius.circular(16),
                                topRight: Radius.circular(16),
                              ),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 32,
                              vertical: 48,
                            ),
                            child: const Column(
                              children: [
                                Icon(
                                  Icons.shield,
                                  color: Colors.white,
                                  size: 48,
                                ),
                                SizedBox(height: 16),
                                Text(
                                  'Verification',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Text(
                                  'Verify your phone and location',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Content Section
                          Padding(
                            padding: const EdgeInsets.all(32.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // OTP Input Section
                                const Text(
                                  'Enter 6-Digit OTP',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF1F2937),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'OTP sent to ${widget.phoneNumber}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF6B7280),
                                  ),
                                ),
                                const SizedBox(height: 24),

                                // OTP Input Fields
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: List.generate(6, (index) {
                                    return SizedBox(
                                      width: 50,
                                      height: 60,
                                      child: TextField(
                                        controller: _otpControllers[index],
                                        focusNode: _otpFocusNodes[index],
                                        textAlign: TextAlign.center,
                                        keyboardType: TextInputType.number,
                                        maxLength: 1,
                                        enabled:
                                            !_isLoading,
                                        decoration: InputDecoration(
                                          counterText: '',
                                          border: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                              color: Color(0xFFD1D5DB),
                                            ),
                                          ),
                                          enabledBorder: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                              color: Color(0xFFD1D5DB),
                                            ),
                                          ),
                                          focusedBorder: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                              color: Color(0xFF3B82F6),
                                              width: 2,
                                            ),
                                          ),
                                          filled: true,
                                          fillColor: Colors.white,
                                        ),
                                        style: const TextStyle(
                                          fontSize: 24,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1F2937),
                                        ),
                                        onChanged: (value) {
                                          _handleOTPInput(index, value);
                                        },
                                      ),
                                    );
                                  }),
                                ),

                                const SizedBox(height: 32),

                                // Verify Button
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: _isLoading
                                        ? null
                                        : _captureLocationAndVerify,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.transparent,
                                      shadowColor: Colors.transparent,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      disabledBackgroundColor:
                                          const Color(0xFFE5E7EB),
                                    ).copyWith(
                                      backgroundColor: WidgetStateProperty.all(
                                        Colors.transparent,
                                      ),
                                    ),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        gradient: _isLoading
                                            ? const LinearGradient(
                                                colors: [
                                                  Color(0xFFD1D5DB),
                                                  Color(0xFFD1D5DB),
                                                ],
                                              )
                                            : const LinearGradient(
                                                colors: [
                                                  Color(0xFF10B981),
                                                  Color(0xFF3B82F6),
                                                ],
                                              ),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                      child: Center(
                                        child: _isLoading
                                            ? const SizedBox(
                                                height: 20,
                                                width: 20,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  valueColor:
                                                      AlwaysStoppedAnimation<
                                                          Color>(
                                                    Color(0xFF9CA3AF),
                                                  ),
                                                ),
                                              )
                                            : const Text(
                                                'Complete Verification',
                                                style: TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                      ),
                                    ),
                                  ),
                                ),

                                const SizedBox(height: 24),

                                // Resend OTP Section
                                Center(
                                  child: Column(
                                    children: [
                                      const Text(
                                        'Didn\'t receive the code?',
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFF6B7280),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      if (_resendCountdown > 0)
                                        Text(
                                          'Resend OTP in ${_resendCountdown}s',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFF9CA3AF),
                                            fontWeight: FontWeight.w500,
                                          ),
                                        )
                                      else
                                        GestureDetector(
                                          onTap: _isLoading
                                              ? null
                                              : _handleResendOTP,
                                          child: Text(
                                            'Resend OTP',
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: _isLoading
                                                  ? const Color(0xFF9CA3AF)
                                                  : const Color(0xFF14B8A6),
                                              fontWeight: FontWeight.w600,
                                              decoration: _isLoading
                                                  ? TextDecoration.none
                                                  : TextDecoration.underline,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 24),

                                // Back Button
                                Center(
                                  child: GestureDetector(
                                    onTap: _isLoading
                                        ? null
                                        : widget.onBackTap,
                                    child: Text(
                                      'Back to OTP Request',
                                      style: TextStyle(
                                        color: _isLoading
                                            ? const Color(0xFFD1D5DB)
                                            : const Color(0xFF6B7280),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
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
        ),
      ),
    );
  }
}
