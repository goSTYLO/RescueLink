import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pure rule for Settings / staff checks (unit-tested).
/// Preference defaults to true when unset; SDK must allow when ready.
bool effectivePushEnabled({
  required bool? preferPush,
  required bool sdkReady,
  required bool osPermission,
  required bool optedOut,
}) {
  final prefer = preferPush ?? true;
  if (!prefer) return false;
  if (!sdkReady) return prefer;
  return osPermission && !optedOut;
}

/// OneSignal Mobile Push Notification Service
/// Integrates the official onesignal_flutter SDK with fallback safety.
///
/// Amber / emergency pushes use Android channel id [emergencyAndroidChannelId]
/// (must match OneSignal dashboard + Backend EMERGENCY_ANDROID_CHANNEL_ID).
///
/// Permission is requested after login; [ensureOptedInIfAllowed] finishes opt-in
/// once the OS grant lands (login alone often leaves optedIn=false).
class OneSignalService {
  static final OneSignalService _instance = OneSignalService._internal();
  factory OneSignalService() => _instance;
  OneSignalService._internal();

  /// Matches Backend `EMERGENCY_ANDROID_CHANNEL_ID` / OneSignal dashboard channel.
  static const String emergencyAndroidChannelId = '724e011a-e821-4e40-a810-9c175737a997';

  static const String _pushEnabledKey = 'rescuelink_push_notifications_enabled';
  static const String _promptedKey = 'rescuelink_prompted_push_permission';

  bool _initialized = false;
  bool _optInInFlight = false;
  void Function(String reportId)? _onNotificationOpened;
  String? _pendingOpenedReportId;

  /// Register a deep-link handler after the app has a navigator (e.g. home screen).
  void setOnNotificationOpened(void Function(String reportId)? callback) {
    _onNotificationOpened = callback;
    final pending = _pendingOpenedReportId;
    if (callback != null && pending != null) {
      _pendingOpenedReportId = null;
      callback(pending);
    }
  }

  void _handleOpenedReportId(String reportId) {
    final cb = _onNotificationOpened;
    if (cb != null) {
      cb(reportId);
    } else {
      _pendingOpenedReportId = reportId;
    }
  }

  Future<void> _logSubscriptionState(String label) async {
    if (!kDebugMode || !_initialized) return;
    final sub = OneSignal.User.pushSubscription;
    final token = sub.token;
    final externalId = await OneSignal.User.getExternalId();
    print(
      '[OneSignal Mobile] $label '
      'externalId=$externalId '
      'subscriptionId=${sub.id} '
      'optedIn=${sub.optedIn} '
      'permission=${OneSignal.Notifications.permission} '
      'tokenPresent=${token != null && token.isNotEmpty}',
    );
  }

