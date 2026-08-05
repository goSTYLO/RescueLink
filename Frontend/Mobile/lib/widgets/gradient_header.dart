import 'package:flutter/material.dart';

/// Dark header matching the updated Home screen design.
class GradientHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onBack;
  final bool transparentFade;

  const GradientHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onBack,
    this.transparentFade = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final headerBg = isDark ? const Color(0xFF111827) : const Color(0xFF0F172A);
    final borderBottom = isDark ? const Color(0xFF1F2937) : const Color(0xFF334155);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: headerBg,
        border: Border(bottom: BorderSide(color: borderBottom, width: 1)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              if (leading != null)
                leading!
              else if (onBack != null)
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    onPressed: onBack,
                    icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                    padding: EdgeInsets.zero,
                  ),
                )
              else
                const SizedBox(width: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          color: Color(0xFF9CA3AF),
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null)
                trailing!
              else
                const SizedBox(width: 38),
            ],
          ),
        ),
      ),
    );
  }
}
