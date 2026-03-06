import 'package:flutter/material.dart';

class ReportTimelineStep {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool isCompleted;
  final bool isInProgress;

  const ReportTimelineStep({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.isCompleted,
    this.isInProgress = false,
  });
}

class ReportStatusUi {
  static String normalize(String? status) {
    final value = (status ?? '').trim().toLowerCase();
    if (value == 'closed') return 'resolved';
    if (value == 'in-progress') return 'in_progress';
    if (value.isEmpty) return 'pending';
    return value;
  }

  static String label(String? status) {
    switch (normalize(status)) {
      case 'resolved':
        return 'Resolved';
      case 'verified':
        return 'Verified';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
      default:
        return 'Pending';
    }
  }

  static bool isResolved(String? status) => normalize(status) == 'resolved';

  static Color badgeBackground(String? status) {
    switch (normalize(status)) {
      case 'resolved':
        return const Color(0xFFDCFCE7);
      case 'verified':
        return const Color(0xFFF3E8FF);
      case 'in_progress':
        return const Color(0xFFFEF3C7);
      case 'pending':
      default:
        return const Color(0xFFDBEAFE);
    }
  }

  static Color badgeBorder(String? status) {
    switch (normalize(status)) {
      case 'resolved':
        return const Color(0xFF86EFAC);
      case 'verified':
        return const Color(0xFFD8B4FE);
      case 'in_progress':
        return const Color(0xFFFCD34D);
      case 'pending':
      default:
        return const Color(0xFF93C5FD);
    }
  }

  static Color badgeText(String? status) {
    switch (normalize(status)) {
      case 'resolved':
        return const Color(0xFF15803D);
      case 'verified':
        return const Color(0xFF7E22CE);
      case 'in_progress':
        return const Color(0xFFB45309);
      case 'pending':
      default:
        return const Color(0xFF1D4ED8);
    }
  }

  static IconData badgeIcon(String? status) {
    switch (normalize(status)) {
      case 'resolved':
        return Icons.check_circle;
      case 'verified':
        return Icons.verified;
      case 'in_progress':
        return Icons.local_shipping;
      case 'pending':
      default:
        return Icons.schedule;
    }
  }

  static List<ReportTimelineStep> timeline({
    required String? status,
    required bool hasAiClassification,
    String? createdAt,
    String? updatedAt,
  }) {
    final normalized = normalize(status);
    final isVerified = normalized == 'verified' || normalized == 'in_progress' || normalized == 'resolved';
    final isInProgress = normalized == 'in_progress' || normalized == 'resolved';
    final isResolvedStatus = normalized == 'resolved';

    return [
      ReportTimelineStep(
        icon: Icons.check,
        iconColor: const Color(0xFF22C55E),
        title: 'Submitted',
        subtitle: createdAt != null
            ? 'Submitted at ${formatReportDateTime(createdAt)}'
            : 'Submitted',
        isCompleted: true,
      ),
      ReportTimelineStep(
        icon: Icons.shield,
        iconColor: const Color(0xFF2563EB),
        title: 'AI Verified',
        subtitle: hasAiClassification
            ? 'Classification complete'
            : 'Pending classification',
        isCompleted: hasAiClassification || isVerified,
        isInProgress: !hasAiClassification && !isVerified,
      ),
      ReportTimelineStep(
        icon: Icons.local_shipping_outlined,
        iconColor: const Color(0xFFF97316),
        title: 'Dispatch',
        subtitle: isVerified
            ? 'Assignment estimated from status'
            : 'Awaiting assignment',
        isCompleted: isVerified,
      ),
      ReportTimelineStep(
        icon: Icons.location_on,
        iconColor: const Color(0xFFF59E0B),
        title: 'En Route',
        subtitle: isResolvedStatus
            ? 'Completed'
            : (isInProgress ? 'Responders are handling this incident' : 'Pending'),
        isCompleted: isResolvedStatus,
        isInProgress: isInProgress && !isResolvedStatus,
      ),
      ReportTimelineStep(
        icon: Icons.check_circle_outline,
        iconColor: const Color(0xFF6B7280),
        title: 'Resolved',
        subtitle: isResolvedStatus
            ? (updatedAt != null
                ? 'Resolved at ${formatReportDateTime(updatedAt)}'
                : 'Resolved')
            : 'Pending',
        isCompleted: isResolvedStatus,
      ),
    ];
  }
}

String formatIncidentCode(int? reportId) {
  if (reportId == null) return 'DGP-UNKNOWN';
  return 'DGP-$reportId';
}

String formatReportDateTime(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return '—';
  try {
    final dt = DateTime.parse(dateStr).toLocal();
    return '${_month(dt.month)} ${dt.day}, ${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return dateStr;
  }
}

String incidentTypeLabel(String? value) {
  final v = (value ?? '').trim().toLowerCase();
  if (v.isEmpty) return 'Emergency';
  switch (v) {
    case 'fire':
      return 'Fire';
    case 'medical':
      return 'Medical';
    case 'police':
      return 'Police';
    case 'disaster':
      return 'Disaster';
    default:
      return v[0].toUpperCase() + v.substring(1);
  }
}

String severityLabel(String? value) {
  final v = (value ?? '').trim().toLowerCase();
  if (v.isEmpty) return 'Unknown';
  return v[0].toUpperCase() + v.substring(1);
}

String departmentFromIncidentType(String? incidentType) {
  switch ((incidentType ?? '').trim().toLowerCase()) {
    case 'fire':
      return 'Dagupan Fire Department';
    case 'medical':
      return 'City Health Office';
    case 'police':
      return 'Dagupan City Police';
    case 'disaster':
      return 'Dagupan CDRRMO';
    default:
      return 'Emergency Response Team';
  }
}

String? safeString(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

String _month(int m) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[m - 1];
}
