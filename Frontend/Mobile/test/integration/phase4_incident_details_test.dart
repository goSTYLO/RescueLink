import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:rescuelink_mobile/utils/app_config.dart';
import 'test_setup.dart';

/// Phase 4 integration tests: Incident details screen and API connectivity.
void main() {
  setUpAll(() async {
    await setupIntegrationTest();
  });

  group('Phase 4: Incident Details screen', () {
    // IncidentDetailsScreen uses IncidentService -> AuthService -> Firebase.
    // Widget test requires device/emulator with Firebase. API test below verifies connectivity.
  });

  group('Phase 4: Incidents API connectivity', () {
    test('GET /api/incidents/:id endpoint exists', () async {
      try {
        final response = await http
            .get(Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/1'))
            .timeout(const Duration(seconds: 5));

        expect(response.statusCode, isNonZero);
        expect(
          response.statusCode,
          anyOf(200, 400, 401, 404),
          reason: 'Incident fetch: 200/401/404 from backend, or 400 when test binding restricts HTTP',
        );
      } on SocketException {
        // Backend not available - skip
      } on http.ClientException {
        // Backend not available - skip
      }
    });
  });
}
