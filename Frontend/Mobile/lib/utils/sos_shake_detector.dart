import 'dart:math';

/// Detects deliberate phone shakes from user-accelerometer samples (gravity stripped).
class SosShakeDetector {
  /// Must fall below this fraction of [spikeThreshold] before the next spike counts.
  static const releaseRatio = 0.5;

  // ponytail: fixed threshold. One bump used to count every sensor sample, so
  // faster phones fired SOS. Rising edges only; raise threshold if pockets still false-trigger.
  SosShakeDetector({
    this.spikeThreshold = 15.0,
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
  bool _armed = true;

  /// Returns true when a shake pattern is recognized.
  bool feed(double x, double y, double z, {required int nowMs}) {
    final magnitude = sqrt(x * x + y * y + z * z);
    if (magnitude < spikeThreshold * releaseRatio) _armed = true;

    if (_lastFireAtMs != null && nowMs - _lastFireAtMs! < cooldownMs) {
      return false;
    }
    if (!_armed || magnitude < spikeThreshold) return false;
    _armed = false;

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
    _armed = true;
  }

  /// Runnable self-check for threshold logic.
  static void demo() {
    final d = SosShakeDetector();
    assert(!d.feed(0, 0, 0, nowMs: 0));
    assert(!d.feed(5, 5, 5, nowMs: 50));
    assert(!d.feed(20, 0, 0, nowMs: 100));
    assert(!d.feed(20, 0, 0, nowMs: 120)); // same jolt, still above threshold
    assert(!d.feed(0, 0, 0, nowMs: 140));
    assert(d.feed(0, 20, 0, nowMs: 200));
    assert(!d.feed(20, 0, 0, nowMs: 250)); // cooldown
    final d2 = SosShakeDetector(cooldownMs: 0);
    assert(!d2.feed(20, 0, 0, nowMs: 0)); // single spike
    assert(!d2.feed(0, 0, 0, nowMs: 20));
    assert(d2.feed(0, 20, 0, nowMs: 50));
  }
}
