import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/common/emergency_dispatch_alert_modal.dart';
import '../utils/report_ui.dart';
import 'auth_service.dart';
import 'websocket_service.dart';

/// Foreground amber blare for department ops and field responders (dept notify + team assign).
class EmergencyDispatchAlertCoordinator {
  StreamSubscription<IncidentEvent>? _subscription;
  final Set<String> _shown = <String>{};
  bool _modalShowing = false;
  bool _started = false;
  BuildContext? _context;
  void Function(int reportId)? onOpenIncident;
  VoidCallback? onAlertDismissed;

  void updateContext(BuildContext context) => _context = context;

  void start() {
    if (_started) return;
    _started = true;
    _subscription = WebSocketService().eventStream.listen(_onEvent);
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
    _started = false;
    _shown.clear();
    _modalShowing = false;
  }

  void _onEvent(IncidentEvent event) {
    final ctx = _context;
    if (ctx == null || !ctx.mounted) return;
    unawaited(handleEvent(ctx, event));
  }

  Future<void> handleEvent(BuildContext context, IncidentEvent event) async {
    if (event.event != 'incident:dispatched') return;
    if (_modalShowing) return;

    final auth = AuthService();
    final isDeptOps = auth.isDepartmentOps;
    final isPersonnel = auth.isPersonnelResponder;
    if (!isDeptOps && !isPersonnel) return;

    final reportId = parseInt(event.reportId ?? event.data['report_id']);
    if (reportId == null) return;

    final teamName = (event.data['assigned_team_name'] ?? '').toString().trim();
    final kind = teamName.isNotEmpty ? 'team' : 'dept';

    final key = '$kind:$reportId';
    if (_shown.contains(key)) return;
    _shown.add(key);

    final title = kind == 'team'
        ? (isDeptOps
            ? 'EMERGENCY — Team assigned'
            : 'EMERGENCY — Your team was assigned')
        : 'EMERGENCY — Department notified';
    final type = (event.data['incident_type'] ?? 'Incident').toString();
    final barangay = (event.data['barangay'] ?? '').toString();
    final body = kind == 'team'
        ? 'Team $teamName assigned to Incident #$reportId ($type)${barangay.isNotEmpty ? ' in $barangay' : ''}.'
        : 'Incident #$reportId ($type) needs a team from your department${barangay.isNotEmpty ? ' · $barangay' : ''}.';

    final ctx = _context ?? context;
    if (!ctx.mounted) return;
    _modalShowing = true;
    await showDialog<void>(
      context: ctx,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (_) => EmergencyDispatchAlertModal(
        title: title,
        body: body,
        onOpen: () {
          Navigator.of(ctx, rootNavigator: true).pop();
          _modalShowing = false;
          onOpenIncident?.call(reportId);
          onAlertDismissed?.call();
        },
        onDismiss: () {
          Navigator.of(ctx, rootNavigator: true).pop();
          _modalShowing = false;
          onAlertDismissed?.call();
        },
      ),
    );
    _modalShowing = false;
  }
}
