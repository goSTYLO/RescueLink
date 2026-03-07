import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../utils/app_config.dart';
import 'auth_service.dart';

class NotificationServiceException implements Exception {
  final String message;
  final int? statusCode;

  NotificationServiceException(this.message, {this.statusCode});

  @override
  String toString() => 'NotificationServiceException: $message';
}

class NotificationService {
  final AuthService _authService = AuthService();
  final http.Client _client = http.Client();

  Map<String, String> _headers() {
    final token = _authService.getToken();
    if (token == null || token.isEmpty) {
      throw NotificationServiceException('Authentication required. Please log in.');
    }

    return {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    };
  }

  Future<List<Map<String, dynamic>>> getNotifications({
    int limit = 50,
    int offset = 0,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/notifications?limit=$limit&offset=$offset');

    http.Response response;
    try {
      response = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
    } on SocketException {
      throw NotificationServiceException('Unable to connect to ${AppConfig.apiBaseUrl}.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationServiceException(
        _extractErrorMessage(response),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) {
      throw NotificationServiceException('Unexpected notifications response format from server.');
    }

    return decoded
        .whereType<Map>()
        .map((item) => item.cast<String, dynamic>())
        .toList();
  }

  String _extractErrorMessage(http.Response response) {
    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      if (decoded['message'] is String) {
        return decoded['message'] as String;
      }
      if (decoded['error'] is String) {
        return decoded['error'] as String;
      }
    } catch (_) {
      if (response.body.isNotEmpty) {
        return response.body;
      }
    }

    return 'Request failed with status ${response.statusCode}';
  }

  void close() {
    _client.close();
  }
}
