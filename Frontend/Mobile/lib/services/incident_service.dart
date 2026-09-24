import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:flutter/foundation.dart';
import '../utils/app_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class IncidentFileDownload {
  final List<int> bytes;
  final String filename;
  final String? contentType;

  const IncidentFileDownload({
    required this.bytes,
    required this.filename,
    this.contentType,
  });
}

/// Duplicate detection info from API response (when report matches existing incident).  
/// UI should show a confirmation dialog when [isDuplicate] or [flaggedForReview] is true.
class DuplicateInfo {
  final bool isDuplicate;
  final int? parentReportId;
  final double? confidence;
  final bool flaggedForReview;

  const DuplicateInfo({
    required this.isDuplicate,
    this.parentReportId,
    this.confidence,
    this.flaggedForReview = false,
  });

  static DuplicateInfo? fromResponse(Map<String, dynamic> response) {
    final raw = response['duplicate_info'];
    if (raw == null || raw is! Map) return null;
    final m = raw as Map<String, dynamic>;
    return DuplicateInfo(
      isDuplicate: m['is_duplicate'] == true,
      parentReportId: (m['parent_report_id'] as num?)?.toInt(),
      confidence: (m['confidence'] as num?)?.toDouble(),
      flaggedForReview: m['flagged_for_review'] == true,
    );
  }

