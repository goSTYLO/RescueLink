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
}
