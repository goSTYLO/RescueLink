import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/sos_shake_detector.dart';

void main() {
  test('walking-scale samples do not trigger', () {
    final d = SosShakeDetector();
    expect(d.feed(2, 3, 4, nowMs: 0), isFalse);
    expect(d.feed(5, 5, 5, nowMs: 50), isFalse);
  });

  test('two spikes within window trigger once', () {
    final d = SosShakeDetector(cooldownMs: 0);
    expect(d.feed(20, 0, 0, nowMs: 0), isFalse);
    expect(d.feed(0, 20, 0, nowMs: 50), isTrue);
  });

  test('cooldown prevents immediate retrigger', () {
    final d = SosShakeDetector();
    expect(d.feed(20, 0, 0, nowMs: 0), isFalse);
    expect(d.feed(0, 20, 0, nowMs: 50), isTrue);
    expect(d.feed(20, 0, 0, nowMs: 100), isFalse);
    expect(d.feed(0, 20, 0, nowMs: 150), isFalse);
  });

  test('single spike does not trigger', () {
    final d = SosShakeDetector(cooldownMs: 0);
    expect(d.feed(25, 25, 25, nowMs: 0), isFalse);
  });

  test('reset clears cooldown and partial spikes', () {
    final d = SosShakeDetector();
    expect(d.feed(20, 0, 0, nowMs: 0), isFalse);
    expect(d.feed(0, 20, 0, nowMs: 50), isTrue);
    d.reset();
    expect(d.feed(20, 0, 0, nowMs: 100), isFalse);
    expect(d.feed(0, 20, 0, nowMs: 150), isTrue);
  });

  test('demo self-check passes', () {
    SosShakeDetector.demo();
  });
}
