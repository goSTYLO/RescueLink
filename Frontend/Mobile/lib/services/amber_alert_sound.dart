import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Asset path for the amber foreground blare (must match pubspec + res/raw name).
const String kEmergencyAlertAsset = 'sounds/emergency_alert.wav';

/// Max amber blare / haptic duration (also matches tray sound length intent).
const Duration kEmergencyAlertMaxDuration = Duration(minutes: 1);

/// One shared WAV player. Tray-tap / dispose can race [start]; [_gen] drops stale plays.
class AmberAlertSound {
  static const _native = MethodChannel('rescuelink/amber');

  static AudioPlayer? _player;
  static Timer? _maxTimer;
  static int _gen = 0;

  static Future<void> start() async {
    final gen = ++_gen;
    await _stopPlayer();
    if (gen != _gen) return;
    _maxTimer = Timer(kEmergencyAlertMaxDuration, () {
      unawaited(stop());
    });
    final player = AudioPlayer();
    _player = player;
    try {
      await player.setAudioContext(
        AudioContext(
          android: const AudioContextAndroid(
            usageType: AndroidUsageType.alarm,
            contentType: AndroidContentType.sonification,
            audioFocus: AndroidAudioFocus.gainTransient,
            stayAwake: true,
          ),
        ),
      );
      if (gen != _gen) {
        await _abandon(player);
        return;
      }
      await player.setReleaseMode(ReleaseMode.stop);
      await player.setPlayerMode(PlayerMode.mediaPlayer);
      if (gen != _gen) {
        await _abandon(player);
        return;
      }
      await player.play(AssetSource(kEmergencyAlertAsset));
      if (gen != _gen) {
        await _abandon(player);
      }
    } catch (e) {
      debugPrint('[amber] asset/player failure: $e');
    }
  }

  static Future<void> stop() async {
    _gen++;
    await _stopPlayer();
    try {
      await _native.invokeMethod('stop');
    } catch (_) {}
  }

  static Future<void> _stopPlayer() async {
    _maxTimer?.cancel();
    _maxTimer = null;
    final player = _player;
    _player = null;
    if (player != null) {
      await _abandon(player);
    }
  }

  static Future<void> _abandon(AudioPlayer player) async {
    try {
      await player.stop();
    } catch (_) {}
    try {
      await player.release();
    } catch (_) {}
    try {
      await player.dispose();
    } catch (_) {}
  }
}
