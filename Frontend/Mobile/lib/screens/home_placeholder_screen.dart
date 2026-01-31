import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/app_flow/app_flow_bloc.dart';
import '../bloc/app_flow/app_flow_event.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/auth/auth_event.dart';

class HomePlaceholderScreen extends StatelessWidget {
  final VoidCallback? onLogout;

  const HomePlaceholderScreen({super.key, this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RescueLink'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: onLogout ??
                () {
                  context.read<AuthBloc>().add(const LogoutRequested());
                  context.read<AppFlowBloc>().add(const BackToLogin());
                },
          ),
        ],
      ),
      body: const Center(
        child: Text('Home - Dashboard placeholder'),
      ),
    );
  }
}
