import 'dart:async';

import 'package:flutter/services.dart';

/// Countdown length. One vibration beat per second.
const int sosCountdownBeats = 5;

/// Long full-strength hit, then a short gap, so each second of the countdown is one pulse.
const int sosBeatOnMs = 800;
const int sosBeatOffMs = 200;

/// Waveform timings: leading 0, then one on/off pair per countdown second.
List<int> sosVibrationTimings({int beats = sosCountdownBeats}) {
  final count = beats < 1 ? 1 : (beats > 10 ? 10 : beats);
  final timings = List<int>.filled(1 + count * 2, sosBeatOffMs);
  timings[0] = 0;
  for (var i = 0; i < count; i++) {
    timings[1 + i * 2] = sosBeatOnMs;
  }
  return timings;
}

/// Device vibrator for the SOS countdown. [HapticFeedback] is a UI tick and
/// stays silent on many Android phones when touch haptics are off.
class SosVibration {
  static const _channel = MethodChannel('rescuelink/sos');
  static Timer? _fallback;
  static int _gen = 0;

  static Future<void> start({int beats = sosCountdownBeats}) async {
    final gen = ++_gen;
    _fallback?.cancel();
    _fallback = null;
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {}
    if (gen != _gen) return;
    try {
      await _channel.invokeMethod<void>('vibrate', {
        'timings': sosVibrationTimings(beats: beats),
      });
      if (gen != _gen) {
        try {
          await _channel.invokeMethod<void>('stop');
        } catch (_) {}
      }
    } catch (_) {
      if (gen != _gen) return;
      var left = beats;
      void tick() {
        if (gen != _gen || left <= 0) {
          _fallback?.cancel();
          _fallback = null;
          return;
        }
        left--;
        HapticFeedback.heavyImpact();
      }

      tick();
      _fallback = Timer.periodic(const Duration(seconds: 1), (_) => tick());
    }
  }

  static Future<void> stop() async {
    _gen++;
    _fallback?.cancel();
    _fallback = null;
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {}
  }
}
