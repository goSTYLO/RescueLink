import 'package:flutter/material.dart';
import 'glass_card.dart';

/// Premium card with optional glass effect and press animation.
/// UDPS: Micro-interactions for Normal, Active (Pressed) states.
class PremiumCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final bool useGlass;
  final VoidCallback? onTap;

  const PremiumCard({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius = 16,
    this.useGlass = true,
    this.onTap,
  });

  @override
  State<PremiumCard> createState() => _PremiumCardState();
}

class _PremiumCardState extends State<PremiumCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.98).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final innerContent = widget.useGlass
        ? GlassCard(
            padding: widget.padding,
            borderRadius: widget.borderRadius,
            blurSigma: 12,
            onTap: null,
            child: widget.child,
          )
        : _buildSolidCard();

    if (widget.onTap != null) {
      return GestureDetector(
        onTapDown: (_) => _controller.forward(),
        onTapUp: (_) => _controller.reverse(),
        onTapCancel: () => _controller.reverse(),
        onTap: widget.onTap,
        child: AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) {
            return Transform.scale(
              scale: _scaleAnimation.value,
              child: child,
            );
          },
          child: innerContent,
        ),
      );
    }

    return innerContent;
  }

  Widget _buildSolidCard() {
    final theme = Theme.of(context);
    return Container(
      padding: widget.padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(widget.borderRadius),
        border: Border.all(
          color: theme.colorScheme.outline.withOpacity(0.2),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: widget.child,
    );
  }
}
