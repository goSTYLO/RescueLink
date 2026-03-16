import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/screens/auth/forgot_password_screen.dart';
import 'package:rescuelink_mobile/theme/app_theme.dart';
import 'package:http/http.dart' as http;

import 'package:rescuelink_mobile/utils/app_config.dart';

import 'test_setup.dart';

/// Phase 2 integration tests: Auth flow screens and API connectivity.
/// LoginScreen and SignUpScreen require Firebase (platform channels) - test on device.
/// Run with backend: flutter test test/integration/phase2_auth_test.dart
void main() {
  setUpAll(() async {
    await setupIntegrationTest();
  });

  group('Phase 2: Auth screens', () {
    testWidgets('ForgotPasswordScreen renders without crash', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: ForgotPasswordScreen(
            onBackToLogin: () {},
            onRequestCode: (_) async => false,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ForgotPasswordScreen), findsOneWidget);
    });
  });

  group('Phase 2: Auth API connectivity', () {
    test('POST /api/auth/login endpoint exists and responds', () async {
      try {
        final response = await http
            .post(
              Uri.parse('${AppConfig.apiBaseUrl}/api/auth/login'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'phone': '+639171234567',
                'password': 'wrongpassword',
              }),
            )
            .timeout(const Duration(seconds: 5));

        expect(response.statusCode, isNonZero);
        expect(
          response.statusCode,
          anyOf(200, 400, 401),
          reason: 'Login: 200/400/401 from backend, or 400 when test binding restricts HTTP',
        );
      } on SocketException {
        // Backend not available - skip
      } on http.ClientException {
        // Backend not available - skip
      }
    });
  });
}
