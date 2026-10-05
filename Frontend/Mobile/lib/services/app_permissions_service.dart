import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'geolocation_service.dart';
import 'onesignal_service.dart';

/// One-time core permission batch after first login (location, mic, push, camera).
class AppPermissionsService {
  static const String _promptedKey = 'rescuelink_core_permissions_prompted_v1';

  Future<bool> shouldPrompt() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_promptedKey) != true;
  }

  Future<void> markPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_promptedKey, true);
  }

  Future<void> requestCorePermissions() async {
    await GeolocationService.requestLocationPermission();
    final micRecorder = AudioRecorder();
    try {
      await micRecorder.hasPermission();
    } finally {
      await micRecorder.dispose();
    }

    final onesignal = OneSignalService();
    await onesignal.requestPermission();
    await onesignal.markPermissionPrompted();

    await Permission.camera.request();
  }

  /// Best-effort check without prompting (for settings display if needed later).
  Future<bool> hasLocationGranted() async {
    final p = await Geolocator.checkPermission();
    return p == LocationPermission.always ||
        p == LocationPermission.whileInUse;
  }
}
