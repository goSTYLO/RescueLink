import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class RequestOTPScreen extends StatefulWidget {
  final String phoneNumber;
  final VoidCallback? onBackTap;
  final Function(String phone)? onOTPSent; // Callback to navigate to OTP verification screen

  const RequestOTPScreen({
    super.key,
    required this.phoneNumber,
    this.onBackTap,
    this.onOTPSent,
  });

  @override
  State<RequestOTPScreen> createState() => _RequestOTPScreenState();
}

class _RequestOTPScreenState extends State<RequestOTPScreen> {
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  bool _otpSent = false;
  int _resendCountdown = 0;

  @override
  void initState() {
    super.initState();
    _requestOTP();
  }

  Future<void> _requestOTP() async {
    setState(() => _isLoading = true);

    final result = await _authService.initializePhoneVerification(
      widget.phoneNumber,
    );

    if (mounted) {
      if (result['success']) {
        setState(() {
          _otpSent = true;
          _resendCountdown = 60;
          _isLoading = false;
        });
        _startResendCountdown();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['error'] ?? 'Failed to send OTP'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isLoading = false);
      }
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
      return _resendCountdown > 0;
    });
  }

  Future<void> _handleResendOTP() async {
    if (_resendCountdown == 0) {
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
  }

  void _handleProceedToOTPInput() {
    if (widget.onOTPSent != null) {
      widget.onOTPSent!(widget.phoneNumber);
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
                                // Status Information
                                Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0F9FF),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: const Color(0xFF3B82F6),
                                      width: 1.5,
                                    ),
                                  ),
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(
                                            Icons.info,
                                            color: Color(0xFF3B82F6),
                                            size: 20,
                                          ),
                                          SizedBox(width: 8),
                                          Text(
                                            'OTP Status',
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF1F2937),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        _otpSent
                                            ? 'OTP has been sent to ${widget.phoneNumber}'
                                            : 'Requesting OTP...',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFF374151),
                                          height: 1.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 32),

                                // Phone Number Display
                                const Text(
                                  'Phone Number',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF374151),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color: const Color(0xFFD1D5DB),
                                    ),
                                    borderRadius: BorderRadius.circular(8),
                                    color: const Color(0xFFF9FAFB),
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 14,
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.phone,
                                        color: Color(0xFF9CA3AF),
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        widget.phoneNumber,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: Color(0xFF374151),
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 32),

                                // Status Indicator
                                Center(
                                  child: Column(
                                    children: [
                                      if (_isLoading) ...[
                                        const SizedBox(
                                          height: 60,
                                          width: 60,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 3,
                                            valueColor: AlwaysStoppedAnimation<Color>(
                                              Color(0xFF3B82F6),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        const Text(
                                          'Requesting OTP...',
                                          style: TextStyle(
                                            fontSize: 14,
                                            color: Color(0xFF6B7280),
                                          ),
                                        ),
                                      ] else if (_otpSent) ...[
                                        Container(
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFDFEDFB),
                                            shape: BoxShape.circle,
                                          ),
                                          padding: const EdgeInsets.all(16),
                                          child: const Icon(
                                            Icons.check_circle,
                                            color: Color(0xFF10B981),
                                            size: 48,
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        const Text(
                                          'OTP Sent Successfully',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF10B981),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        const Text(
                                          'Check your SMS for the verification code',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFF6B7280),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 32),

                                // Proceed Button
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: _isLoading || !_otpSent
                                        ? null
                                        : _handleProceedToOTPInput,
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
                                        gradient: _otpSent
                                            ? const LinearGradient(
                                                colors: [
                                                  Color(0xFF10B981),
                                                  Color(0xFF3B82F6),
                                                ],
                                              )
                                            : const LinearGradient(
                                                colors: [
                                                  Color(0xFFD1D5DB),
                                                  Color(0xFFD1D5DB),
                                                ],
                                              ),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                      child: Center(
                                        child: Text(
                                          'Proceed to OTP Verification',
                                          style: TextStyle(
                                            color: _otpSent
                                                ? Colors.white
                                                : const Color(0xFF9CA3AF),
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),

                                const SizedBox(height: 16),

                                // Resend OTP Section
                                if (_otpSent) ...[
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
                                            onTap:
                                                _isLoading ? null : _handleResendOTP,
                                            child: Text(
                                              'Resend OTP',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: _isLoading
                                                    ? const Color(0xFF9CA3AF)
                                                    : const Color(0xFF14B8A6),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 24),

                                // Back Button
                                Center(
                                  child: GestureDetector(
                                    onTap: widget.onBackTap,
                                    child: const Text(
                                      'Back to Sign Up',
                                      style: TextStyle(
                                        color: Color(0xFF6B7280),
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
