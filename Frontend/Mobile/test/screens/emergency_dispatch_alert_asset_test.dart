import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/screens/common/emergency_dispatch_alert_modal.dart';

void main() {
  test('emergency alert asset path matches pubspec / res raw basename', () {
    expect(kEmergencyAlertAsset, 'sounds/emergency_alert.wav');
    expect(kEmergencyAlertAsset.endsWith('.wav'), isTrue);
    expect(kEmergencyAlertAsset.contains('.'), isTrue);
    // Android res/raw name has no extension; Flutter asset keeps .wav
    expect(kEmergencyAlertAsset.split('/').last.replaceAll('.wav', ''),
        'emergency_alert');
  });

  test('amber blare max duration is one minute', () {
    expect(kEmergencyAlertMaxDuration, const Duration(minutes: 1));
  });

  test('emergency channel uses alarm sound resource', () {
    final src = File(
      'android/app/src/main/kotlin/com/example/rescuelink_mobile/MainActivity.kt',
    );
    expect(src.existsSync(), isTrue);
    final text = src.readAsStringSync();
    expect(text.contains('R.raw.emergency_alert'), isTrue);
    expect(text.contains('USAGE_ALARM'), isTrue);
    expect(text.contains('setSound(null, null)'), isFalse);
  });

  test('foreground critical staff path suppresses tray so modal owns sound', () {
    final src = File('lib/services/onesignal_service.dart').readAsStringSync();
    expect(src.contains('preventDefault()'), isTrue);
    expect(src.contains('_staffOwnsForegroundAmber'), isTrue);
  });

  test('modal interaction stops native amber tray and FGS', () {
    final main = File(
      'android/app/src/main/kotlin/com/example/rescuelink_mobile/MainActivity.kt',
    ).readAsStringSync();
    expect(main.contains('rescuelink/amber'), isTrue);
    expect(main.contains('stopAmberAndCancelEmergencyTrays'), isTrue);
    final dart = File('lib/services/amber_alert_sound.dart').readAsStringSync();
    expect(dart.contains("invokeMethod('stop')"), isTrue);
    expect(dart.contains('_gen'), isTrue);
  });

  test('killed-app NSE starts FGS unless MainActivity is actually resumed', () {
    final nse = File(
      'android/app/src/main/kotlin/com/example/rescuelink_mobile/NotificationServiceExtension.kt',
    ).readAsStringSync();
    expect(nse.contains('RescueLinkUi.resumed'), isTrue);
    expect(nse.contains('IMPORTANCE_FOREGROUND'), isFalse);
    expect(nse.contains('ensureEmergencyChannel'), isTrue);
    expect(nse.contains('setChannelId'), isTrue);
  });

  test('volunteer incident alert modal uses the same amber sound helper', () {
    final src = File('lib/screens/responder/incident_alert_modal.dart').readAsStringSync();
    expect(src.contains('AmberAlertSound'), isTrue);
    expect(src.contains('AmberAlertSound.start()'), isTrue);
    expect(src.contains('AmberAlertSound.stop()'), isTrue);
  });

  test('tray tap consumes report so in-app modal does not stack under details', () {
    final emergency = File(
      'lib/services/emergency_dispatch_alert_coordinator.dart',
    ).readAsStringSync();
    expect(emergency.contains('void consumeReport(int reportId)'), isTrue);
    expect(emergency.contains('_openedFromPush'), isTrue);
    expect(emergency.contains('AmberAlertSound.stop()'), isTrue);
    final volunteer = File(
      'lib/services/responder_alert_coordinator.dart',
    ).readAsStringSync();
    expect(volunteer.contains('void consumeReport(int reportId)'), isTrue);
    expect(volunteer.contains('_openedFromPush'), isTrue);
    expect(volunteer.contains('AmberAlertSound.stop()'), isTrue);
    final home = File(
      'lib/screens/home/home_placeholder_screen.dart',
    ).readAsStringSync();
    expect(home.contains('_emergencyAlertCoordinator.consumeReport'), isTrue);
    expect(home.contains('_responderAlertCoordinator.consumeReport'), isTrue);
  });

  test('AndroidManifest registers OneSignal NotificationServiceExtension', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml');
    expect(manifest.existsSync(), isTrue);
    final text = manifest.readAsStringSync();
    expect(
      text.contains('com.onesignal.NotificationServiceExtension'),
      isTrue,
    );
    expect(
      text.contains(
        'com.example.rescuelink_mobile.NotificationServiceExtension',
      ),
      isTrue,
    );
    expect(text.contains('.AmberAlertPlayerService'), isTrue);
    expect(text.contains('FOREGROUND_SERVICE_SHORT_SERVICE'), isTrue);
  });
}
