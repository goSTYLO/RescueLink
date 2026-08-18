import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../screens/responder/incident_alert_modal.dart';
import '../screens/responder/responder_incident_detail_screen.dart';
import '../screens/responder/responder_incident_preview_screen.dart';
import '../utils/report_ui.dart';
import 'auth_service.dart';
import 'responder_service.dart';
import 'websocket_service.dart';

typedef ResponderAlertDismissedCallback = void Function();

/// App-wide handler for responder incident and backup alert WebSocket events.
class ResponderAlertCoordinator {
  StreamSubscription<IncidentEvent>? _subscription;
  final Set<String> _shownAlertIds = <String>{};
  bool _online = false;
  bool _started = false;
  bool _modalShowing = false;

  ResponderAlertDismissedCallback? onAlertDismissed;

  bool get online => _online;

  void setOnline(bool value) {
    _online = value;
  }

  void start() {
    if (_started) return;
    _started = true;
    _subscription = WebSocketService().eventStream.listen((event) {
      final ctx = _context;
      if (ctx != null && ctx.mounted) {
        _handleEvent(ctx, event);
      }
    });
  }

  void updateContext(BuildContext context) {
    _context = context;
  }

  BuildContext? _context;

  void stop() {
    _subscription?.cancel();
    _subscription = null;
    _started = false;
    _shownAlertIds.clear();
    _modalShowing = false;
  }

  int? _parseReportId(IncidentEvent event) {
    final id = event.reportId ?? event.data['report_id'];
    if (id is int) return id;
    if (id is num) return id.toInt();
    return int.tryParse(id?.toString() ?? '');
  }

  int? _parseBackupRequestId(IncidentEvent event) {
    final id = event.data['backup_request_id'];
    if (id is int) return id;
    if (id is num) return id.toInt();
    return int.tryParse(id?.toString() ?? '');
  }

  String _alertKey(IncidentEvent event) {
    final reportId = _parseReportId(event);
    if (event.event == 'responder:backup_alert') {
      final backupId = _parseBackupRequestId(event);
      return 'backup:${reportId ?? 0}:${backupId ?? 0}';
    }
    return 'incident:${reportId ?? 0}';
  }

  Future<void> handleEvent(BuildContext context, IncidentEvent event) =>
      _handleEvent(context, event);

  void _notifyDismissed() {
    onAlertDismissed?.call();
  }

  Future<void> _handleEvent(BuildContext context, IncidentEvent event) async {
    final isIncidentAlert = event.event == 'responder:incident_alert';
    final isBackupAlert = event.event == 'responder:backup_alert';
    if (!isIncidentAlert && !isBackupAlert) return;
    if (AuthService().getUserRole() != 'responder') return;
    if (_modalShowing) return;

    final selfId = AuthService().getUserId();
    final reporterId = event.reporterId;
    if (selfId != null && reporterId != null && selfId == reporterId) {
      return;
    }

    final alertKey = _alertKey(event);
    if (_shownAlertIds.contains(alertKey)) return;
    _shownAlertIds.add(alertKey);

    final reportId = _parseReportId(event);
    if (reportId == null) return;

    final ctx = _context ?? context;
    if (!ctx.mounted) return;
    await HapticFeedback.heavyImpact();
    if (!ctx.mounted) return;

    _modalShowing = true;
    _online = true;
    await showModalBottomSheet<void>(
      context: ctx,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => IncidentAlertModal(
        event: event,
        onViewDetails: isBackupAlert
            ? null
            : () {
                Navigator.of(sheetContext).pop();
                _modalShowing = false;
                if (!ctx.mounted) return;
                Navigator.of(ctx, rootNavigator: true).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ResponderIncidentPreviewScreen(reportId: reportId),
                  ),
                );
              },
        onAccepted: (acceptedId, initialIncident) {
          Navigator.of(sheetContext).pop();
          _modalShowing = false;
          if (!ctx.mounted) return;
          Navigator.of(ctx, rootNavigator: true).push(
            MaterialPageRoute<void>(
              builder: (_) => ResponderIncidentDetailScreen(
                reportId: acceptedId,
                initialIncident: initialIncident,
                isBackupHelper: initialIncident['is_backup_assignment'] == true,
                backupRequestId: parseInt(initialIncident['backup_request_id']),
              ),
            ),
          );
        },
        onDeclined: () {
          Navigator.of(sheetContext).pop();
          _modalShowing = false;
        },
      ),
    );
    _modalShowing = false;
    _notifyDismissed();
  }

  Future<bool> refreshOnlineStatus() async {
    try {
      final profile = await ResponderService().getSelfProfile();
      _online = parseResponderOnlineFlag(profile['responder_online']);
      return _online;
    } catch (_) {
      _online = false;
      return false;
    }
  }

  void clearShownAlerts() => _shownAlertIds.clear();
}
