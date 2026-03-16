import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Skeleton placeholder shapes for loading states.
/// Uses shimmer animation for perceived loading feedback.
class SkeletonPlaceholder extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;
  final BoxShape shape;

  const SkeletonPlaceholder({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
    this.shape = BoxShape.rectangle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.grey[800]! : Colors.grey[300]!;
    final highlightColor = isDark ? Colors.grey[700]! : Colors.grey[100]!;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: baseColor,
          borderRadius: shape == BoxShape.rectangle
              ? BorderRadius.circular(borderRadius)
              : null,
          shape: shape,
        ),
      ),
    );
  }
}

/// Pre-built skeleton for a list item card.
class SkeletonCard extends StatelessWidget {
  final double? width;
  final double height;
  final bool showIcon;

  const SkeletonCard({
    super.key,
    this.width,
    this.height = 80,
    this.showIcon = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.grey[800]! : Colors.grey[300]!;
    final highlightColor = isDark ? Colors.grey[700]! : Colors.grey[100]!;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: Container(
        width: width ?? double.infinity,
        height: height,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: baseColor.withOpacity(0.5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            if (showIcon) ...[
              const SkeletonPlaceholder(
                width: 48,
                height: 48,
                borderRadius: 10,
              ),
              const SizedBox(width: 14),
            ],
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SkeletonPlaceholder(
                    width: double.infinity,
                    height: 14,
                    borderRadius: 4,
                  ),
                  SizedBox(height: 8),
                  SkeletonPlaceholder(
                    width: 120,
                    height: 12,
                    borderRadius: 4,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pre-built skeleton for a full page loading state.
class SkeletonPage extends StatelessWidget {
  final int cardCount;
  final bool showHeader;

  const SkeletonPage({
    super.key,
    this.cardCount = 5,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHeader) ...[
            const SkeletonPlaceholder(
              width: 200,
              height: 24,
              borderRadius: 6,
            ),
            const SizedBox(height: 8),
            const SkeletonPlaceholder(
              width: 140,
              height: 16,
              borderRadius: 4,
            ),
            const SizedBox(height: 24),
          ],
          ...List.generate(
            cardCount,
            (i) => const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: SkeletonCard(height: 80),
            ),
          ),
        ],
      ),
    );
  }
}
