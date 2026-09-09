import 'dart:math';

/// Detects deliberate phone shakes from user-accelerometer samples (gravity stripped).
class SosShakeDetector {
  // ponytail: fixed threshold; raise toward 15 if pocket false-positives show up in field
  SosShakeDetector({
    this.spikeThreshold = 12.0,
    this.windowMs = 500,
    this.requiredSpikes = 2,
    this.cooldownMs = 1500,
  });

  final double spikeThreshold;
  final int windowMs;
  final int requiredSpikes;
  final int cooldownMs;

  int? _windowStartMs;
  int _spikeCount = 0;
  int? _lastFireAtMs;

  /// Returns true when a shake pattern is recognized.
  bool feed(double x, double y, double z, {required int nowMs}) {
    if (_lastFireAtMs != null && nowMs - _lastFireAtMs! < cooldownMs) {
      return false;
    }

    final magnitude = sqrt(x * x + y * y + z * z);
    if (magnitude < spikeThreshold) return false;

    if (_windowStartMs == null || nowMs - _windowStartMs! > windowMs) {
      _windowStartMs = nowMs;
      _spikeCount = 1;
    } else {
      _spikeCount++;
    }

    if (_spikeCount < requiredSpikes) return false;

    _spikeCount = 0;
    _windowStartMs = null;
    _lastFireAtMs = nowMs;
    return true;
  }

  /// Clears in-progress spike tracking and cooldown (e.g. after user cancels SOS).
  void reset() {
    _windowStartMs = null;
    _spikeCount = 0;
    _lastFireAtMs = null;
  }

  /// Runnable self-check for threshold logic.
  static void demo() {
    final d = SosShakeDetector();
    assert(!d.feed(0, 0, 0, nowMs: 0));
    assert(!d.feed(5, 5, 5, nowMs: 50));
    assert(!d.feed(20, 0, 0, nowMs: 100));
    assert(d.feed(0, 13, 0, nowMs: 150));
    assert(!d.feed(13, 0, 0, nowMs: 200)); // cooldown
    final d2 = SosShakeDetector(cooldownMs: 0);
    assert(!d2.feed(13, 0, 0, nowMs: 0)); // single spike
    assert(d2.feed(0, 13, 0, nowMs: 50));
  }
}
