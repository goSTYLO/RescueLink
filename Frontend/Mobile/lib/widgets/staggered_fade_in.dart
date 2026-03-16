import 'package:flutter/material.dart';

/// Wraps children and fades them in with a staggered delay between elements.
/// Uses 50ms stagger delay by default.
/// When [trigger] changes, the animation restarts (useful for tab switching).
class StaggeredFadeIn extends StatefulWidget {
  final List<Widget> children;
  final int staggerDelayMs;
  final Duration fadeDuration;
  /// When this value changes, the animation restarts. Use for tab visibility.
  final Object? trigger;

  const StaggeredFadeIn({
    super.key,
    required this.children,
    this.staggerDelayMs = 50,
    this.fadeDuration = const Duration(milliseconds: 250),
    this.trigger,
  });

  /// Single-child constructor for wrapping a full screen/tab content.
  factory StaggeredFadeIn.single({
    Key? key,
    required Widget child,
    int staggerDelayMs = 50,
    Duration fadeDuration = const Duration(milliseconds: 250),
    Object? trigger,
  }) {
    return StaggeredFadeIn(
      key: key,
      children: [child],
      staggerDelayMs: staggerDelayMs,
      fadeDuration: fadeDuration,
      trigger: trigger,
    );
  }

  @override
  State<StaggeredFadeIn> createState() => _StaggeredFadeInState();
}

class _StaggeredFadeInState extends State<StaggeredFadeIn>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<Animation<double>> _animations;

  void _setupAnimations() {
    final totalDurationMs = widget.fadeDuration.inMilliseconds +
        (widget.children.length * widget.staggerDelayMs);
    _animations = List.generate(
      widget.children.length,
      (i) {
        final staggerFraction =
            (i * widget.staggerDelayMs) / totalDurationMs;
        final fadeFraction =
            widget.fadeDuration.inMilliseconds / totalDurationMs;
        return Tween<double>(begin: 0, end: 1).animate(
          CurvedAnimation(
            parent: _controller,
            curve: Interval(
              staggerFraction,
              staggerFraction + fadeFraction,
              curve: Curves.easeOut,
            ),
          ),
        );
      },
    );
  }

  @override
  void initState() {
    super.initState();
    final totalDurationMs = widget.fadeDuration.inMilliseconds +
        (widget.children.length * widget.staggerDelayMs);
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: totalDurationMs),
    );
    _setupAnimations();
    _controller.forward();
  }

  @override
  void didUpdateWidget(StaggeredFadeIn oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger != oldWidget.trigger) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.children.length == 1) {
      return FadeTransition(
        opacity: _animations[0],
        child: widget.children[0],
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: List.generate(
        widget.children.length,
        (i) => FadeTransition(
          opacity: _animations[i],
          child: widget.children[i],
        ),
      ),
    );
  }
}
