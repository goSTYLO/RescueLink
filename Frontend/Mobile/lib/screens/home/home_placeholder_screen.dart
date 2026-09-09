import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'report_history_screen.dart';
import '../../services/websocket_service.dart';
import '../../services/notification_service.dart';
import '../../services/onesignal_service.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';
import '../../services/auth_service.dart';
import '../../services/responder_alert_coordinator.dart';
import '../../utils/incident_navigation.dart';
import '../../utils/responsive.dart';
import '../../utils/sos_shake_detector.dart';
import '../../widgets/staggered_fade_in.dart';
import '../responder/responder_dashboard_screen.dart';

class HomePlaceholderScreen extends StatefulWidget {
  final Future<void> Function(ThemeMode mode)? onThemeChanged;
  final int? initialTabIndex;
  final VoidCallback? onInitialTabApplied;
  final VoidCallback onLogout;
  final VoidCallback? onSosPressed;
  final VoidCallback? onEmergencyNoAiPressed;
  final void Function(int reportId)? onReportTap;
  final VoidCallback? onPhoneNumberTap;
  final VoidCallback? onBarangayTap;
  final VoidCallback? onEmergencyContactsTap;
  final VoidCallback? onChangePasswordTap;
  final VoidCallback? onPrivacySecurityTap;
  final VoidCallback? onAboutTap;

  const HomePlaceholderScreen({
    super.key,
    this.onThemeChanged,
    this.initialTabIndex,
    this.onInitialTabApplied,
    required this.onLogout,
    this.onSosPressed,
    this.onEmergencyNoAiPressed,
    this.onReportTap,
    this.onPhoneNumberTap,
    this.onBarangayTap,
    this.onEmergencyContactsTap,
    this.onChangePasswordTap,
    this.onPrivacySecurityTap,
    this.onAboutTap,
  });

  @override
  State<HomePlaceholderScreen> createState() => _HomePlaceholderScreenState();
}

