import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import '../utils/app_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class IncidentService {
  final ApiService _apiService = ApiService();
  final AuthService _authService = AuthService();
  final http.Client _client = http.Client();

  String _newRequestId() {
    final randomPart = Random().nextInt(1 << 32).toRadixString(16);
    return 'mobile-${DateTime.now().millisecondsSinceEpoch}-$randomPart';
  }

  void _logInfo(String message) {
    if (!kReleaseMode) {
      debugPrint(message);
    }
  }

  void _logError(String message) {
    debugPrint(message);
  }

  Map<String, String> _authHeaders() {
    final token = _authService.getToken();
    if (token == null || token.isEmpty) {
      throw IncidentServiceException('Authentication required. Please log in.');
    }
    return {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    };
  }

  /// Report emergency (no AI): get current location and POST to /api/incidents/emergency.
  /// Returns response map with success, message, incident.
  /// Throws on location failure or API error.
  Future<Map<String, dynamic>> reportEmergency() async {
    final requestId = _newRequestId();
    final stopwatch = Stopwatch()..start();
    final location = await _authService.getCurrentLocation();
    if (location['success'] != true) {
      _logError('[mobile][incident][reportEmergency] request_id=$requestId status=location_failed');
      throw IncidentServiceException(
        location['error'] as String? ?? 'Failed to get location.',
      );
    }
    final lat = location['latitude'] as num?;
    final lng = location['longitude'] as num?;
    if (lat == null || lng == null) {
      _logError('[mobile][incident][reportEmergency] request_id=$requestId status=invalid_location');
      throw IncidentServiceException('Invalid location data.');
    }

    try {
      final response = await _apiService.post(
        '/api/incidents/emergency',
        body: {
          'latitude': lat.toDouble(),
          'longitude': lng.toDouble(),
        },
        headers: {
          ..._authHeaders(),
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
      );
      stopwatch.stop();
      _logInfo('[mobile][incident][reportEmergency] request_id=$requestId status=success latency_ms=${stopwatch.elapsedMilliseconds}');
      return response;
    } catch (error) {
      stopwatch.stop();
      _logError('[mobile][incident][reportEmergency] request_id=$requestId status=error latency_ms=${stopwatch.elapsedMilliseconds} error=$error');
      rethrow;
    }
  }

  /// Report incident with audio (AI-enhanced). Requires audio file; media files optional.
  /// [audioBytes] and [audioFilename] are required (e.g. .m4a, .wav).
  /// [mediaFiles] optional list of { bytes: Uint8List, filename: String }.
  Future<Map<String, dynamic>> reportWithAudio({
    required double latitude,
    required double longitude,
    String? description,
    required List<int> audioBytes,
    required String audioFilename,
    List<({List<int> bytes, String filename})>? mediaFiles,
  }) async {
    final requestId = _newRequestId();
    final stopwatch = Stopwatch()..start();
    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/incidents/with-audio');
    final request = http.MultipartRequest('POST', uri);

    request.headers.addAll({
      ..._authHeaders(),
      'x-request-id': requestId,
    });
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();
    if (description != null && description.isNotEmpty) {
      request.fields['description'] = description;
    }

    request.files.add(http.MultipartFile.fromBytes(
      'audio',
      audioBytes,
      filename: audioFilename,
    ));

    if (mediaFiles != null && mediaFiles.isNotEmpty) {
      for (final m in mediaFiles) {
        request.files.add(http.MultipartFile.fromBytes(
          'media',
          m.bytes,
          filename: m.filename,
        ));
      }
    }

    _logInfo('[mobile][incident][reportWithAudio] request_id=$requestId status=start url=$uri audio_bytes=${audioBytes.length} media_count=${mediaFiles?.length ?? 0} timeout_s=${AppConfig.apiTimeout.inSeconds}');

    http.StreamedResponse streamedResponse;
    http.Response response;
    try {
      streamedResponse = await request.send().timeout(AppConfig.apiTimeout);
      response = await http.Response.fromStream(streamedResponse).timeout(AppConfig.apiTimeout);
      stopwatch.stop();
    } on TimeoutException {
      stopwatch.stop();
      _logError('[mobile][incident][reportWithAudio] request_id=$requestId status=timeout latency_ms=${stopwatch.elapsedMilliseconds} url=$uri');
      throw IncidentServiceException(
        'Connection timed out while uploading audio. Check API_BASE_URL (${AppConfig.apiBaseUrl}) and network connectivity.',
      );
    } on SocketException catch (error) {
      stopwatch.stop();
      _logError('[mobile][incident][reportWithAudio] request_id=$requestId status=socket_error latency_ms=${stopwatch.elapsedMilliseconds} url=$uri error=$error');
      throw IncidentServiceException(
        'Unable to connect to server at ${AppConfig.apiBaseUrl}. If using a real device, set API_BASE_URL to your PC LAN IP.',
      );
    } on http.ClientException catch (error) {
      stopwatch.stop();
      _logError('[mobile][incident][reportWithAudio] request_id=$requestId status=client_error latency_ms=${stopwatch.elapsedMilliseconds} url=$uri error=$error');
      throw IncidentServiceException('Network request failed: ${error.message}');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      _logInfo('[mobile][incident][reportWithAudio] request_id=$requestId status=${response.statusCode} latency_ms=${stopwatch.elapsedMilliseconds}');
      if (response.body.isEmpty) return {};
      return jsonDecode(response.body) as Map<String, dynamic>;
    }

    String errorMessage = 'Request failed with status ${response.statusCode}';
    try {
      final errorBody = jsonDecode(response.body) as Map<String, dynamic>;
      if (errorBody.containsKey('error')) {
        errorMessage = errorBody['error'] as String;
      } else if (errorBody.containsKey('message')) {
        errorMessage = errorBody['message'] as String;
      }
    } catch (_) {
      if (response.body.isNotEmpty) errorMessage = response.body;
    }
    _logError('[mobile][incident][reportWithAudio] request_id=$requestId status=${response.statusCode} latency_ms=${stopwatch.elapsedMilliseconds} error=$errorMessage');
    throw IncidentServiceException(errorMessage, statusCode: response.statusCode);
  }

  /// Get current user's incidents. Optional [limit] and [offset] for pagination.
  /// Backend returns a JSON array directly.
  Future<List<dynamic>> getMyIncidents({int? limit, int? offset}) async {
    var path = '/api/incidents/user/my';
    if (limit != null || offset != null) {
      final params = <String>[];
      if (limit != null) params.add('limit=$limit');
      if (offset != null) params.add('offset=$offset');
      path = '$path?${params.join('&')}';
    }
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$path');
    final response = await _client.get(uri, headers: _authHeaders());

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String msg = 'Request failed with status ${response.statusCode}';
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body.containsKey('error')) msg = body['error'] as String;
      } catch (_) {}
      throw IncidentServiceException(msg, statusCode: response.statusCode);
    }

    final decoded = jsonDecode(response.body);
    if (decoded is List) return decoded;
    if (decoded is Map && decoded['data'] is List) return decoded['data'] as List;
    if (decoded is Map && decoded['incidents'] is List) return decoded['incidents'] as List;
    return [];
  }

  /// Get incident by ID. Set [withAi] true for AI classification details.
  Future<Map<String, dynamic>> getIncidentById(int reportId, {bool withAi = false}) async {
    final requestId = _newRequestId();
    final stopwatch = Stopwatch()..start();
    final endpoint = withAi
        ? '/api/incidents/$reportId/with-ai'
        : '/api/incidents/$reportId';
    try {
      final response = await _apiService.get(endpoint, headers: {
        ..._authHeaders(),
        'x-request-id': requestId,
      });
      stopwatch.stop();
      _logInfo('[mobile][incident][getIncidentById] request_id=$requestId report_id=$reportId status=success latency_ms=${stopwatch.elapsedMilliseconds}');
      return response;
    } catch (error) {
      stopwatch.stop();
      _logError('[mobile][incident][getIncidentById] request_id=$requestId report_id=$reportId status=error latency_ms=${stopwatch.elapsedMilliseconds} error=$error');
      rethrow;
    }
  }

  void close() {
    _client.close();
  }
}

class IncidentServiceException implements Exception {
  final String message;
  final int? statusCode;

  IncidentServiceException(this.message, {this.statusCode});

  @override
  String toString() => 'IncidentServiceException: $message';
}
