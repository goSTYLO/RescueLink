import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth_service.dart';

/// Second step: Enter OTP Code + Verify & Continue.
class VerificationOtpScreen extends StatefulWidget {
  final String phoneNumber;
  final Function(Map<String, dynamic>)? onVerifyAndContinue;
  final VoidCallback? onBack;
  final String? selectedBarangay;
  final String? cityRegion;

  const VerificationOtpScreen({
    super.key,
    required this.phoneNumber,
    this.onVerifyAndContinue,
    this.onBack,
    this.selectedBarangay,
    this.cityRegion,
  });

  @override
  State<VerificationOtpScreen> createState() => _VerificationOtpScreenState();
}

class _VerificationOtpScreenState extends State<VerificationOtpScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  int _resendCountdown = 30;
  bool _canResend = false;
  bool _isVerifying = false;
  final AuthService _authService = AuthService();

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
    for (final c in _controllers) c.dispose();
    for (final f in _focusNodes) f.dispose();
    super.dispose();
  }

  String get _otpCode => _controllers.map((c) => c.text).join();

  Future<void> _verifyOtp() async {
    if (_isVerifying || _otpCode.length != 6) return;

    print('🔐 Starting OTP verification with code: $_otpCode');
    setState(() => _isVerifying = true);

    try {
      // Validate OTP is exactly 6 digits
      if (_otpCode.length != 6 || !RegExp(r'^[0-9]{6}$').hasMatch(_otpCode)) {
        throw Exception('Invalid OTP format');
      }

      print('📱 Calling verifyOtpAndLocation...');
      final result = await _authService.verifyOtpAndLocation(
        otp: _otpCode,
        latitude: 16.043,
        longitude: 120.334,
      );

      print('📊 Verification result: $result');

      if (!mounted) {
        print('⚠️ Widget disposed, skipping callback');
        return;
      }

      if (result['success'] == true) {
        print('✅ OTP verification SUCCESSFUL, calling callback');
        // Call the callback with the result - ONLY on success
        if (widget.onVerifyAndContinue != null) {
          widget.onVerifyAndContinue!(result);
        }
      } else {
        print('❌ OTP verification FAILED: ${result['error']}');
        // DO NOT call callback on failure
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['error'] ?? 'Unable to verify the code. Please try again.'),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    } on FirebaseAuthException catch (e) {
      print('❌ FirebaseAuthException: ${e.code} - ${e.message}');
      if (mounted) {
        String errorMsg = 'The code you entered is incorrect. Please try again.';
        if (e.code == 'invalid-verification-code') {
          errorMsg = 'The verification code is incorrect. Please double-check and try again.';
        } else if (e.code == 'session-expired') {
          errorMsg = 'Your verification session has expired. Please request a new code.';
        } else if (e.code == 'invalid-verification-id') {
          errorMsg = 'Verification session not found. Please request a new code.';
        } else if (e.code == 'code-expired') {
          errorMsg = 'This code has expired. Please request a new one.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    } catch (e) {
      print('❌ Exception during OTP verification: $e');
      if (mounted) {
        String friendlyMsg = 'Unable to verify the code. Please try again.';
        if (e.toString().contains('Invalid OTP format')) {
          friendlyMsg = 'Please enter a valid 6-digit code.';
        } else if (e.toString().contains('network')) {
          friendlyMsg = 'Network error. Please check your connection and try again.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(friendlyMsg),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    } finally {
      if (mounted) {
        print('🔄 Setting verifying state to false');
        setState(() => _isVerifying = false);
      }
    }
  }

  Widget _buildLogo() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset('assets/logo/logo.png', width: 48, height: 48, fit: BoxFit.contain),
            const SizedBox(width: 8),
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Color(0xFF2563EB))),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Emergency Response & Safety',
          style: TextStyle(color: Color(0xFF6B7280), fontSize: 12),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final barangay = widget.selectedBarangay ?? 'Barangay Poblacion Oeste';
    final cityRegion = widget.cityRegion ?? 'Dagupan City, Pangasinan';

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.onBack != null) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    onPressed: widget.onBack,
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF374151)),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              _buildLogo(),
              const SizedBox(height: 20),
              SizedBox(
                height: 160,
                child: Image.asset(
                  'assets/images/verificationdone_illustration.png',
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Verification',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Confirm your identity and location',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 24),
              // Location Verified card (compact)
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
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: Color(0xFFFCE7F3),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.location_on, color: Color(0xFFEC4899), size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cityRegion,
                                style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                              ),
                              Text(
                                barangay,
                                style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 16),
                                  const SizedBox(width: 4),
                                  const Text(
                                    'Within city boundary',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF22C55E), fontWeight: FontWeight.w500),
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
              // Enter OTP Code card
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
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: Color(0xFFDBEAFE),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.phone_android, color: Color(0xFF2563EB), size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Enter OTP Code',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF111827),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Sent to ${widget.phoneNumber}',
                                style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(6, (i) {
                        return SizedBox(
                          width: 44,
                          child: TextField(
                            controller: _controllers[i],
                            focusNode: _focusNodes[i],
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            maxLength: 1,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                            ),
                            decoration: InputDecoration(
                              counterText: '',
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2),
                              ),
                            ),
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: _canResend
                              ? () {
                                  // Resend OTP
                                  _startResendTimer();
                                }
                              : null,
                          icon: const Icon(Icons.refresh, color: Color(0xFFEF4444), size: 20),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                        const SizedBox(width: 6),
                        TextButton(
                          onPressed: _canResend
                              ? () {
                                  _startResendTimer();
                                }
                              : null,
                          child: Text(
                            _canResend ? 'Resend OTP' : 'Resend OTP in ${_resendCountdown}s',
                            style: TextStyle(
                              fontSize: 13,
                              color: _canResend ? const Color(0xFFEF4444) : const Color(0xFF6B7280),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isVerifying || _otpCode.length != 6
                            ? null
                            : () async {
                                await _verifyOtp();
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEF4444),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isVerifying
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Verify & Continue',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Color(0xFF2563EB), size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: const Text(
                        'Verification ensures only Dagupan City residents can report emergencies',
                        style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF)),
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
