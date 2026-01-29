import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/app_flow/app_flow_bloc.dart';
import '../bloc/app_flow/app_flow_event.dart';

class AccountCreatedScreen extends StatelessWidget {
  final VoidCallback? onBackToLogin;
  final VoidCallback? onDone;

  const AccountCreatedScreen({
    super.key,
    this.onBackToLogin,
    this.onDone,
  });

  void _navigateBack(BuildContext context) {
    context.read<AppFlowBloc>().add(const BackToLogin());
    onBackToLogin?.call();
    onDone?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/images/accountcreateddone_-illustration.png',
                height: 180,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.check_circle, size: 80, color: Color(0xFF22C55E)),
              ),
              const SizedBox(height: 24),
              const Text(
                'Account Created!',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF22C55E)),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _navigateBack(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF22C55E),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Back to Login', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
