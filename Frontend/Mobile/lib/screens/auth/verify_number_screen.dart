import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../widgets/gradient_header.dart';

class VerifyNumberScreen extends StatefulWidget {
  final String phoneNumber;
  final VoidCallback? onBack;
  final Future<void> Function(String code)? onVerifyCode;
  final void Function()? onResendCode;

  const VerifyNumberScreen({
    super.key,
    required this.phoneNumber,
    this.onBack,
    this.onVerifyCode,
    this.onResendCode,
  });

  @override
  State<VerifyNumberScreen> createState() => _VerifyNumberScreenState();
}

class _VerifyNumberScreenState extends State<VerifyNumberScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _isLoading = false;
  int _resendSeconds = 40;

  @override
  void initState() {
    super.initState();
    _startResendTimer();
  }

  void _startResendTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() {
        if (_resendSeconds > 0) _resendSeconds--;
      });
      return _resendSeconds > 0;
    });
  }

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text).join();

  Future<void> _verifyCode() async {
    if (_code.length != 6 || widget.onVerifyCode == null) return;
    setState(() => _isLoading = true);
    await widget.onVerifyCode!(_code);
    if (!mounted) return;
    setState(() => _isLoading = false);
  }

  void _onCodeComplete() {
    if (_code.length == 6) _verifyCode();
  }

  Widget _buildLogo() {
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
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          GradientHeader(
            title: 'Verify Your Number',
            onBack: widget.onBack,
            transparentFade: true,
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    _buildLogo(),
                    const SizedBox(height: 20),
              SizedBox(
                height: 180,
                child: Image.asset(
                  'assets/images/verifynumber_illustration.png',
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 24),
              const SizedBox(height: 20),
              const Icon(Icons.shield_outlined, color: Color(0xFF2563EB), size: 32),
              const SizedBox(height: 8),
              Text(
                widget.phoneNumber,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 2))],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(6, (i) {
                    return SizedBox(
                      width: 44,
                      child: TextField(
                        controller: _controllers[i],
                        focusNode: _focusNodes[i],
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        maxLength: 1,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: InputDecoration(
                          counterText: '',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onChanged: (v) {
                          if (v.isNotEmpty && i < 5) FocusScope.of(context).requestFocus(_focusNodes[i + 1]);
                          if (v.isEmpty && i > 0) FocusScope.of(context).requestFocus(_focusNodes[i - 1]);
                          _onCodeComplete();
                        },
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Waiting for code', style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              const SizedBox(height: 4),
              Text(
                _resendSeconds > 0 ? 'Resend code in 00:${_resendSeconds.toString().padLeft(2, '0')}' : 'Resend code',
                style: TextStyle(
                  fontSize: 12,
                  color: _resendSeconds > 0 ? const Color(0xFF6B7280) : const Color(0xFFEF4444),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading || _code.length != 6 ? null : _verifyCode,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                        )
                      : const Text('Verify Code', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 40),
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
