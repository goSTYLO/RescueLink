import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../utils/app_config.dart';
import 'auth_service.dart';

class ResponderServiceException implements Exception {
  final String message;
  final int? statusCode;
  ResponderServiceException(this.message, {this.statusCode});

  @override
  String toString() => 'ResponderServiceException: $message';
}

bool parseResponderOnlineFlag(dynamic value) {
  if (value == true) return true;
  if (value == false) return false;
  if (value is String) return value.toLowerCase() == 'true';
  return false;
}

/// Service wrapping all Phase 3 responder-specific API endpoints.
class ResponderService {
  final AuthService _auth = AuthService();
  final http.Client _client = http.Client();

  Map<String, String> _headers() {
    final token = _auth.getToken();
    if (token == null || token.isEmpty) {
      throw ResponderServiceException('Authentication required.');
    }
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  Future<Map<String, dynamic>> _handleResponse(http.Response res) async {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        return jsonDecode(res.body) as Map<String, dynamic>;
      } catch (_) {
        return {};
      }
    }
    String message = 'Request failed (${res.statusCode})';
    try {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      message = (body['error'] ?? body['message'] ?? message).toString();
    } catch (_) {}
    throw ResponderServiceException(message, statusCode: res.statusCode);
  }

  /// PATCH /api/responders/me/online-status
  Future<void> toggleOnlineStatus(
    bool online, {
    double? latitude,
    double? longitude,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responders/me/online-status');
    try {
      final body = <String, dynamic>{'online': online};
      if (latitude != null && longitude != null) {
        body['latitude'] = latitude;
        body['longitude'] = longitude;
      }
      final res = await _client
          .patch(uri, headers: _headers(), body: jsonEncode(body))
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/responders/me/profile
  Future<Map<String, dynamic>> getSelfProfile() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responders/me/profile');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/incidents/responder/active
  Future<List<Map<String, dynamic>>> getActiveIncidents() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/responder/active');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final list = jsonDecode(res.body);
        if (list is List) {
          return list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
        }
      }
      return [];
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/responders/me/assigned-incidents
  Future<List<Map<String, dynamic>>> getAssignedIncidents() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responders/me/assigned-incidents');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      final body = await _handleResponse(res);
      final list = body['incidents'];
      if (list is List) {
        return list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
      }
      return [];
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/responders/me/team
  Future<Map<String, dynamic>> getMyTeam() async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responders/me/team');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// PATCH /api/dispatches/me/status
  Future<void> updateMyDispatchStatus(int reportId, String status) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/dispatches/me/status');
    try {
      final res = await _client
          .patch(
            uri,
            headers: _headers(),
            body: jsonEncode({
              'report_id': reportId,
              'response_status': status,
            }),
          )
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/incidents/responder/history
  Future<List<Map<String, dynamic>>> getIncidentHistory({int page = 1}) async {
    final offset = (page - 1) * 20;
    final uri = Uri.parse(
        '${AppConfig.apiBaseUrl}/api/incidents/responder/history?limit=20&offset=$offset');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final list = jsonDecode(res.body);
        if (list is List) {
          return list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
        }
      }
      return [];
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/incidents/:id/responder-preview
  Future<Map<String, dynamic>> getIncidentPreview(int reportId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/responder-preview');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/accept
  Future<Map<String, dynamic>> acceptIncident(int reportId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/accept');
    try {
      final res = await _client
          .post(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/decline
  Future<void> declineIncident(int reportId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/decline');
    try {
      final res = await _client
          .post(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// PATCH /api/incidents/:id/responder-status
  Future<void> updateResponderStatus(int reportId, String status) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/responder-status');
    try {
      final res = await _client
          .patch(uri, headers: _headers(), body: jsonEncode({'status': status}))
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/backup
  Future<Map<String, dynamic>> requestBackup(int reportId, String target, {String? notes}) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup');
    try {
      final body = <String, dynamic>{'target': target};
      if (notes != null && notes.isNotEmpty) body['notes'] = notes;
      final res = await _client
          .post(uri, headers: _headers(), body: jsonEncode(body))
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/backup/:backupId/join
  Future<Map<String, dynamic>> joinBackup(int reportId, int backupId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup/$backupId/join');
    try {
      final res = await _client
          .post(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      return await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/backup/:backupId/decline
  Future<void> declineBackup(int reportId, int backupId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup/$backupId/decline');
    try {
      final res = await _client
          .post(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// POST /api/incidents/:id/backup/:backupId/withdraw
  Future<void> withdrawBackup(int reportId, int backupId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup/$backupId/withdraw');
    try {
      final res = await _client
          .post(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// PATCH /api/incidents/:id/backup/:backupId/responder-status
  Future<void> updateBackupResponderStatus(int reportId, int backupId, String status) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup/$backupId/responder-status');
    try {
      final res = await _client
          .patch(uri, headers: _headers(), body: jsonEncode({'status': status}))
          .timeout(AppConfig.apiTimeout);
      await _handleResponse(res);
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  /// GET /api/incidents/:id/backup (dispatcher view)
  Future<List<Map<String, dynamic>>> getBackupRequests(int reportId) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/backup');
    try {
      final res = await _client
          .get(uri, headers: _headers())
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final list = jsonDecode(res.body);
        if (list is List) {
          return list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
        }
      }
      return [];
    } on SocketException {
      throw ResponderServiceException('No connection.');
    }
  }

  void close() => _client.close();
}