class _HomePlaceholderScreenState extends State<HomePlaceholderScreen>
    with WidgetsBindingObserver {
  Timer? _sosTimer;
  Timer? _sosVibrateTimer;
  int _sosCountdown = 0;
  bool _loadingLocation = true;
  int _unreadReportsCount = 0;
  int _apiUnreadCount = 0;
  StreamSubscription<IncidentEvent>? _wsSubscription;
  String _locationTitle = 'Dagupan City, Pangasinan';
  String _locationTimestamp = 'Updating...';
  bool _isResponder = false;
  bool _responderOnline = false;
  bool _revokeModalShowing = false;
  bool _approveModalShowing = false;
  final ResponderAlertCoordinator _responderAlertCoordinator = ResponderAlertCoordinator();
  final GlobalKey<ResponderDashboardScreenState> _responderDashboardKey =
      GlobalKey<ResponderDashboardScreenState>();

  StreamSubscription<UserAccelerometerEvent>? _shakeSubscription;
  final SosShakeDetector _shakeDetector = SosShakeDetector();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _loadHomeLocation();
    _fetchUnreadCount();
    // Detect responder role (synchronous from cache, refreshed by _loadHomeLocation)
    _isResponder = AuthService().hasResponderTab;
    if (_isResponder) {
      unawaited(_initResponderAlerts());
    }
    _wsSubscription = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      final currentUserId = AuthService().getUserId();

      if (event.event == 'application:status_changed') {
        unawaited(_handleApplicationStatusChanged(event.data));
        return;
      }
      if (event.event == 'responder:incident_alert') {
        if (AuthService().isVolunteer) {
          unawaited(_responderAlertCoordinator.handleEvent(context, event));
        }
        return;
      }
      if (event.event == 'responder:backup_alert') {
        if (AuthService().isVolunteer) {
          unawaited(_responderAlertCoordinator.handleEvent(context, event));
        }
        return;
      }

      // Do NOT show "incident:created" on mobile — that is only for the web dispatcher dashboard
      if (event.event == 'incident:created') {
        return;
      }

      // Only show update notifications if the user is involved in the incident (reporter or assigned responder)
      final reporterId = event.data['reporter_id'] ?? event.data['user_id'] ?? event.data['reporterId'] ?? event.data['userId'];
      final acceptedUserId = event.data['accepted_by_user_id'] ?? event.data['acceptedByUserId'];
      final isReporter = currentUserId != null && reporterId != null && (reporterId == currentUserId || reporterId.toString() == currentUserId.toString());
      final isAssignedResponder = currentUserId != null && acceptedUserId != null && (acceptedUserId == currentUserId || acceptedUserId.toString() == currentUserId.toString());

      // If this is an incident update and the user is not the reporter or assigned responder, ignore
      if (event.reportId != null && !isReporter && !isAssignedResponder && !_isResponder) {
        return;
      }

      final title = _formatNotificationTitle(event);
      if (title == null || title.isEmpty) return;

      if (_currentIndex != 1) {
        setState(() => _unreadReportsCount++);
      }
    });
    if (widget.initialTabIndex != null) {
      _currentIndex = widget.initialTabIndex!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onInitialTabApplied?.call();
      });
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _restartShakeListening();
      _checkAndPromptNotifications();
      OneSignalService().setOnNotificationOpened(_onPushOpened);
    });
  }

  Future<void> _checkAndPromptNotifications() async {
    final onesignal = OneSignalService();
    final alreadyPrompted = await onesignal.hasPromptedPermission();
    if (alreadyPrompted) return;

    final isEnabled = await onesignal.isPushEnabled();
    if (isEnabled) return;

    // Mark as prompted so it only asks 1 time
    await onesignal.markPermissionPrompted();

    if (!mounted) return;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1F2937) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFDBEAFE),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.notifications_active_outlined,
                color: Color(0xFF134178),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Turn on Notifications?',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: const Text(
          'Get real-time emergency updates, incident status alerts, and vital dispatch notices from RescueLink.',
          style: TextStyle(fontSize: 14, height: 1.4),
        ),
        actionsPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Not Now',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : const Color(0xFF6B7280),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final granted = await onesignal.requestPermission();
              if (mounted && granted) {
                ScaffoldMessenger.maybeOf(context)?.showSnackBar(
                  const SnackBar(
                    content: Text('Notifications enabled.'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF134178),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: const Text('Turn On', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    _restartShakeListening();
  }

  void _onPushOpened(String reportId) {
    final id = int.tryParse(reportId);
    if (id == null || id <= 0 || !mounted) return;
    _openIncidentByInvolvement(id);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        _restartShakeListening();
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        _stopShakeListening();
    }
  }

  bool _isForegroundForShake() {
    final state = WidgetsBinding.instance.lifecycleState;
    return state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden;
  }

  void _startShakeListening() {
    if (!mounted || !_isForegroundForShake() || _shakeSubscription != null) {
      return;
    }
    _shakeSubscription = userAccelerometerEventStream().listen(
      (event) {
        if (!mounted || _sosCountdown > 0) return;
        final nowMs = DateTime.now().millisecondsSinceEpoch;
        if (_shakeDetector.feed(event.x, event.y, event.z, nowMs: nowMs)) {
          _triggerSos();
        }
      },
      onError: (_) => _restartShakeListening(),
      onDone: _restartShakeListening,
      cancelOnError: false,
    );
  }

  void _restartShakeListening() {
    if (!mounted) return;
    _stopShakeListening();
    if (!_isForegroundForShake()) return;
    _shakeDetector.reset();
    _startShakeListening();
  }

  void _stopShakeListening() {
    _shakeSubscription?.cancel();
    _shakeSubscription = null;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopShakeListening();
    OneSignalService().setOnNotificationOpened(null);
    _wsSubscription?.cancel();
    _responderAlertCoordinator.stop();
    _sosTimer?.cancel();
    _stopSosCancelVibration();
    super.dispose();
  }

  Future<void> _fetchUnreadCount() async {
    try {
      final count = await NotificationService().getUnreadCount();
      if (mounted) setState(() => _apiUnreadCount = count);
    } catch (_) {}
  }

  static const int _responderTabIndex = 2;

  Future<void> _initResponderAlerts() async {
    var online = await _responderAlertCoordinator.refreshOnlineStatus();
    if (AuthService().isPersonnelResponder) {
      online = true;
      _responderAlertCoordinator.setOnline(true);
    }
    if (!mounted) return;
    setState(() => _responderOnline = online);
    _responderAlertCoordinator.updateContext(context);
    _responderAlertCoordinator.onAlertDismissed = _onResponderAlertDismissed;
    _responderAlertCoordinator.start();
    _restartShakeListening();
  }

  void _onResponderAlertDismissed() {
    _responderDashboardKey.currentState?.refreshIncidents();
    _restartShakeListening();
    if (_currentIndex != _responderTabIndex && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Incident available on Responder tab'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _syncResponderOnlineFromServer() async {
    final online = await _responderAlertCoordinator.refreshOnlineStatus();
    if (!mounted) return;
    if (online != _responderOnline) {
      setState(() => _responderOnline = online);
    }
  }

  void _onResponderOnlineChanged(bool online) {
    setState(() => _responderOnline = online);
    _responderAlertCoordinator.setOnline(online);
    if (!online) {
      _responderAlertCoordinator.clearShownAlerts();
    }
  }

  void _openIncidentByInvolvement(int reportId, {Map<String, dynamic>? incidentHint}) {
    final onCitizenTap = widget.onReportTap;
    if (onCitizenTap == null) return;
    unawaited(
      openIncidentByReportId(
        context,
        reportId: reportId,
        incidentHint: incidentHint,
        onCitizenTap: onCitizenTap,
      ),
    );
  }

  Future<void> _handleApplicationStatusChanged(Map<String, dynamic> data) async {
    final status = data['status']?.toString().toLowerCase();
    if (status == 'revoked') {
      await AuthService().cacheUserRole('user');
      await _loadHomeLocation();
      if (!mounted) return;
      _popOverlayRoutes();
      setState(() {
        _isResponder = false;
        _currentIndex = 0;
      });
      _responderAlertCoordinator.stop();
      final notes = data['notes']?.toString() ?? data['reason']?.toString();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showRevokeModal(reason: notes);
      });
    } else if (status == 'approved') {
      final wasResponder = _isResponder;
      if (!wasResponder) {
        await AuthService().cacheUserRole('volunteer');
        if (mounted) setState(() => _isResponder = true);
        if (mounted) {
          WebSocketService().disconnect();
          WebSocketService().connect();
        }
        if (mounted) unawaited(_initResponderAlerts());
      }
      await _loadHomeLocation();
      if (!mounted) return;
      if (!wasResponder) {
        final notes = data['notes']?.toString();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _showApprovedModal(notes: notes);
        });
      }
    }
  }

  void _popOverlayRoutes() {
    final navigator = Navigator.of(context, rootNavigator: false);
    while (navigator.canPop()) {
      navigator.pop();
    }
  }

  Future<void> _showRevokeModal({String? reason}) async {
    if (_revokeModalShowing || !mounted) return;
    _revokeModalShowing = true;
    final trimmedReason = reason?.trim();
    final bodyParts = <String>[
      'Volunteer responder access was removed.',
      if (trimmedReason != null && trimmedReason.isNotEmpty)
        'Reason: $trimmedReason',
    ];
    await showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Responder access revoked'),
        content: Text(bodyParts.join('\n\n')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
    if (mounted) {
      setState(() => _revokeModalShowing = false);
    } else {
      _revokeModalShowing = false;
    }
    _restartShakeListening();
  }

  Future<void> _showApprovedModal({String? notes}) async {
    if (_approveModalShowing || !mounted) return;
    _approveModalShowing = true;
    final trimmedNotes = notes?.trim();
    final bodyParts = <String>[
      'Responder tab is now available.',
      if (trimmedNotes != null && trimmedNotes.isNotEmpty)
        'Reviewer notes: $trimmedNotes',
    ];
    await showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('You\'re a responder'),
        content: Text(bodyParts.join('\n\n')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              if (!mounted) return;
              setState(() => _currentIndex = 2);
            },
            child: const Text('Open Responder'),
          ),
        ],
      ),
    );
    if (mounted) {
      setState(() => _approveModalShowing = false);
    } else {
      _approveModalShowing = false;
    }
    _restartShakeListening();
  }

  Future<void> _loadHomeLocation() async {
    setState(() {
      _loadingLocation = true;
      _locationTimestamp = 'Updating...';
    });

    final result = await AuthService().getProfile();
    if (!mounted) return;

    final now = TimeOfDay.now();
    final hour12 = now.hourOfPeriod == 0 ? 12 : now.hourOfPeriod;
    final period = now.period == DayPeriod.am ? 'AM' : 'PM';
    final timestamp =
        'Updated $hour12:${now.minute.toString().padLeft(2, '0')} $period';

    if (result['success'] == true) {
      // Re-check role after profile refresh (covers just-approved responders)
      final user = result['user'] as Map<String, dynamic>? ?? {};
      final freshRole = user['role']?.toString();
      if (freshRole != null && freshRole.isNotEmpty) {
        await AuthService().cacheUserRole(freshRole);
      }
      final hasTab = AuthService().hasResponderTab;
      if (mounted && freshRole != null && hasTab != _isResponder) {
        setState(() => _isResponder = hasTab);
        if (hasTab) {
          WebSocketService().disconnect();
          WebSocketService().connect();
          unawaited(_initResponderAlerts());
        } else {
          _responderAlertCoordinator.stop();
        }
        _restartShakeListening();
      }
      setState(() {
        _loadingLocation = false;
        _locationTitle = 'Dagupan City, Pangasinan';
        _locationTimestamp = timestamp;
      });
      return;
    }

    setState(() {
      _loadingLocation = false;
      _locationTitle = 'Dagupan City, Pangasinan';
      _locationTimestamp = timestamp;
    });
  }

  void _triggerSos() {
    if (_sosCountdown > 0) return;
    _startSosCountdown();
  }

  void _startSosCountdown() {
    _sosTimer?.cancel();
    _startSosCancelVibration();
    setState(() => _sosCountdown = 5);
    _sosTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _sosCountdown--;
        if (_sosCountdown <= 0) {
          t.cancel();
          _sosTimer = null;
          widget.onEmergencyNoAiPressed?.call();
        }
      });
    });
  }

  void _cancelSosCountdown() {
    _sosTimer?.cancel();
    _sosTimer = null;
    _stopSosCancelVibration();
    _shakeDetector.reset();
    _restartShakeListening();
    setState(() => _sosCountdown = 0);
  }

  static const Duration _sosVibrateDuration = Duration(seconds: 2);
  static const Duration _sosVibratePulse = Duration(milliseconds: 200);

  void _startSosCancelVibration() {
    _stopSosCancelVibration();
    HapticFeedback.heavyImpact();
    final endAt = DateTime.now().add(_sosVibrateDuration);
    _sosVibrateTimer = Timer.periodic(_sosVibratePulse, (_) {
      if (!mounted || DateTime.now().isAfter(endAt)) {
        _stopSosCancelVibration();
        return;
      }
      HapticFeedback.heavyImpact();
    });
  }

  void _stopSosCancelVibration() {
    _sosVibrateTimer?.cancel();
    _sosVibrateTimer = null;
  }

  String? _formatNotificationTitle(IncidentEvent event) {
    final reportId = event.reportId;
    final prefix = reportId != null ? 'Report #$reportId: ' : '';
    switch (event.event) {
      case 'incident:created':
        return '${prefix}New incident reported';
      case 'incident:status_updated':
        return '${prefix}Status: ${event.status ?? 'updated'}';
      case 'incident:verified':
        return '${prefix}Verified';
      case 'incident:dispatched':
        return '${prefix}Dispatched';
      case 'incident:resolution_confirmed':
        return '${prefix}Resolved';
      case 'incident:accepted':
        return '${prefix}A responder is on the way';
      case 'responder:status_changed':
        final newStatus = event.data['new_status']?.toString() ?? '';
        return '${prefix}Responder: $newStatus';
      case 'application:status_changed':
        final appStatus = event.data['status']?.toString().toLowerCase() ?? 'updated';
        if (appStatus == 'approved') return 'Your responder application was approved ✓';
        if (appStatus == 'revoked') return 'Your volunteer responder status was revoked';
        if (appStatus == 'rejected') return 'Your responder application was not approved';
        return 'Application $appStatus';
      case 'responder:backup_requested':
        return '${prefix}Backup requested';
      case 'responder:backup_alert':
        return '${prefix}Backup needed nearby';
      case 'responder:backup_joined':
        return '${prefix}Backup volunteer joined';
      default:
        return reportId != null ? '${prefix}Updated' : null;
    }
  }

  int _currentIndex = 0;
  int _tabSwitchCounter = 0;

  // ── SOS countdown overlay ──────────────────────────────────────────────────
  Widget _buildSosCountdownOverlay() {
    return Material(
      color: Colors.black54,
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 32),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1F2E),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFEF4444).withValues(alpha: 0.3),
                blurRadius: 24,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                ),
                child: const Icon(Icons.warning_amber_rounded,
                    color: Color(0xFFEF4444), size: 52),
              ),
              const SizedBox(height: 16),
              Text(
                'SOS in $_sosCountdown',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _cancelSosCountdown,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cancel', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Shared header logo ─────────────────────────────────────────────────────
  Widget _buildHeaderLogo() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/icon.png',
          width: 72,
          height: 72,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Icon(
            Icons.health_and_safety,
            color: Colors.white,
            size: 72,
          ),
        ),
        const SizedBox(width: 12),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, height: 1.1),
                children: [
                  TextSpan(
                      text: 'Rescue',
                      style: TextStyle(color: Colors.white)),
                  TextSpan(
                      text: 'Link',
                      style: TextStyle(color: Color(0xFFFF6B6B))),
                ],
              ),
            ),
            SizedBox(height: 2),
            Text(
              "Dagupan's Emergency App",
              style: TextStyle(
                fontSize: 12,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── Notification bell ──────────────────────────────────────────────────────
  Widget _buildNotificationBell() {
    final totalUnread = _apiUnreadCount + _unreadReportsCount;
    return Stack(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: IconButton(
            padding: EdgeInsets.zero,
            icon: const Icon(Icons.notifications_outlined,
                color: Colors.white, size: 22),
            onPressed: () => _openNotifications(context),
          ),
        ),
        if (totalUnread > 0)
          Positioned(
            top: 2,
            right: 2,
            child: Container(
              width: 14,
              height: 14,
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  totalUnread > 9 ? '9+' : '$totalUnread',
                  style: const TextStyle(
                      fontSize: 8,
                      color: Colors.white,
                      fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ── Notifications nav ──────────────────────────────────────────────────────
  void _openNotifications(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (ctx) => Scaffold(
          backgroundColor: const Color(0xFF0F1420),
          body: Column(
            children: [
              _buildSubScreenHeader(ctx, 'Notifications'),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: NotificationsScreen(
                    onNotificationTap: (reportId) {
                      Navigator.of(ctx).pop();
                      if (reportId != null) {
                        _openIncidentByInvolvement(reportId);
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((_) => _fetchUnreadCount());
  }

  // ── Sub-screen header (used for notifications push route) ─────────────────
  Widget _buildSubScreenHeader(BuildContext ctx, String title) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0xFF111827),
        border: Border(bottom: BorderSide(color: Color(0xFF1F2937), width: 1)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(ctx).pop(),
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── HOME TAB ───────────────────────────────────────────────────────────────
  Widget _buildHomeContent() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final bgColor = isDark ? const Color(0xFF0F1420) : const Color(0xFFF1F5F9);
        final cardColor = isDark ? const Color(0xFF1A2035) : Colors.white;
        final cardBorder = isDark ? const Color(0xFF252D40) : const Color(0xFFE2E8F0);
        final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
        final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

        return RefreshIndicator(
          onRefresh: _loadHomeLocation,
          color: const Color(0xFFEF4444),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: StaggeredFadeIn(
              staggerDelayMs: 40,
              trigger: _currentIndex == 0 ? _tabSwitchCounter : null,
              children: [
                // ── Header ─────────────────────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF111827) : const Color(0xFF0F172A),
                  ),
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 16),
                      child: Row(
                        children: [
                          Expanded(child: _buildHeaderLogo()),
                          _buildNotificationBell(),
                        ],
                      ),
                    ),
                  ),
                ),

                // ── Body ────────────────────────────────────────────────────
                Container(
                  color: bgColor,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Location card
                        _buildLocationCard(
                            cardColor, cardBorder, textPrimary, textSecondary),
                        const SizedBox(height: 12),

                        // System status card
                        _buildStatusCard(cardColor, cardBorder),
                        const SizedBox(height: 20),

                        // SOS + Report row
                        _buildActionTiles(),
                        const SizedBox(height: 20),

                        // Emergency Tips
                        _buildEmergencyTipsSection(
                            cardColor, cardBorder, textPrimary, textSecondary),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLocationCard(Color card, Color border, Color primary, Color secondary) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFF1E3A5F),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.location_on,
                color: Color(0xFF60A5FA), size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Current Location',
                  style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                      fontWeight: FontWeight.w400),
                ),
                const SizedBox(height: 2),
                Text(
                  _loadingLocation ? 'Loading...' : _locationTitle,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: primary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  _locationTimestamp,
                  style: TextStyle(fontSize: 12, color: secondary),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh, color: secondary, size: 20),
            onPressed: _loadingLocation ? null : _loadHomeLocation,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard(Color card, Color border) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFF14532D),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.shield,
                color: Color(0xFF22C55E), size: 20),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ready',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF22C55E),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'GPS · Online · Connected',
                  style: TextStyle(
                      fontSize: 12, color: Color(0xFF9CA3AF), height: 1.4),
                ),
              ],
            ),
          ),
          Semantics(
            label: 'All systems ready',
            child: Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                color: Color(0xFF22C55E),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTiles() {
    return Row(
      children: [
        // SOS tile
        Expanded(
          child: Semantics(
            button: true,
            label: 'SOS. Tap or shake to activate',
            child: GestureDetector(
              onTap: () {
                if (_sosCountdown > 0) return;
                _triggerSos();
              },
              child: Container(
                height: 170,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                      child: const Icon(
                        Icons.notifications_active,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'SOS',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Tap or shake',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFFFFCDD2),
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Report Incident tile
        Expanded(
          child: GestureDetector(
            onTap: widget.onSosPressed,
            child: Container(
              height: 170,
              decoration: BoxDecoration(
                color: const Color(0xFF1A2035),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF252D40)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF252D40),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        const Icon(Icons.description_outlined,
                            color: Colors.white, size: 34),
                        Positioned(
                          bottom: 12,
                          right: 10,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: Color(0xFF3B82F6),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.photo_camera,
                                color: Colors.white, size: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Report',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // Emergency tips data: title, subtitle, icon, colors, and full content
  static const List<
      ({
        String title,
        String subtitle,
        IconData icon,
        Color iconColor,
        Color iconBg,
        String content
      })> _emergencyTips = [
    (
      title: 'Fire Safety',
      subtitle: 'What to do during a fire',
      icon: Icons.local_fire_department,
      iconColor: Color(0xFFF97316),
      iconBg: Color(0xFF7F1D1D),
      content:
          'Keep fire extinguishers accessible and maintain clear escape routes. Never use elevators during a fire — always take the stairs. If there is smoke, stay low to the ground. Feel doors before opening; if hot, use another exit. Once outside, do not re-enter the building. Call 911 immediately.',
    ),
    (
      title: 'Medical Emergency',
      subtitle: 'First aid and medical tips',
      icon: Icons.medical_services,
      iconColor: Color(0xFF22C55E),
      iconBg: Color(0xFF14532D),
      content:
          'Call for emergency help first. Do not move an injured person unless they are in immediate danger. Apply firm pressure to stop bleeding using a clean cloth. If the person is unconscious but breathing, place them in the recovery position. Know your blood type and any allergies in advance. Keep a first-aid kit at home.',
    ),
    (
      title: 'Flood Safety',
      subtitle: 'Before, during and after a flood',
      icon: Icons.water,
      iconColor: Color(0xFF38BDF8),
      iconBg: Color(0xFF1E3A5F),
      content:
          'Never walk or drive through floodwaters — even 6 inches can knock you off your feet. Move to higher ground immediately when advised. Avoid downed power lines and standing water that may be electrified. Have an emergency kit ready with food, water, medicines, and important documents. Monitor official PAGASA advisories.',
    ),
    (
      title: 'Typhoon Preparedness',
      subtitle: 'Prepare and stay safe',
      icon: Icons.cyclone,
      iconColor: Color(0xFFA78BFA),
      iconBg: Color(0xFF4C1D95),
      content:
          'Stock at least 3 days of food, drinking water, and essential medicines. Secure or bring in loose outdoor objects. Reinforce windows and doors. Stay indoors and away from windows during the typhoon. Monitor PAGASA and NDRRMC advisories. Know your local evacuation routes and barangay assembly points.',
    ),
    (
      title: 'Earthquake Safety',
      subtitle: 'Drop, Cover, and Hold On',
      icon: Icons.vibration,
      iconColor: Color(0xFFF59E0B),
      iconBg: Color(0xFF78350F),
      content:
          'During shaking: Drop to hands and knees, take Cover under a sturdy table, and Hold On until the shaking stops. Stay away from windows, shelving, and heavy objects. If outdoors, move to an open area away from buildings. After the quake, check for hazards like gas leaks, damaged structures, or downed power lines before moving around.',
    ),
  ];

  Widget _buildEmergencyTipsSection(
      Color card, Color border, Color primary, Color secondary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Emergency Tips',
            style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: primary)),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: border),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              children: _emergencyTips.asMap().entries.map((entry) {
                final i = entry.key;
                final tip = entry.value;
                final isLast = i == _emergencyTips.length - 1;
                return Column(
                  children: [
                    Theme(
                      // Remove default ExpansionTile dividers / splash colour
                      data: Theme.of(context).copyWith(
                        dividerColor: Colors.transparent,
                        splashColor: Colors.transparent,
                        highlightColor: Colors.transparent,
                      ),
                      child: ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 4),
                        childrenPadding: EdgeInsets.zero,
                        leading: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: tip.iconBg,
                            shape: BoxShape.circle,
                          ),
                          child:
                              Icon(tip.icon, color: tip.iconColor, size: 20),
                        ),
                        title: Text(
                          tip.title,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: primary),
                        ),
                        subtitle: Text(
                          tip.subtitle,
                          style: TextStyle(fontSize: 12, color: secondary),
                        ),
                        iconColor: tip.iconColor,
                        collapsedIconColor: secondary,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(66, 0, 14, 14),
                            child: Text(
                              tip.content,
                              style: TextStyle(
                                  fontSize: 13,
                                  color: secondary,
                                  height: 1.55),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!isLast)
                      Divider(
                          height: 1,
                          color: border,
                          indent: 14,
                          endIndent: 14),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  // ── REPORTS TAB ────────────────────────────────────────────────────────────
  Widget _buildReportHistoryContent() {
    return StaggeredFadeIn.single(
      trigger: _currentIndex == 1 ? _tabSwitchCounter : null,
      child: ReportHistoryScreen(
        onReportTap: widget.onReportTap,
        onReportIncidentTap: widget.onSosPressed,
        onNotificationsTap: () => _openNotifications(context),
        unreadNotificationCount: _apiUnreadCount + _unreadReportsCount,
      ),
    );
  }

  // ── SETTINGS TAB ───────────────────────────────────────────────────────────
  Widget _buildSettingsContent() {
    final settingsIndex = _isResponder ? 3 : 2;
    return StaggeredFadeIn.single(
      trigger: _currentIndex == settingsIndex ? _tabSwitchCounter : null,
      child: SettingsScreen(
        onThemeChanged: widget.onThemeChanged,
        onLogout: widget.onLogout,
        onPhoneNumberTap: widget.onPhoneNumberTap,
        onBarangayTap: widget.onBarangayTap,
        onEmergencyContactsTap: widget.onEmergencyContactsTap,
        onChangePasswordTap: widget.onChangePasswordTap,
        onPrivacySecurityTap: widget.onPrivacySecurityTap,
        onAboutTap: widget.onAboutTap,
        onNotificationsTap: () => _openNotifications(context),
      ),
    );
  }

  // ── SCAFFOLD ───────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    _responderAlertCoordinator.updateContext(context);
    final screenWidth = MediaQuery.sizeOf(context).width;
    final List<Widget> pages = [
      _buildHomeContent(),
      _buildReportHistoryContent(),
      if (_isResponder)
        ResponderDashboardScreen(
          key: _responderDashboardKey,
          online: _responderOnline,
          onNotificationsTap: () => _openNotifications(context),
          unreadNotificationCount: _apiUnreadCount + _unreadReportsCount,
          onOnlineStatusChanged: _onResponderOnlineChanged,
        ),
      _buildSettingsContent(),
    ];

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Stack(
        children: [
          IndexedStack(index: _currentIndex, children: pages),
          if (_sosCountdown > 0) _buildSosCountdownOverlay(),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(screenWidth),
    );
  }

  Widget _buildBottomNav(double screenWidth) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final settingsIndex = _isResponder ? 3 : 2;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF111827) : Colors.white,
        border: Border(
          top: BorderSide(
              color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE5E7EB)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _navItem(0, Icons.home_rounded, Icons.home_outlined, 'Home', screenWidth),
              _navItem(1, Icons.assignment_rounded, Icons.assignment_outlined, 'Reports', screenWidth,
                  badgeCount: _unreadReportsCount),
              if (_isResponder)
                _navItem(2, Icons.shield_rounded, Icons.shield_outlined, 'Responder', screenWidth),
              _navItem(settingsIndex, Icons.settings_rounded, Icons.settings_outlined, 'Settings', screenWidth),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(
    int index,
    IconData activeIcon,
    IconData inactiveIcon,
    String label,
    double screenWidth, {
    int badgeCount = 0,
  }) {
    final isSelected = _currentIndex == index;
    final labelSize = Responsive.navLabelSize(screenWidth);
    return InkWell(
      onTap: () {
        if (_currentIndex == index) return;
        setState(() {
          _currentIndex = index;
          _tabSwitchCounter++;
          if (index == 1) _unreadReportsCount = 0;
        });
        if (_isResponder && index == 2) {
          unawaited(_syncResponderOnlineFromServer());
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isSelected ? activeIcon : inactiveIcon,
                  size: 24,
                  color: isSelected
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF6B7280),
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: labelSize,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF6B7280),
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 3),
              Container(
                height: 2,
                width: 20,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(1),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
