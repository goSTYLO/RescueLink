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
