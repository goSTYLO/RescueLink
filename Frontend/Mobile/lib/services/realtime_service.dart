import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../utils/app_config.dart';
import 'auth_service.dart';

/// Realtime event types
enum RealtimeEventType {
  incidentCreated,
  incidentUpdated,
  dispatchCreated,
  connectionEstablished,
  unknown,
}

/// Realtime event model
class RealtimeEvent {
  final RealtimeEventType type;
  final Map<String, dynamic> payload;
  final DateTime receivedAt;

  const RealtimeEvent({
    required this.type,
    required this.payload,
    required this.receivedAt,
  });

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    final typeStr = json['type'] as String? ?? 'unknown';
    RealtimeEventType eventType;

    switch (typeStr) {
      case 'incident:created':
        eventType = RealtimeEventType.incidentCreated;
        break;
      case 'incident:updated':
        eventType = RealtimeEventType.incidentUpdated;
        break;
      case 'dispatch:created':
        eventType = RealtimeEventType.dispatchCreated;
        break;
      case 'connection:established':
        eventType = RealtimeEventType.connectionEstablished;
        break;
      default:
        eventType = RealtimeEventType.unknown;
    }

    return RealtimeEvent(
      type: eventType,
      payload: json['payload'] as Map<String, dynamic>? ?? {},
      receivedAt: DateTime.now(),
    );
  }

  @override
  String toString() {
    return 'RealtimeEvent(type: $type, payload: $payload)';
  }
}

/// Exception for realtime service errors
class RealtimeServiceException implements Exception {
  final String message;
  const RealtimeServiceException(this.message);

  @override
  String toString() => 'RealtimeServiceException: $message';
}

/// Service for managing WebSocket connections and realtime events
class RealtimeService {
  final AuthService _authService = AuthService();
  WebSocketChannel? _channel;
  final _eventController = StreamController<RealtimeEvent>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  bool _isConnected = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;

  // Reconnection settings
  static const Duration _initialRetryDelay = Duration(seconds: 1);
  static const Duration _maxRetryDelay = Duration(seconds: 30);
  static const double _retryMultiplier = 2.0;
  Duration _currentRetryDelay = _initialRetryDelay;

  /// Stream of realtime events
  Stream<RealtimeEvent> get eventStream => _eventController.stream;

  /// Stream of connection status changes
  Stream<bool> get connectionStream => _connectionController.stream;

  /// Current connection status
  bool get isConnected => _isConnected;

  /// Connect to WebSocket server
  Future<void> connect() async {
    if (_isConnected) {
      _logInfo('[Realtime] Already connected');
      return;
    }

    final token = _authService.getToken();
    if (token == null || token.isEmpty) {
      _logError('[Realtime] No auth token available');
      throw RealtimeServiceException('Authentication required');
    }

    try {
      final wsUrl = _buildWebSocketUrl(token);
      _logInfo('[Realtime] Connecting to WebSocket...');

      // Create WebSocket channel
      if (!kIsWeb && Platform.isAndroid || Platform.isIOS) {
        _channel = IOWebSocketChannel.connect(
          Uri.parse(wsUrl),
          pingInterval: const Duration(seconds: 30),
        );
      } else {
        _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      }

      // Listen for messages
      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      _isConnected = true;
      _reconnectAttempts = 0;
      _currentRetryDelay = _initialRetryDelay;
      _connectionController.add(true);

      _logInfo('[Realtime] WebSocket connected');
    } catch (e) {
      _logError('[Realtime] Connection failed: $e');
      _scheduleReconnect();
      throw RealtimeServiceException('Failed to connect: $e');
    }
  }

  /// Disconnect from WebSocket server
  void disconnect() {
    _logInfo('[Realtime] Disconnecting...');
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _isConnected = false;
    _connectionController.add(false);

    try {
      _channel?.sink.close();
    } catch (e) {
      _logError('[Realtime] Error closing WebSocket: $e');
    }
    _channel = null;
  }

  /// Handle incoming WebSocket message
  void _onMessage(dynamic message) {
    try {
      final data = jsonDecode(message as String) as Map<String, dynamic>;
      _logInfo('[Realtime] Message received: ${data['type']}');

      final event = RealtimeEvent.fromJson(data);
      _eventController.add(event);
    } catch (e) {
      _logError('[Realtime] Error parsing message: $e');
    }
  }

  /// Handle WebSocket error
  void _onError(Object error) {
    _logError('[Realtime] WebSocket error: $error');
    _isConnected = false;
    _connectionController.add(false);
    _scheduleReconnect();
  }

  /// Handle WebSocket connection closed
  void _onDone() {
    _logInfo('[Realtime] WebSocket closed');
    _isConnected = false;
    _connectionController.add(false);
    _scheduleReconnect();
  }

  /// Schedule reconnection with exponential backoff
  void _scheduleReconnect() {
    if (_reconnectTimer != null || _reconnectAttempts > 10) {
      return;
    }

    _reconnectAttempts++;
    _logInfo('[Realtime] Reconnecting in ${_currentRetryDelay.inSeconds}s (attempt $_reconnectAttempts)');

    _reconnectTimer = Timer(_currentRetryDelay, () {
      _reconnectTimer = null;
      _currentRetryDelay = Duration(
        milliseconds: (_currentRetryDelay.inMilliseconds * _retryMultiplier).toInt().clamp(0, _maxRetryDelay.inMilliseconds),
      );
      connect();
    });
  }

  /// Build WebSocket URL from API base URL
  String _buildWebSocketUrl(String token) {
    final apiUrl = AppConfig.apiBaseUrl;
    final wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    final wsBase = apiUrl.replaceFirst(RegExp(r'^https?'), wsProtocol);
    final wsPath = '/ws';

    return '$wsBase$wsPath?token=${Uri.encodeComponent(token)}';
  }

  void _logInfo(String message) {
    if (AppConfig.enableDebugLogging) {
      debugPrint(message);
    }
  }

  void _logError(String message) {
    debugPrint(message);
  }

  /// Dispose resources
  void dispose() {
    disconnect();
    _eventController.close();
    _connectionController.close();
  }
}

/// Singleton instance
final realtimeService = RealtimeService();
