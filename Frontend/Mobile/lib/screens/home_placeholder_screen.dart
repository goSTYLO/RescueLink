import 'package:flutter/material.dart';

class HomePlaceholderScreen extends StatelessWidget {
  final VoidCallback onLogout;

  const HomePlaceholderScreen({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RescueLink'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: onLogout,
          ),
        ],
      ),
      body: const Center(
        child: Text('Welcome! You are verified.', style: TextStyle(fontSize: 18)),
      ),
    );
  }
}
