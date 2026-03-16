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

  /// Marks all notifications as read for the current user.
  Future<int> markAllAsRead() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/notifications/mark-all-read');

    http.Response response;
    try {
      response = await _client
          .post(uri, headers: _headers())
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

    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final marked = decoded['marked'];
      return marked is int ? marked : 0;
    } catch (_) {
      return 0;
    }
  }

  /// Fetches unread notification count for badge display.
  Future<int> getUnreadCount() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/notifications/unread-count');

    http.Response response;
    try {
      response = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
    } on SocketException {
      return 0;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return 0;
    }

    try {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final count = decoded['count'];
      return count is int ? count : 0;
    } catch (_) {
      return 0;
    }
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
