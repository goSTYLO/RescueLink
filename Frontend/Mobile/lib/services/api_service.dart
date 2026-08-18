import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/app_config.dart';

class ApiService {
  final String baseUrl;
  final http.Client client;

  ApiService({
    String? baseUrl,
    http.Client? client,
  })  : baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
        client = client ?? http.Client();

  // Generic GET request
  Future<Map<String, dynamic>> get(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final uri = _buildUri(endpoint, queryParameters);
      final response = await client.get(
        uri,
        headers: _buildHeaders(headers),
      ).timeout(AppConfig.apiTimeout);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('GET request timed out after ${AppConfig.apiTimeout.inSeconds}s. Check connection to $baseUrl');
    } on SocketException {
      throw ApiException('Unable to connect to $baseUrl. Check network and API_BASE_URL.');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('GET request failed: $e');
    }
  }

  // Generic POST request
  Future<Map<String, dynamic>> post(
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      debugPrint('🌐 [API POST] URL: $uri');
      debugPrint('🌐 [API POST] Headers: ${_buildHeaders(headers)}');
      debugPrint('🌐 [API POST] Body: ${body != null ? jsonEncode(body) : "null"}');
      
      final response = await client.post(
        uri,
        headers: _buildHeaders(headers),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(AppConfig.apiTimeout);

      debugPrint('🌐 [API POST] Response status: ${response.statusCode}');
      debugPrint('🌐 [API POST] Response body: ${response.body}');

      return _handleResponse(response);
    } on TimeoutException {
      debugPrint('❌ [API POST] Request timed out after ${AppConfig.apiTimeout.inSeconds}s to $baseUrl');
      throw ApiException('POST request timed out after ${AppConfig.apiTimeout.inSeconds}s. Check connection to $baseUrl');
    } on SocketException {
      debugPrint('❌ [API POST] Socket connection failed to $baseUrl');
      throw ApiException('Unable to connect to $baseUrl. Check network and API_BASE_URL.');
    } on ApiException {
      rethrow;
    } catch (e) {
      debugPrint('❌ [API POST] Request failed: $e');
      throw ApiException('POST request failed: $e');
    }
  }

  // Generic PATCH request
  Future<Map<String, dynamic>> patch(
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await client.patch(
        uri,
        headers: _buildHeaders(headers),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(AppConfig.apiTimeout);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('PATCH request timed out after ${AppConfig.apiTimeout.inSeconds}s. Check connection to $baseUrl');
    } on SocketException {
      throw ApiException('Unable to connect to $baseUrl. Check network and API_BASE_URL.');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('PATCH request failed: $e');
    }
  }

  // Generic PUT request
  Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await client.put(
        uri,
        headers: _buildHeaders(headers),
        body: body != null ? jsonEncode(body) : null,
      ).timeout(AppConfig.apiTimeout);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('PUT request timed out after ${AppConfig.apiTimeout.inSeconds}s. Check connection to $baseUrl');
    } on SocketException {
      throw ApiException('Unable to connect to $baseUrl. Check network and API_BASE_URL.');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('PUT request failed: $e');
    }
  }

  // Generic DELETE request
  Future<Map<String, dynamic>> delete(
    String endpoint, {
    Map<String, String>? headers,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await client.delete(
        uri,
        headers: _buildHeaders(headers),
      ).timeout(AppConfig.apiTimeout);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('DELETE request timed out after ${AppConfig.apiTimeout.inSeconds}s. Check connection to $baseUrl');
    } on SocketException {
      throw ApiException('Unable to connect to $baseUrl. Check network and API_BASE_URL.');
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException('DELETE request failed: $e');
    }
  }

  // Build URI with query parameters
  Uri _buildUri(String endpoint, Map<String, dynamic>? queryParameters) {
    final uri = Uri.parse('$baseUrl$endpoint');
    if (queryParameters != null && queryParameters.isNotEmpty) {
      return uri.replace(
          queryParameters: queryParameters.map(
        (key, value) => MapEntry(key, value.toString()),
      ));
    }
    return uri;
  }

  // Build headers with default content type and authorization
  Map<String, String> _buildHeaders(Map<String, String>? customHeaders) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }

    return headers;
  }

  // Handle HTTP response
  Map<String, dynamic> _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return {};
      }
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      // Try to extract error message from JSON response
      String errorMessage = 'Request failed with status ${response.statusCode}';
      try {
        final errorBody = jsonDecode(response.body) as Map<String, dynamic>;
        if (errorBody.containsKey('message')) {
          errorMessage = errorBody['message'];
        } else if (errorBody.containsKey('error')) {
          errorMessage = errorBody['error'];
        }
      } catch (_) {
        // If JSON parsing fails, use the raw body
        errorMessage = response.body.isNotEmpty ? response.body : errorMessage;
      }

      throw ApiException(
        errorMessage,
        statusCode: response.statusCode,
      );
    }
  }

  // Close the HTTP client
  void close() {
    client.close();
  }
}

// Custom API Exception
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException: $message';
}