  /// If OS permission + local preference allow push but SDK is still opted out, opt in.
  Future<void> ensureOptedInIfAllowed() async {
    if (!_initialized || _optInInFlight) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final preferPush = prefs.getBool(_pushEnabledKey) ?? true;
      if (!preferPush) return;
      if (!OneSignal.Notifications.permission) return;
      if (OneSignal.User.pushSubscription.optedIn == true) return;

      _optInInFlight = true;
      try {
        await OneSignal.User.pushSubscription.optIn();
        await _logSubscriptionState('ensureOptedInIfAllowed');
      } finally {
        _optInInFlight = false;
      }
    } catch (e) {
      _optInInFlight = false;
      if (kDebugMode) {
        print('[OneSignal Mobile] ensureOptedInIfAllowed error: $e');
      }
    }
  }

  /// Initialize OneSignal with App ID from environment
  Future<void> init({void Function(String reportId)? onNotificationOpened}) async {
    if (onNotificationOpened != null) {
      _onNotificationOpened = onNotificationOpened;
    }
    if (_initialized) return;

    final appId = dotenv.env['ONESIGNAL_APP_ID'];
    if (appId == null || appId.trim().isEmpty) {
      if (kDebugMode) {
        print('[OneSignal Mobile] ONESIGNAL_APP_ID not set; skipping mobile push init in dev.');
      }
      return;
    }

    try {
      if (kDebugMode) {
        OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
      } else {
        OneSignal.Debug.setLogLevel(OSLogLevel.none);
      }

      OneSignal.initialize(appId.trim());
      _initialized = true;

      // Handle notification click / tap deep linking
      OneSignal.Notifications.addClickListener((event) {
        final data = event.notification.additionalData;
        final reportId = data?['report_id']?.toString() ?? data?['reportId']?.toString();
        if (reportId != null && reportId.isNotEmpty) {
          _handleOpenedReportId(reportId);
        }
      });

      // Always recover: permission often lands after login, leaving optedIn=false.
      OneSignal.User.pushSubscription.addObserver((state) {
        final current = state.current;
        if (kDebugMode) {
          final token = current.token;
          print(
            '[OneSignal Mobile] subscription changed '
            'id=${current.id} optedIn=${current.optedIn} '
            'tokenPresent=${token != null && token.isNotEmpty}',
          );
        }
        if (current.optedIn != true) {
          // Fire-and-forget; ensureOptedInIfAllowed re-checks permission + prefs.
          ensureOptedInIfAllowed();
        }
      });

      if (kDebugMode) {
        print('[OneSignal Mobile] Initialized with App ID: $appId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[OneSignal Mobile] Init error: $e');
      }
    }
  }

  /// Checks if push notifications are enabled locally in preferences and SDK
  Future<bool> isPushEnabled() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final preferPush = prefs.getBool(_pushEnabledKey);
      if (!_initialized) {
        return effectivePushEnabled(
          preferPush: preferPush,
          sdkReady: false,
          osPermission: false,
          optedOut: false,
        );
      }
      return effectivePushEnabled(
        preferPush: preferPush,
        sdkReady: true,
        osPermission: OneSignal.Notifications.permission,
        optedOut: OneSignal.User.pushSubscription.optedIn == false,
      );
    } catch (_) {
      return false;
    }
  }

  /// Request push notification access from user and enable notifications
  Future<bool> requestPermission() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_promptedKey, true);

      if (_initialized) {
        final granted = await OneSignal.Notifications.requestPermission(true);
        if (granted) {
          await prefs.setBool(_pushEnabledKey, true);
          await OneSignal.User.pushSubscription.optIn();
          await _logSubscriptionState('afterPermission');
        } else {
          await prefs.setBool(_pushEnabledKey, false);
        }
        if (kDebugMode) {
          print('[OneSignal Mobile] Permission response: $granted');
        }
        return granted;
      }

      await prefs.setBool(_pushEnabledKey, true);
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('[OneSignal Mobile] requestPermission error: $e');
      }
      return false;
    }
  }

  /// Set push notification preference directly (enable / disable)
  Future<void> setPushEnabled(bool enabled) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_pushEnabledKey, enabled);

      if (_initialized) {
        if (enabled) {
          await OneSignal.User.pushSubscription.optIn();
        } else {
          await OneSignal.User.pushSubscription.optOut();
        }
      }

      if (kDebugMode) {
        print('[OneSignal Mobile] Push notification enabled set to: $enabled');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[OneSignal Mobile] setPushEnabled error: $e');
      }
    }
  }

  /// Check if the 1-time launch prompt has already been shown
  Future<bool> hasPromptedPermission() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_promptedKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Mark that the 1-time prompt has been presented
  Future<void> markPermissionPrompted() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_promptedKey, true);
    } catch (_) {}
  }

  /// Associate device with internal RescueLink user ID
  Future<void> loginUser(int userId) async {
    if (!_initialized) return;
    try {
      await OneSignal.login(userId.toString());
      // Permission is usually granted after login on home; opt-in when already allowed.
      await ensureOptedInIfAllowed();
      await _logSubscriptionState('Linked user external ID: $userId');
    } catch (e) {
      if (kDebugMode) {
        print('[OneSignal Mobile] loginUser error: $e');
      }
    }
  }

  /// Remove user association on logout
  Future<void> logoutUser() async {
    if (!_initialized) return;
    try {
      await OneSignal.logout();
      if (kDebugMode) {
        print('[OneSignal Mobile] Logged out user');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[OneSignal Mobile] logoutUser error: $e');
      }
    }
  }
}
