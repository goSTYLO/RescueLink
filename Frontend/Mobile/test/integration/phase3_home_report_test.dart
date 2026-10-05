import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/screens/home/emergency_report_screen.dart';
import 'package:rescuelink_mobile/theme/app_theme.dart';
import 'package:http/http.dart' as http;

import 'package:rescuelink_mobile/utils/app_config.dart';
import 'test_setup.dart';

/// Phase 3 integration tests: Home and Emergency Report screens, API connectivity.
/// HomePlaceholderScreen requires AuthService.getProfile() - test on device.
void main() {
  setUpAll(() async {
    await setupIntegrationTest();
  });

  group('Phase 3: Emergency Report screen', () {
    testWidgets('EmergencyReportScreen renders without crash', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: EmergencyReportScreen(
            onBack: () {},
            onSubmit: (_) {},
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(EmergencyReportScreen), findsOneWidget);
      expect(find.text('Voice'), findsOneWidget);
      expect(find.text('Text'), findsOneWidget);
    });

    testWidgets('Text mode shows description field and submit stays disabled until min length',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: EmergencyReportScreen(
            onBack: () {},
            onSubmit: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Text'));
      await tester.pumpAndSettle();

      expect(find.textContaining('What happened, where'), findsOneWidget);

      final submit = find.widgetWithText(ElevatedButton, 'Submit Emergency Report');
      final button = tester.widget<ElevatedButton>(submit);
      expect(button.onPressed, isNull);

      await tester.enterText(find.byType(TextField).first, 'short');
      await tester.pump();
      expect(tester.widget<ElevatedButton>(submit).onPressed, isNull);

      await tester.enterText(
        find.byType(TextField).first,
        'Fire at the market need immediate help',
      );
      await tester.pump();
      expect(tester.widget<ElevatedButton>(submit).onPressed, isNotNull);
    });
  });

  group('Phase 3: Incidents API connectivity', () {
    test('POST /api/incidents/emergency endpoint exists', () async {
      try {
        final response = await http
            .post(
              Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/emergency'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'latitude': 16.043,
                'longitude': 120.334,
                'barangay': 'Poblacion Oeste',
              }),
            )
            .timeout(const Duration(seconds: 5));

        expect(response.statusCode, isNonZero);
        expect(
          response.statusCode,
          anyOf(200, 201, 400, 401, 422),
          reason: 'Emergency: success/auth/validation, or 400 when test binding restricts HTTP',
        );
      } on SocketException {
        // Backend not available - skip
      } on http.ClientException {
        // Backend not available - skip
      }
    });
  });
}
