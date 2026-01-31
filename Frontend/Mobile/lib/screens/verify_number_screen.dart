import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/app_flow/app_flow_bloc.dart';
import '../bloc/app_flow/app_flow_event.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/auth/auth_event.dart';
import '../bloc/auth/auth_state.dart';

class VerifyNumberScreen extends StatelessWidget {
  final String phoneNumber;
  final bool isRequestingOTP;
  final VoidCallback? onBack;
  final VoidCallback? onOTPSent;
  final void Function(String code)? onVerifyCode;

  const VerifyNumberScreen({
    super.key,
    required this.phoneNumber,
    this.isRequestingOTP = true,
    this.onBack,
    this.onOTPSent,
    this.onVerifyCode,
  });

  @override
  Widget build(BuildContext context) {
    if (isRequestingOTP) {
      return BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (previous, current) =>
            current is AuthError || (previous is AuthLoading && current is Unauthenticated),
        listener: (context, state) {
          if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
          } else if (state is Unauthenticated) {
            context.read<AppFlowBloc>().add(const SignUpPhoneOtpSent());
            onOTPSent?.call();
          }
        },
        builder: (context, state) {
          final isLoading = state is AuthLoading;
          return Scaffold(
            backgroundColor: const Color(0xFFF5F5F5),
            appBar: AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: onBack ?? () => context.read<AppFlowBloc>().add(const SignUpPhoneOtpBack()),
              ),
            ),
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Verify $phoneNumber', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: isLoading
                          ? null
                          : () => context.read<AuthBloc>().add(OtpRequested(phoneNumber)),
                      child: isLoading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Send OTP'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    }
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: onBack ?? () => context.read<AppFlowBloc>().add(const BackToLogin()),
        ),
      ),
      body: const Center(child: Text('Verify code (forgot flow)')),
    );
  }
}
