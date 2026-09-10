import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Asset path for the amber foreground blare (must match pubspec + res/raw name).
const String kEmergencyAlertAsset = 'sounds/emergency_alert.wav';

/// Max amber blare / haptic duration (also matches tray sound length intent).
const Duration kEmergencyAlertMaxDuration = Duration(minutes: 1);

/// Blocking amber-style alert for department ops / team assignment.
class EmergencyDispatchAlertModal extends StatefulWidget {
  final String title;
  final String body;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  const EmergencyDispatchAlertModal({
    super.key,
    required this.title,
    required this.body,
    required this.onOpen,
    required this.onDismiss,
  });

  @override
  State<EmergencyDispatchAlertModal> createState() =>
      _EmergencyDispatchAlertModalState();
}

class _EmergencyDispatchAlertModalState
    extends State<EmergencyDispatchAlertModal> {
  Timer? _hapticTimer;
  Timer? _maxDurationTimer;
  final AudioPlayer _player = AudioPlayer();
  bool _ending = false;

  @override
  void initState() {
    super.initState();
    unawaited(HapticFeedback.heavyImpact());
    _hapticTimer = Timer.periodic(const Duration(milliseconds: 700), (_) {
      HapticFeedback.heavyImpact();
    });
    _maxDurationTimer = Timer(kEmergencyAlertMaxDuration, () {
      unawaited(_end(widget.onDismiss));
    });
    unawaited(_startBlare());
  }

  Future<void> _startBlare() async {
    try {
      // Continuous ~60s asset; hard-stop on Open/Dismiss or max-duration timer.
      await _player.setReleaseMode(ReleaseMode.stop);
      await _player.setPlayerMode(PlayerMode.mediaPlayer);
      await _player.play(AssetSource(kEmergencyAlertAsset));
    } catch (_) {
      // ponytail: asset/player failure → silent haptics-only; no tray fallback here
    }
  }

  Future<void> _stopMedia() async {
    _hapticTimer?.cancel();
    _hapticTimer = null;
    _maxDurationTimer?.cancel();
    _maxDurationTimer = null;
    try {
      await _player.stop();
    } catch (_) {}
  }

  Future<void> _end(VoidCallback action) async {
    if (_ending) return;
    _ending = true;
    await _stopMedia();
    if (!mounted) return;
    action();
  }

  @override
  void dispose() {
    _hapticTimer?.cancel();
    _maxDurationTimer?.cancel();
    unawaited(_player.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF7F1D1D),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.campaign_rounded, color: Colors.white, size: 48),
            const SizedBox(height: 12),
            Text(
              widget.title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              widget.body,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF7F1D1D),
                ),
                onPressed: () => unawaited(_end(widget.onOpen)),
                child: const Text('Open incident'),
              ),
            ),
            TextButton(
              onPressed: () => unawaited(_end(widget.onDismiss)),
              child: const Text(
                'Dismiss',
                style: TextStyle(color: Colors.white70),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
