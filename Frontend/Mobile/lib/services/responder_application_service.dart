import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../utils/app_config.dart';
import 'api_service.dart';
import 'auth_service.dart';

class ResponderApplicationService {
  final ApiService _apiService = ApiService();

  MediaType _resolveMediaType(String filePath) {
    final ext = p.extension(filePath).toLowerCase();
    if (ext == '.pdf') return MediaType('application', 'pdf');
    if (ext == '.png') return MediaType('image', 'png');
    return MediaType('image', 'jpeg');
  }

  String _resolveFilename(String filePath) {
    var filename = p.basename(filePath);
    if (!filename.contains('.')) {
      filename = '$filename.jpg';
    }
    return filename;
  }

  /// Get current user's application status
  Future<Map<String, dynamic>> getMyApplication() async {
    final token = AuthService().getToken();
    if (token == null) {
      throw ApiException('Not authenticated');
    }

    return await _apiService.get(
      '/api/responder-applications/me',
      headers: {'Authorization': 'Bearer $token'},
    );
  }

  /// Submit volunteer responder application with documents & specialization field proofs
  Future<Map<String, dynamic>> submitApplication({
    required Map<String, dynamic> personalDetails,
    required File govIdFile,
    required List<String> specializationFields,
    required Map<String, File> fieldProofFiles,
    List<File> certificateFiles = const [],
    List<File> otherDocFiles = const [],
  }) async {
    final token = AuthService().getToken();
    if (token == null) {
      throw ApiException('Not authenticated');
    }

    final uri = Uri.parse('${AppConfig.apiBaseUrl}/api/responder-applications');
    final request = http.MultipartRequest('POST', uri);

    request.headers['Authorization'] = 'Bearer $token';

    // Add JSON string of personal details and specialization fields
    request.fields['personal_details'] = jsonEncode(personalDetails);
    request.fields['specialization_fields'] = jsonEncode(specializationFields);

    // Add Gov ID File
    final govIdFilename = _resolveFilename(govIdFile.path);
    final govIdMediaType = _resolveMediaType(govIdFile.path);

    request.files.add(
      await http.MultipartFile.fromPath(
        'gov_id',
        govIdFile.path,
        filename: govIdFilename,
        contentType: govIdMediaType,
      ),
    );

    // Add Per-Field Proof Files (e.g. proof_fire, proof_medical)
    for (final entry in fieldProofFiles.entries) {
      final fieldKey = entry.key;
      final file = entry.value;
      final proofFilename = _resolveFilename(file.path);
      final proofMediaType = _resolveMediaType(file.path);

      request.files.add(
        await http.MultipartFile.fromPath(
          'proof_$fieldKey',
          file.path,
          filename: proofFilename,
          contentType: proofMediaType,
        ),
      );
    }

    // Add Certificate Files (legacy fallback)
    for (final file in certificateFiles) {
      final certFilename = _resolveFilename(file.path);
      final certMediaType = _resolveMediaType(file.path);

      request.files.add(
        await http.MultipartFile.fromPath(
          'certificates',
          file.path,
          filename: certFilename,
          contentType: certMediaType,
        ),
      );
    }

    // Add Other Document Files
    for (final file in otherDocFiles) {
      final docFilename = _resolveFilename(file.path);
      final docMediaType = _resolveMediaType(file.path);

      request.files.add(
        await http.MultipartFile.fromPath(
          'other_docs',
          file.path,
          filename: docFilename,
          contentType: docMediaType,
        ),
      );
    }

    final http.StreamedResponse streamedResponse;
    try {
      streamedResponse = await request.send().timeout(AppConfig.apiTimeout);
    } on SocketException {
      throw ApiException(
        'Could not reach the server. Check Wi‑Fi and that the RescueLink backend is running.',
      );
    } on http.ClientException catch (e) {
      if (e.message.contains('Connection reset') || e.message.contains('Connection refused')) {
        throw ApiException(
          'Upload was interrupted. If the backend is in dev mode, wait a moment and try again.',
        );
      }
      rethrow;
    }
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      String errorMessage = 'Application submission failed';
      try {
        final errorBody = jsonDecode(response.body) as Map<String, dynamic>;
        errorMessage = errorBody['message'] ?? errorBody['error'] ?? errorMessage;
      } catch (_) {
        if (response.body.isNotEmpty) errorMessage = response.body;
      }
      throw ApiException(errorMessage, statusCode: response.statusCode);
    }
  }
}
