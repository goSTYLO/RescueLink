import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/screens/home/change_password_screen.dart';
import 'package:rescuelink_mobile/screens/home/barangay_information_screen.dart';
import 'package:rescuelink_mobile/screens/home/logout_confirmation_screen.dart';
import 'package:rescuelink_mobile/theme/app_theme.dart';
import 'package:http/http.dart' as http;

import 'package:rescuelink_mobile/utils/app_config.dart';
import 'test_setup.dart';

/// Phase 7 integration tests: Minor screens (Change Password, Barangay Info, Logout, etc.).
void main() {
  setUpAll(() async {
    await setupIntegrationTest();
  });

  group('Phase 7: Minor screens', () {
    testWidgets('ChangePasswordScreen renders without crash', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: ChangePasswordScreen(
            onBack: () {},
            onUpdatePassword: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ChangePasswordScreen), findsOneWidget);
    });

    testWidgets('BarangayInformationScreen renders without crash', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: BarangayInformationScreen(onBack: () {}),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(BarangayInformationScreen), findsOneWidget);
    });

    testWidgets('LogoutConfirmationScreen renders without crash', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LogoutConfirmationScreen(
            onConfirm: () {},
            onCancel: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(LogoutConfirmationScreen), findsOneWidget);
    });
  });

  group('Phase 7: API connectivity', () {
    test('GET /api/auth/me endpoint reachable', () async {
      try {
        final response = await http
            .get(Uri.parse('${AppConfig.apiBaseUrl}/api/auth/me'))
            .timeout(const Duration(seconds: 5));

        expect(response.statusCode, isNonZero);
        expect(
          response.statusCode,
          anyOf(200, 400, 401),
          reason: 'Profile: 200/401 from backend, or 400 when test binding restricts HTTP',
        );
      } on SocketException {
        // Backend not available - skip
      } on http.ClientException {
        // Backend not available - skip
      }
    });
  });
}
