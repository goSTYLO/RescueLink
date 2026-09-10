import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../utils/app_config.dart';
import 'auth_service.dart';

/// Department-admin / department-head APIs for the mobile ops tab.
class DepartmentOpsService {
  final AuthService _auth = AuthService();
  final http.Client _client = http.Client();

  Map<String, String> _headers() {
    final token = _auth.getToken();
    if (token == null || token.isEmpty) {
      throw DepartmentOpsException('Authentication required. Please log in.');
    }
    return {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
  }

  List<Map<String, dynamic>> _asMapList(dynamic decoded) {
    if (decoded is List) {
      return decoded
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
    }
    if (decoded is Map) {
      final nested = decoded['incidents'] ?? decoded['teams'] ?? decoded['data'] ?? decoded['rows'];
      if (nested is List) {
        return nested
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
      }
    }
    return [];
  }

  /// GET /api/incidents — backend scopes to the caller's department.
  Future<List<Map<String, dynamic>>> listDepartmentIncidents({
    int limit = 50,
    int offset = 0,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents').replace(
      queryParameters: {
        'limit': '$limit',
        'offset': '$offset',
        'exclude_duplicates': 'true',
      },
    );
    try {
      final res = await _client.get(uri, headers: _headers()).timeout(AppConfig.apiTimeout);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw DepartmentOpsException(
          _errorMessage(res),
          statusCode: res.statusCode,
        );
      }
      return _asMapList(jsonDecode(res.body));
    } on SocketException {
      throw DepartmentOpsException('No connection.');
    }
  }

  /// GET /api/responders/teams
  Future<List<Map<String, dynamic>>> listTeams({String? departmentCode}) async {
    final params = <String, String>{'limit': '200'};
    if (departmentCode != null && departmentCode.isNotEmpty) {
      params['department_code'] = departmentCode;
    }
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responders/teams')
        .replace(queryParameters: params);
    try {
      final res = await _client.get(uri, headers: _headers()).timeout(AppConfig.apiTimeout);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw DepartmentOpsException(
          _errorMessage(res),
          statusCode: res.statusCode,
        );
      }
      return _asMapList(jsonDecode(res.body));
    } on SocketException {
      throw DepartmentOpsException('No connection.');
    }
  }

  /// POST /api/dispatches with department + team.
  Future<Map<String, dynamic>> assignTeam({
    required int reportId,
    required String departmentCode,
    String? departmentName,
    required String teamName,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/dispatches');
    try {
      final res = await _client
          .post(
            uri,
            headers: _headers(),
            body: jsonEncode({
              'report_id': reportId,
              'department_code': departmentCode,
              if (departmentName != null) 'department_name': departmentName,
              'team_name': teamName,
              'response_status': 'assigned',
            }),
          )
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw DepartmentOpsException(
          _errorMessage(res),
          statusCode: res.statusCode,
        );
      }
      return _asMap(jsonDecode(res.body));
    } on SocketException {
      throw DepartmentOpsException('No connection.');
    }
  }

  /// POST /api/dispatches/reassign-team (reason ≥ 10 chars).
  Future<Map<String, dynamic>> reassignTeam({
    required int reportId,
    required String departmentCode,
    required String teamName,
    required String reason,
  }) async {
    final trimmed = reason.trim();
    if (!isValidReassignReason(trimmed)) {
      throw DepartmentOpsException(
        'A reassign reason with at least 10 characters is required',
      );
    }
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/dispatches/reassign-team');
    try {
      final res = await _client
          .post(
            uri,
            headers: _headers(),
            body: jsonEncode({
              'report_id': reportId,
              'department_code': departmentCode,
              'team_name': teamName,
              'reason': trimmed,
            }),
          )
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw DepartmentOpsException(
          _errorMessage(res),
          statusCode: res.statusCode,
        );
      }
      return _asMap(jsonDecode(res.body));
    } on SocketException {
      throw DepartmentOpsException('No connection.');
    }
  }

  /// PATCH /api/incidents/:id/status → resolved (dept-admin/head).
  Future<Map<String, dynamic>> resolveIncident(int reportId) async {
    final uri =
        Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/$reportId/status');
    try {
      final res = await _client
          .patch(
            uri,
            headers: _headers(),
            body: jsonEncode({'status': 'resolved'}),
          )
          .timeout(AppConfig.apiTimeout);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw DepartmentOpsException(
          _errorMessage(res),
          statusCode: res.statusCode,
        );
      }
      return _asMap(jsonDecode(res.body));
    } on SocketException {
      throw DepartmentOpsException('No connection.');
    }
  }

  Map<String, dynamic> _asMap(dynamic decoded) {
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return decoded.cast<String, dynamic>();
    return {};
  }

  String _errorMessage(http.Response res) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map) {
        return (body['error'] ?? body['message'] ?? 'Request failed').toString();
      }
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  void close() => _client.close();
}

/// Backend requires ≥10 characters for reassign-team reason.
bool isValidReassignReason(String? reason) =>
    (reason?.trim().length ?? 0) >= 10;

class DepartmentOpsException implements Exception {
  final String message;
  final int? statusCode;
  DepartmentOpsException(this.message, {this.statusCode});
  @override
  String toString() => message;
}
