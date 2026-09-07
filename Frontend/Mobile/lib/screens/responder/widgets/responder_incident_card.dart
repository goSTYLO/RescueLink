import 'package:flutter/material.dart';
import '../../../utils/report_ui.dart';
import '../../../widgets/glass_card.dart';

/// List / map-bottom card for an unaccepted nearby incident (responder dashboard).
class ResponderIncidentCard extends StatelessWidget {
  final Map<String, dynamic> incident;
  final VoidCallback? onTap;
  final bool compact;
  final String? badgeText;

  const ResponderIncidentCard({
    super.key,
    required this.incident,
    this.onTap,
    this.compact = false,
    this.badgeText,
  });

  static IconData iconForType(String? type) {
    if (type == null) return Icons.emergency;
    final t = type.toLowerCase();
    if (t == 'sos') return Icons.emergency;
    if (t.contains('fire')) return Icons.local_fire_department;
    if (t.contains('medical') || t.contains('health') || t.contains('accident')) {
      return Icons.monitor_heart_outlined;
    }
    if (t.contains('police') || t.contains('crime')) return Icons.shield_outlined;
    if (t.contains('disaster') || t.contains('flood')) return Icons.water_drop_outlined;
    return Icons.warning_amber_rounded;
  }

  static Color severityColor(String? severity) {
    switch ((severity ?? '').toLowerCase()) {
      case 'critical':
        return const Color(0xFFEF4444);
      case 'high':
        return const Color(0xFFF97316);
      case 'medium':
        return const Color(0xFFF59E0B);
      case 'low':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  static String severityLabel(String? severity) {
    final s = (severity ?? 'medium').trim();
    if (s.isEmpty) return 'Medium';
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
  }

  static String _formatTime12h(DateTime dt) {
    final hour = dt.hour;
    final minute = dt.minute;
    final period = hour >= 12 ? 'PM' : 'AM';
    final hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return '$hour12:${minute.toString().padLeft(2, '0')} $period';
  }

  static String incidentTimeLabel(String? createdAt) {
    if (createdAt == null || createdAt.isEmpty) return '';
    try {
      final dt = DateTime.parse(createdAt).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final date = DateTime(dt.year, dt.month, dt.day);
      final timeStr = _formatTime12h(dt);
      if (date == today) return '$timeStr • Today';
      if (date == today.subtract(const Duration(days: 1))) {
        return '$timeStr • Yesterday';
      }
      return formatReportDateTime(createdAt);
    } catch (_) {
      return '';
    }
  }

  static String? distanceKmLabel(Map<String, dynamic> incident) {
    final km = parseDouble(incident['distance_km']);
    if (km == null) return null;
    return '${km.toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSec = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final type = primaryIncidentType(incident) ?? incident['incident_type'] as String?;
    final typeColor = incidentTypeColor(type);
    final title = incidentTypeLabel(type);
    final barangay = (incident['barangay'] as String?)?.trim();
    final location = barangay != null && barangay.isNotEmpty
        ? '$barangay, Dagupan City'
        : 'Dagupan City';
    final timeLabel = incidentTimeLabel(incident['created_at'] as String?);
    final distance = distanceKmLabel(incident);
    final severity = incident['severity_level'] as String?;
    final sevColor = severityColor(severity);
    final sevLabel = severityLabel(severity);

    final iconSize = compact ? 44.0 : 52.0;

    return GlassCard(
      onTap: onTap,
      padding: EdgeInsets.all(compact ? 12 : 14),
      child: Row(
        children: [
          Container(
            width: iconSize,
            height: iconSize,
            decoration: BoxDecoration(
              color: typeColor.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(iconForType(type), color: typeColor, size: compact ? 24 : 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: compact ? 14 : 15,
                    fontWeight: FontWeight.w600,
                    color: textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 13, color: textSec),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        location,
                        style: TextStyle(fontSize: 12, color: textSec),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (timeLabel.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(timeLabel, style: TextStyle(fontSize: 11, color: textSec)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (distance != null)
                Text(
                  distance,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: textPrimary,
                  ),
                ),
              const SizedBox(height: 6),
              if (badgeText != null && badgeText!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF134178).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    badgeText!,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF134178),
                    ),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: sevColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    sevLabel,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: sevColor,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right, color: textSec, size: 20),
        ],
      ),
    );
  }
}
