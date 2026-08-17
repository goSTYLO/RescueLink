import 'package:flutter/material.dart';

/// Smoothly animates height when [expanded] toggles.
class AnimatedCollapse extends StatelessWidget {
  const AnimatedCollapse({
    super.key,
    required this.expanded,
    required this.child,
    this.duration = const Duration(milliseconds: 200),
    this.curve = Curves.easeInOut,
  });

  final bool expanded;
  final Widget child;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: duration,
      curve: curve,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.hardEdge,
      child: expanded
          ? child
          : const SizedBox(width: double.infinity),
    );
  }
}

/// Chevron that rotates when expanded (uses [Icons.expand_more]).
class AnimatedExpandIcon extends StatelessWidget {
  const AnimatedExpandIcon({
    super.key,
    required this.expanded,
    this.color,
    this.size = 24,
    this.duration = const Duration(milliseconds: 200),
  });

  final bool expanded;
  final Color? color;
  final double size;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return AnimatedRotation(
      turns: expanded ? 0.5 : 0,
      duration: duration,
      curve: Curves.easeInOut,
      child: Icon(
        Icons.expand_more,
        size: size,
        color: color ?? Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}
