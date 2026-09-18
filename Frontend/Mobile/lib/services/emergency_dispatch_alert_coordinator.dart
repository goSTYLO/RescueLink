import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/common/emergency_dispatch_alert_modal.dart';
import '../utils/report_ui.dart';
import 'amber_alert_sound.dart';
import 'auth_service.dart';
import 'websocket_service.dart';

/// Foreground amber blare for department ops and field responders (dept notify + team assign).
class EmergencyDispatchAlertCoordinator {
  StreamSubscription<IncidentEvent>? _subscription;
  final Set<String> _shown = <String>{};
  final Set<int> _openedFromPush = <int>{};
  bool _modalShowing = false;
  bool _started = false;
  BuildContext? _context;
  BuildContext? _dialogContext;
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
    _openedFromPush.clear();
    _modalShowing = false;
    _dialogContext = null;
  }

  /// Tray tap already opened this incident — do not start (or keep) the in-app modal.
  void consumeReport(int reportId) {
    _openedFromPush.add(reportId);
    _shown.add('team:$reportId');
    _shown.add('dept:$reportId');
    unawaited(AmberAlertSound.stop());
    dismissActiveAlert();
  }

  /// Stop active amber modal (e.g. user tapped the system notification).
  void dismissActiveAlert() {
    if (!_modalShowing) return;
    final dialogCtx = _dialogContext;
    if (dialogCtx != null && dialogCtx.mounted) {
      Navigator.of(dialogCtx, rootNavigator: true).pop();
    }
    _modalShowing = false;
    _dialogContext = null;
    onAlertDismissed?.call();
  }

  void _onEvent(IncidentEvent event) {
    final ctx = _context;
    if (ctx == null || !ctx.mounted) return;
    unawaited(handleEvent(ctx, event));
  }

  Future<void> handleEvent(BuildContext context, IncidentEvent event) async {
    if (event.event != 'incident:dispatched') return;
    final reportId = parseInt(event.reportId ?? event.data['report_id']);
    if (reportId == null) return;
    final teamName = (event.data['assigned_team_name'] ?? '').toString().trim();
    final kind = teamName.isNotEmpty ? 'team' : 'dept';
    await _present(
      context,
      reportId: reportId,
      kind: kind,
      teamName: teamName,
      type: (event.data['incident_type'] ?? 'Incident').toString(),
      barangay: (event.data['barangay'] ?? '').toString(),
    );
  }

  /// Critical OneSignal while the app is open (WS may be late or missing).
  Future<void> handleCriticalPush(String reportIdRaw, {String? alertKind}) async {
    final ctx = _context;
    if (ctx == null || !ctx.mounted) return;
    final reportId = parseInt(reportIdRaw);
    if (reportId == null) return;
    final kind = alertKind == 'team' ? 'team' : 'dept';
    await _present(ctx, reportId: reportId, kind: kind, teamName: '', type: 'Incident', barangay: '');
  }

  Future<void> _present(
    BuildContext context, {
    required int reportId,
    required String kind,
    required String teamName,
    required String type,
    required String barangay,
  }) async {
    if (_openedFromPush.contains(reportId) || _modalShowing) return;

    final auth = AuthService();
    final isDeptOps = auth.isDepartmentOps;
    final isPersonnel = auth.isPersonnelResponder;
    if (!isDeptOps && !isPersonnel) return;

    final key = '$kind:$reportId';
    if (_shown.contains(key)) return;
    _shown.add(key);
    if (_openedFromPush.contains(reportId)) return;

    final title = kind == 'team' ? 'Your team is up' : 'Respond now';
    final body = kind == 'team'
        ? (teamName.isNotEmpty
            ? '#$reportId $type${barangay.isNotEmpty ? ' in $barangay' : ''} — $teamName'
            : '#$reportId $type${barangay.isNotEmpty ? ' in $barangay' : ''} — go now')
        : '#$reportId $type${barangay.isNotEmpty ? ' in $barangay' : ''} — your department';

    final ctx = _context ?? context;
    if (!ctx.mounted) return;
    _modalShowing = true;
    await showDialog<void>(
      context: ctx,
      barrierDismissible: false,
      useRootNavigator: true,
      builder: (dialogCtx) {
        if (_openedFromPush.contains(reportId)) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (dialogCtx.mounted) {
              Navigator.of(dialogCtx, rootNavigator: true).pop();
            }
          });
          return const SizedBox.shrink();
        }
        _dialogContext = dialogCtx;
        return EmergencyDispatchAlertModal(
          title: title,
          body: body,
          onOpen: () {
            Navigator.of(ctx, rootNavigator: true).pop();
            _modalShowing = false;
            _dialogContext = null;
            onOpenIncident?.call(reportId);
            onAlertDismissed?.call();
          },
          onDismiss: () {
            Navigator.of(ctx, rootNavigator: true).pop();
            _modalShowing = false;
            _dialogContext = null;
            onAlertDismissed?.call();
          },
        );
      },
    );
    _modalShowing = false;
    _dialogContext = null;
  }
}