  bool get shouldShowDialog => isDuplicate || flaggedForReview;
}

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

  MediaType? _mediaContentType(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return MediaType('image', 'jpeg');
    }
    if (lower.endsWith('.png')) return MediaType('image', 'png');
    if (lower.endsWith('.mp4')) return MediaType('video', 'mp4');
    if (lower.endsWith('.mov')) return MediaType('video', 'quicktime');
    if (lower.endsWith('.avi')) return MediaType('video', 'x-msvideo');
    return null;
  }

  /// Report emergency (no AI): get current location and POST to /api/incidents/emergency.
  /// Returns response map with success, message, incident.
  /// Throws on location failure or API error.
  Future<Map<String, dynamic>> reportEmergency() async {
    final requestId = _newRequestId();
    final stopwatch = Stopwatch()..start();
    final location = await _authService.getCurrentLocation();
    if (location['success'] != true) {
      _logError(
          '[mobile][incident][reportEmergency] request_id=$requestId status=location_failed');
      throw IncidentServiceException(
        location['error'] as String? ?? 'Failed to get location.',
      );
    }
    final lat = location['latitude'] as num?;
    final lng = location['longitude'] as num?;
    if (lat == null || lng == null) {
      _logError(
          '[mobile][incident][reportEmergency] request_id=$requestId status=invalid_location');
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
      _logInfo(
          '[mobile][incident][reportEmergency] request_id=$requestId status=success latency_ms=${stopwatch.elapsedMilliseconds}');
      return response;
    } catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][reportEmergency] request_id=$requestId status=error latency_ms=${stopwatch.elapsedMilliseconds} error=$error');
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
        final contentType = _mediaContentType(m.filename);
        request.files.add(http.MultipartFile.fromBytes(
          'media',
          m.bytes,
          filename: m.filename,
          contentType: contentType,
        ));
      }
    }

    _logInfo(
        '[mobile][incident][reportWithAudio] request_id=$requestId status=start url=$uri audio_bytes=${audioBytes.length} media_count=${mediaFiles?.length ?? 0} timeout_s=${AppConfig.apiTimeout.inSeconds}');

    http.StreamedResponse streamedResponse;
    http.Response response;
    try {
      streamedResponse = await request.send().timeout(AppConfig.apiTimeout);
      response = await http.Response.fromStream(streamedResponse)
          .timeout(AppConfig.apiTimeout);
      stopwatch.stop();
    } on TimeoutException {
      stopwatch.stop();
      _logError(
          '[mobile][incident][reportWithAudio] request_id=$requestId status=timeout latency_ms=${stopwatch.elapsedMilliseconds} url=$uri');
      throw IncidentServiceException(
        'Connection timed out while uploading audio. Check API_BASE_URL (${AppConfig.apiBaseUrl}) and network connectivity.',
      );
    } on SocketException catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][reportWithAudio] request_id=$requestId status=socket_error latency_ms=${stopwatch.elapsedMilliseconds} url=$uri error=$error');
      throw IncidentServiceException(
        'Unable to connect to server at ${AppConfig.apiBaseUrl}. If using a real device, set API_BASE_URL to your PC LAN IP.',
      );
    } on http.ClientException catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][reportWithAudio] request_id=$requestId status=client_error latency_ms=${stopwatch.elapsedMilliseconds} url=$uri error=$error');
      throw IncidentServiceException(
          'Network request failed: ${error.message}');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      _logInfo(
          '[mobile][incident][reportWithAudio] request_id=$requestId status=${response.statusCode} latency_ms=${stopwatch.elapsedMilliseconds}');
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
    _logError(
        '[mobile][incident][reportWithAudio] request_id=$requestId status=${response.statusCode} latency_ms=${stopwatch.elapsedMilliseconds} error=$errorMessage');
    throw IncidentServiceException(errorMessage,
        statusCode: response.statusCode);
  }

  /// Get current user's incidents. Optional [limit], [offset] for pagination;
  /// [status] and [incidentType] for filtering. Backend returns a JSON array.
  Future<List<dynamic>> getMyIncidents({
    int? limit,
    int? offset,
    String? status,
    String? incidentType,
    String? involvement,
  }) async {
    var path = '/api/incidents/user/my';
    final params = <String>[];
    if (limit != null) params.add('limit=$limit');
    if (offset != null) params.add('offset=$offset');
    if (status != null && status.isNotEmpty) params.add('status=${Uri.encodeComponent(status)}');
    if (incidentType != null && incidentType.isNotEmpty) params.add('incident_type=${Uri.encodeComponent(incidentType)}');
    if (involvement != null && involvement.isNotEmpty) {
      params.add('involvement=${Uri.encodeComponent(involvement)}');
    }
    if (params.isNotEmpty) path = '$path?${params.join('&')}';
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
    List<dynamic> result;
    if (decoded is List) {
      result = decoded;
    } else if (decoded is Map && decoded['data'] is List) {
      result = decoded['data'] as List;
    } else if (decoded is Map && decoded['incidents'] is List) {
      result = decoded['incidents'] as List;
    } else {
      throw IncidentServiceException(
        'Unexpected incidents response format from server.',
        statusCode: response.statusCode,
      );
    }
    return result;
  }

  /// Get incident by ID. Set [withAi] true for AI classification details.
  Future<Map<String, dynamic>> getIncidentById(int reportId,
      {bool withAi = false}) async {
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
      _logInfo(
          '[mobile][incident][getIncidentById] request_id=$requestId report_id=$reportId status=success latency_ms=${stopwatch.elapsedMilliseconds}');
      return response;
    } on ApiException catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][getIncidentById] request_id=$requestId report_id=$reportId status=api_error latency_ms=${stopwatch.elapsedMilliseconds} error=${error.message}');
      throw IncidentServiceException(
        error.message,
        statusCode: error.statusCode,
      );
    } catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][getIncidentById] request_id=$requestId report_id=$reportId status=error latency_ms=${stopwatch.elapsedMilliseconds} error=$error');
      throw IncidentServiceException('Failed to load incident details.');
    }
  }

  /// Get incident details with graceful fallback:
  /// try `/with-ai`, then plain `/api/incidents/:id` if endpoint is unavailable.
  Future<Map<String, dynamic>> getIncidentWithAiFallback(int reportId) async {
    try {
      final withAiData = await getIncidentById(reportId, withAi: true);
      if (withAiData.containsKey('incident')) {
        return withAiData;
      }
      return {
        'incident': withAiData,
        'ai_classification': null,
      };
    } on IncidentServiceException catch (error) {
      // Only treat 404 as "with-ai endpoint unavailable".
      if (error.statusCode != 404) {
        rethrow;
      }
      final incident = await getIncidentById(reportId, withAi: false);
      return {
        'incident': incident,
        'ai_classification': null,
      };
    }
  }

  Future<IncidentFileDownload> downloadIncidentAudio(int reportId) async {
    return _downloadIncidentBinary(
      endpoint: '/api/incidents/$reportId/audio',
      fallbackFilename: 'incident_${reportId}_audio.wav',
    );
  }

  Future<IncidentFileDownload> downloadIncidentMedia(
    int reportId,
    int mediaIndex,
  ) async {
    return _downloadIncidentBinary(
      endpoint: '/api/incidents/$reportId/media/$mediaIndex',
      fallbackFilename: 'incident_${reportId}_media_$mediaIndex',
    );
  }

  Future<IncidentFileDownload> _downloadIncidentBinary({
    required String endpoint,
    required String fallbackFilename,
  }) async {
    final requestId = _newRequestId();
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$endpoint');
    final stopwatch = Stopwatch()..start();

    http.Response response;
    try {
      response = await _client
          .get(uri, headers: {
            ..._authHeaders(),
            'x-request-id': requestId,
          })
          .timeout(AppConfig.apiTimeout);
      stopwatch.stop();
    } on TimeoutException {
      stopwatch.stop();
      throw IncidentServiceException('Download timed out. Please try again.');
    } on SocketException {
      stopwatch.stop();
      throw IncidentServiceException(
        'Unable to connect to server at ${AppConfig.apiBaseUrl}.',
      );
    } catch (_) {
      stopwatch.stop();
      throw IncidentServiceException('Failed to download incident file.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String errorMessage =
          'Download failed with status ${response.statusCode}.';
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['message'] is String) {
          errorMessage = body['message'] as String;
        } else if (body['error'] is String) {
          errorMessage = body['error'] as String;
        }
      } catch (_) {
        if (response.body.isNotEmpty) {
          errorMessage = response.body;
        }
      }
      _logError(
          '[mobile][incident][download] request_id=$requestId endpoint=$endpoint status=${response.statusCode} latency_ms=${stopwatch.elapsedMilliseconds} error=$errorMessage');
      throw IncidentServiceException(
        errorMessage,
        statusCode: response.statusCode,
      );
    }

    final contentType = response.headers['content-type'];
    final disposition = response.headers['content-disposition'];
    final filename = _filenameFromContentDisposition(disposition) ??
        _filenameWithExtensionFallback(fallbackFilename, contentType);

    return IncidentFileDownload(
      bytes: response.bodyBytes,
      filename: filename,
      contentType: contentType,
    );
  }

  String? _filenameFromContentDisposition(String? value) {
    if (value == null || value.isEmpty) {
      return null;
    }
    final lower = value.toLowerCase();
    if (!lower.contains('filename=')) {
      return null;
    }
    final parts = value.split(';');
    for (final part in parts) {
      final trimmed = part.trim();
      if (trimmed.toLowerCase().startsWith('filename=')) {
        return trimmed.substring(9).replaceAll('"', '');
      }
    }
    return null;
  }

  String _filenameWithExtensionFallback(String fallback, String? contentType) {
    if (contentType == null) {
      return fallback;
    }
    if (fallback.contains('.')) {
      return fallback;
    }
    if (contentType.contains('audio/mpeg')) {
      return '$fallback.mp3';
    }
    if (contentType.contains('audio/wav')) {
      return '$fallback.wav';
    }
    if (contentType.contains('image/jpeg')) {
      return '$fallback.jpg';
    }
    if (contentType.contains('image/png')) {
      return '$fallback.png';
    }
    if (contentType.contains('image/webp')) {
      return '$fallback.webp';
    }
    if (contentType.contains('video/mp4')) {
      return '$fallback.mp4';
    }
    return fallback;
  }

  Future<Map<String, dynamic>> confirmIncidentResolution(int reportId) async {
    final requestId = _newRequestId();
    final stopwatch = Stopwatch()..start();
    try {
      final response = await _apiService.post(
        '/api/incidents/$reportId/confirm-resolution',
        headers: {
          ..._authHeaders(),
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body: const {},
      );
      stopwatch.stop();
      _logInfo(
          '[mobile][incident][confirmIncidentResolution] request_id=$requestId report_id=$reportId status=success latency_ms=${stopwatch.elapsedMilliseconds}');
      return response;
    } catch (error) {
      stopwatch.stop();
      _logError(
          '[mobile][incident][confirmIncidentResolution] request_id=$requestId report_id=$reportId status=error latency_ms=${stopwatch.elapsedMilliseconds} error=$error');
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
