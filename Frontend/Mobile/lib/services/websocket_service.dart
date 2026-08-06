import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../utils/app_config.dart';
import 'auth_service.dart';

/// Event payload from WebSocket server
class IncidentEvent {
  final String event;
  final Map<String, dynamic> data;

  IncidentEvent({required this.event, required this.data});

  int? get reportId => data['report_id'] ?? data['reportId'];
  int? get reporterId => data['reporter_id'] ?? data['reporterId'];
  String? get status => data['status']?.toString();
  String? get incidentType => data['incident_type']?.toString();
  String? get severityLevel => data['severity_level']?.toString();
  String? get barangay => data['barangay']?.toString();
  String? get updatedAt => data['updated_at']?.toString();

  factory IncidentEvent.fromJson(Map<String, dynamic> json) {
    return IncidentEvent(
      event: json['event']?.toString() ?? '',
      data: json['data'] is Map ? Map<String, dynamic>.from(json['data'] as Map) : {},
    );
  }
}

/// Singleton WebSocket service for real-time incident updates.
/// Connect after auth, disconnect on logout. Screens subscribe to [eventStream].
class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;

  WebSocketService._internal();

  static const _reconnectBaseMs = 1000;
  static const _reconnectMaxMs = 30000;
  static const _reconnectMultiplier = 2;
  static const _pingIntervalMs = 25000;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  int _reconnectAttempt = 0;
  bool _disposed = false;
  bool _intentionalDisconnect = false;

  final _eventController = StreamController<IncidentEvent>.broadcast();
  final _statusController = StreamController<WebSocketStatus>.broadcast();

  Stream<IncidentEvent> get eventStream => _eventController.stream;
  Stream<WebSocketStatus> get statusStream => _statusController.stream;

  WebSocketStatus _status = WebSocketStatus.disconnected;
  WebSocketStatus get status => _status;

  void _setStatus(WebSocketStatus s) {
    if (_status != s) {
      _status = s;
      _statusController.add(s);
    }
  }

  String _getWsUrl() {
    final base = AppConfig.apiBaseUrl;
    final wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
    final host = base.replaceFirst(RegExp(r'^https?://'), '');
    return '$wsProtocol://$host/ws';
  }

  void connect() {
    if (_disposed) return;
    _intentionalDisconnect = false;
    _connect();
  }

  void _connect() {
    if (_disposed || _intentionalDisconnect) return;

    final token = AuthService().getToken();
    if (token == null || token.isEmpty) {
      _setStatus(WebSocketStatus.disconnected);
      return;
    }

    final url = '${_getWsUrl()}?token=${Uri.encodeComponent(token)}';
    _setStatus(WebSocketStatus.connecting);

    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      _reconnectAttempt = 0;
      _setStatus(WebSocketStatus.connected);

      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );

      _startPing();
    } catch (e) {
      _onError(e);
    }
  }

  void _onMessage(dynamic data) {
    if (_disposed) return;
    try {
      final decoded = jsonDecode(data is String ? data : utf8.decode(data as List<int>));
      if (decoded is Map<String, dynamic>) {
        final event = IncidentEvent.fromJson(decoded);
        _eventController.add(event);
      }
    } catch (_) {}
  }

  void _onError(dynamic error) {
    if (_disposed) return;
    _cleanup();
    _setStatus(WebSocketStatus.disconnected);
    _scheduleReconnect();
  }

  void _onDone() {
    if (_disposed || _intentionalDisconnect) return;
    _cleanup();
    _setStatus(WebSocketStatus.disconnected);
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_disposed || _intentionalDisconnect) return;

    final token = AuthService().getToken();
    if (token == null || token.isEmpty) return;

    _setStatus(WebSocketStatus.reconnecting);
    final delayMs = (_reconnectBaseMs * math.pow(_reconnectMultiplier, _reconnectAttempt))
        .round()
        .clamp(_reconnectBaseMs, _reconnectMaxMs)
        .toInt();
    _reconnectAttempt++;

    _reconnectTimer = Timer(Duration(milliseconds: delayMs), () {
      _reconnectTimer = null;
      _connect();
    });
  }

  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(milliseconds: _pingIntervalMs), (_) {
      if (_channel != null) {
        try {
          _channel!.sink.add(jsonEncode({'type': 'ping'}));
        } catch (_) {}
      }
    });
  }

  void _cleanup() {
    _pingTimer?.cancel();
    _pingTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
  }

  void disconnect() {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _cleanup();
    _setStatus(WebSocketStatus.disconnected);
  }

  void dispose() {
    _disposed = true;
    disconnect();
    _eventController.close();
    _statusController.close();
  }
}

enum WebSocketStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
}
