import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;

/// Floating action button with subtle pulse animation.
/// UDPS: Minimum 48x48 dp touch target, haptic feedback on tap.
class AnimatedFab extends StatefulWidget {
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;
  final String? tooltip;
  final String? hintLabel;
  final VoidCallback? onPressed;
  final VoidCallback? onLongPress;

  const AnimatedFab({
    super.key,
    required this.icon,
    this.backgroundColor = const Color(0xFFEF4444),
    this.iconColor = Colors.white,
    this.tooltip,
    this.hintLabel,
    this.onPressed,
    this.onLongPress,
  });

  @override
  State<AnimatedFab> createState() => _AnimatedFabState();
}

class _AnimatedFabState extends State<AnimatedFab>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.2, end: 0.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    HapticFeedback.mediumImpact();
    widget.onPressed?.call();
  }

  void _handleLongPress() {
    HapticFeedback.heavyImpact();
    widget.onLongPress?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            final opacity = 0.25 + _pulseAnimation.value;
            return Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: widget.backgroundColor.withOpacity(opacity),
                    blurRadius: 20,
                    spreadRadius: 2 + (_pulseAnimation.value * 2),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: widget.onPressed != null ? _handleTap : null,
                  onLongPress:
                      widget.onLongPress != null ? _handleLongPress : null,
                  customBorder: const CircleBorder(),
                  child: Container(
                    width: 96,
                    height: 96,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.backgroundColor,
                      border: Border.all(
                        color: Colors.white.withOpacity(0.3),
                        width: 2,
                      ),
                    ),
                    child: Icon(
                      widget.icon,
                      color: widget.iconColor,
                      size: 48,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
        if (widget.hintLabel != null) ...[
          const SizedBox(height: 8),
          Text(
            widget.hintLabel!,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
