import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// OneSignal Mobile Push Notification Service
/// Integrates the official onesignal_flutter SDK with fallback safety.
class OneSignalService {
  static final OneSignalService _instance = OneSignalService._internal();
  factory OneSignalService() => _instance;
  OneSignalService._internal();

  static const String _pushEnabledKey = 'rescuelink_push_notifications_enabled';
  static const String _promptedKey = 'rescuelink_prompted_push_permission';

  bool _initialized = false;

  /// Initialize OneSignal with App ID from environment
  Future<void> init({void Function(String reportId)? onNotificationOpened}) async {
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
        if (reportId != null && onNotificationOpened != null) {
          onNotificationOpened(reportId);
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
      if (_initialized) {
        final permission = OneSignal.Notifications.permission;
        final optOut = OneSignal.User.pushSubscription.optedIn == false;
        if (!permission || optOut) return false;
      }
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(_pushEnabledKey) ?? false;
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
        OneSignal.User.pushSubscription.optIn();
        await prefs.setBool(_pushEnabledKey, granted);
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
          OneSignal.User.pushSubscription.optIn();
        } else {
          OneSignal.User.pushSubscription.optOut();
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
      if (kDebugMode) {
        print('[OneSignal Mobile] Linked user external ID: $userId');
      }
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
