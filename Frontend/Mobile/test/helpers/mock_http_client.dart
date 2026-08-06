import 'dart:convert';
import 'package:http/http.dart' as http;

/// A mock HTTP client for integration tests that returns predetermined responses.
/// Use this to verify API connectivity without hitting a real backend.
class MockHttpClient extends http.BaseClient {
  final Map<String, http.StreamedResponse> _responses = {};
  final List<http.BaseRequest> requests = [];

  void addResponse(String method, String path, int statusCode, dynamic body) {
    final key = '$method $path';
    _responses[key] = http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      statusCode,
      headers: {'content-type': 'application/json'},
    );
  }

  void addLoginResponse() {
    addResponse('POST', '/api/auth/login', 200, {
      'success': true,
      'token': 'test-jwt-token',
      'user': {'id': 1, 'phone': '+639171234567'},
    });
  }

  void addProfileResponse() {
    addResponse('GET', '/api/auth/me', 200, {
      'success': true,
      'user': {
        'id': 1,
        'firstName': 'Test',
        'lastName': 'User',
        'phone': '+639171234567',
        'address': 'Barangay Poblacion Oeste',
      },
    });
  }

  void addIncidentsResponse() {
    addResponse('GET', '/api/incidents/user/my', 200, {
      'incidents': [],
      'total': 0,
    });
  }

  void addNotificationsResponse() {
    addResponse('GET', '/api/notifications', 200, []);
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final path = request.url.path;
    final key = '${request.method} $path';
    if (_responses.containsKey(key)) {
      return _responses[key]!;
    }
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode({'error': 'Not mocked: $key'}))),
      404,
      headers: {'content-type': 'application/json'},
    );
  }
}
