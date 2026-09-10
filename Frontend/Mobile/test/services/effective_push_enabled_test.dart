import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/services/onesignal_service.dart';

void main() {
  group('effectivePushEnabled', () {
    test('defaults preferPush to true when unset and SDK not ready', () {
      expect(
        effectivePushEnabled(
          preferPush: null,
          sdkReady: false,
          osPermission: false,
          optedOut: false,
        ),
        isTrue,
      );
    });

    test('respects explicit preferPush false', () {
      expect(
        effectivePushEnabled(
          preferPush: false,
          sdkReady: true,
          osPermission: true,
          optedOut: false,
        ),
        isFalse,
      );
    });

    test('requires OS permission and not opted out when SDK ready', () {
      expect(
        effectivePushEnabled(
          preferPush: true,
          sdkReady: true,
          osPermission: true,
          optedOut: false,
        ),
        isTrue,
      );
      expect(
        effectivePushEnabled(
          preferPush: true,
          sdkReady: true,
          osPermission: false,
          optedOut: false,
        ),
        isFalse,
      );
      expect(
        effectivePushEnabled(
          preferPush: true,
          sdkReady: true,
          osPermission: true,
          optedOut: true,
        ),
        isFalse,
      );
    });
  });
}
