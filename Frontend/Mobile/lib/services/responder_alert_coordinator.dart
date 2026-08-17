import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../screens/responder/incident_alert_modal.dart';
import '../screens/responder/responder_incident_detail_screen.dart';
import '../screens/responder/responder_incident_preview_screen.dart';
import 'responder_service.dart';
import 'websocket_service.dart';

/// Called when an incident alert modal is dismissed (decline, accept, view details, or close).
typedef ResponderAlertDismissedCallback = void Function();

/// App-wide handler for `responder:incident_alert` WebSocket events.
class ResponderAlertCoordinator {
  StreamSubscription<IncidentEvent>? _subscription;
  final Set<int> _shownAlertIds = <int>{};
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

  /// Handle a responder alert event (also callable from [HomePlaceholderScreen]).
  Future<void> handleEvent(BuildContext context, IncidentEvent event) =>
      _handleEvent(context, event);

  void _notifyDismissed() {
    onAlertDismissed?.call();
  }

  Future<void> _handleEvent(BuildContext context, IncidentEvent event) async {
    if (event.event != 'responder:incident_alert') return;
    // Server only delivers this event to online, role-matched responders.
    // Do not gate on the local _online cache — it may be stale until the
    // Responder tab is opened.
    if (_modalShowing) return;

    final reportId = _parseReportId(event);
    if (reportId == null || _shownAlertIds.contains(reportId)) return;
    _shownAlertIds.add(reportId);

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
        onViewDetails: () {
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
