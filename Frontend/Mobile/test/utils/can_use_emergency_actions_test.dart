import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/can_use_emergency_actions.dart';

void main() {
  test('bypass unlocks even when outside or unknown', () {
    expect(
      canUseEmergencyActions(inServiceArea: false, bypass: true),
      isTrue,
    );
    expect(
      canUseEmergencyActions(inServiceArea: null, bypass: true),
      isTrue,
    );
  });

  test('in service area allows actions', () {
    expect(
      canUseEmergencyActions(inServiceArea: true, bypass: false),
      isTrue,
    );
  });

  test('outside or unknown locks actions (fail closed)', () {
    expect(
      canUseEmergencyActions(inServiceArea: false, bypass: false),
      isFalse,
    );
    expect(
      canUseEmergencyActions(inServiceArea: null, bypass: false),
      isFalse,
    );
  });
}
