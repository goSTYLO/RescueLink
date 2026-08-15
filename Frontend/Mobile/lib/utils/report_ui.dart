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
    if (value == 'in-progress') return 'in_progress';
    if (value.isEmpty) return 'pending';
    return value;
  }

  static String label(String? status) {
    switch (normalize(status)) {
      case 'closed':
        return 'Closed';
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
  static bool isClosed(String? status) => normalize(status) == 'closed';
  static bool isResolvedOrClosed(String? status) => isResolved(status) || isClosed(status);

  static Color badgeBackground(String? status) {
    switch (normalize(status)) {
      case 'closed':
        return const Color(0xFFD1FAE5);
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
      case 'closed':
        return const Color(0xFF34D399);
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
      case 'closed':
        return const Color(0xFF065F46);
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
      case 'closed':
        return Icons.task_alt;
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
    String? closedAt,
    int? estimatedEtaMinutes,
    String? estimatedArrivalAt,
    String? responderStatus,
    String? acceptedAt,
    String? acceptedByName,
  }) {
    final normalized = normalize(status);
    final isVerified = normalized == 'verified' || normalized == 'in_progress' || normalized == 'resolved' || normalized == 'closed';
    final isInProgress = normalized == 'in_progress' || normalized == 'resolved' || normalized == 'closed';
    final isResolvedStatus = normalized == 'resolved' || normalized == 'closed';
    final isClosedStatus = normalized == 'closed';

    final volunteerAccepted = responderStatus != null && responderStatus.isNotEmpty;
    final volunteerEnRoute = volunteerAccepted &&
        (responderStatus == 'En Route' || responderStatus == 'On Scene' || responderStatus == 'Resolved');
    final volunteerOnScene = volunteerAccepted &&
        (responderStatus == 'On Scene' || responderStatus == 'Resolved');
    final volunteerResolved = volunteerAccepted && responderStatus == 'Resolved';

    String dispatchSubtitle() {
      if (volunteerAccepted) {
        final name = acceptedByName?.trim();
        final when = acceptedAt != null ? ' at ${formatReportDateTime(acceptedAt)}' : '';
        return name != null && name.isNotEmpty
            ? '$name accepted your report$when'
            : 'A volunteer responder accepted your report$when';
      }
      if (isVerified) {
        if (estimatedEtaMinutes != null) {
          final etaExtra = estimatedArrivalAt != null && estimatedArrivalAt.isNotEmpty
              ? ' (around ${formatReportDateTime(estimatedArrivalAt)})'
              : '';
          return 'ETA $estimatedEtaMinutes min$etaExtra';
        }
        return 'Assignment estimated from status';
      }
      return 'Awaiting assignment';
    }

    String enRouteSubtitle() {
      if (volunteerOnScene) return 'Responder is on scene';
      if (volunteerEnRoute) return 'Responder is en route to your location';
      if (volunteerAccepted) return 'Responder preparing to depart';
      if (isResolvedStatus) return 'Completed';
      if (isInProgress) {
        return estimatedEtaMinutes != null
            ? 'Responders are en route (~$estimatedEtaMinutes min ETA)'
            : 'Responders are handling this incident';
      }
      return 'Pending';
    }

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
        title: volunteerAccepted ? 'Responder Assigned' : 'Dispatch',
        subtitle: dispatchSubtitle(),
        isCompleted: volunteerAccepted || isVerified,
        isInProgress: !volunteerAccepted && !isVerified && hasAiClassification,
      ),
      ReportTimelineStep(
        icon: Icons.location_on,
        iconColor: const Color(0xFFF59E0B),
        title: 'En Route',
        subtitle: enRouteSubtitle(),
        isCompleted: volunteerOnScene || isResolvedStatus,
        isInProgress: volunteerEnRoute && !volunteerOnScene,
      ),
      ReportTimelineStep(
        icon: Icons.check_circle_outline,
        iconColor: const Color(0xFF6B7280),
        title: 'Resolved',
        subtitle: volunteerResolved
            ? 'Responder marked incident resolved'
            : (isResolvedStatus
                ? (updatedAt != null
                    ? 'Resolved at ${formatReportDateTime(updatedAt)}'
                    : 'Resolved')
                : 'Pending'),
        isCompleted: volunteerResolved || isResolvedStatus,
      ),
      ReportTimelineStep(
        icon: Icons.task_alt,
        iconColor: const Color(0xFF065F46),
        title: 'Closed',
        subtitle: isClosedStatus
            ? (closedAt != null
                ? 'Closed at ${formatReportDateTime(closedAt)}'
                : 'Closed after reporter confirmation')
            : 'Waiting for reporter confirmation',
        isCompleted: isClosedStatus,
      ),
    ];
  }
}

String formatIncidentCode(int? reportId) {
  if (reportId == null) return 'DGP-UNKNOWN';
  return 'DGP-$reportId';
}

/// Formats time in 12-hour format (e.g. 2:30 PM).
String _formatTime12h(DateTime dt) {
  final hour = dt.hour;
  final minute = dt.minute;
  final period = hour >= 12 ? 'PM' : 'AM';
  final hour12 = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return '$hour12:${minute.toString().padLeft(2, '0')} $period';
}

String formatReportDateTime(String? dateStr) {
  if (dateStr == null || dateStr.isEmpty) return '—';
  try {
    final dt = DateTime.parse(dateStr).toLocal();
    return '${_month(dt.month)} ${dt.day}, ${dt.year} • ${_formatTime12h(dt)}';
  } catch (_) {
    return dateStr;
  }
}

/// Shared location label for report cards and location summary rows.
String incidentLocationLabel(Map<String, dynamic>? incident) {
  if (incident == null) return 'Incident location data is unavailable.';
  final barangay = safeString(incident['barangay']);
  final latitude = parseDouble(incident['latitude']);
  final longitude = parseDouble(incident['longitude']);
  if (barangay != null) return '$barangay, Dagupan City';
  if (latitude != null && longitude != null) {
    return '${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)}';
  }
  return 'Incident location data is unavailable.';
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

/// Display name for assigned department: uses API assigned_department when present,
/// otherwise type-based fallback or "Not assigned".
String? volunteerResponderStatusLabel(String? status) {
  switch ((status ?? '').trim()) {
    case 'Assigned':
      return 'Volunteer accepted — preparing to respond';
    case 'En Route':
      return 'Volunteer is on the way';
    case 'On Scene':
      return 'Volunteer is on scene';
    case 'Resolved':
      return 'Volunteer marked incident resolved';
    default:
      return null;
  }
}

String assignedDepartmentDisplayName(Map<String, dynamic>? incident) {
  if (incident == null) return 'Not assigned';
  // Prefer snake_case from API; support camelCase from some clients
  final assigned = incident['assigned_department'] ?? incident['assignedDepartment'];
  if (assigned != null) {
    final s = assigned.toString().trim();
    if (s.isNotEmpty) return s;
  }
  final type = incident['incident_type'] as String?;
  if (type != null && type.toString().trim().isNotEmpty) {
    return departmentFromIncidentType(type);
  }
  return 'Not assigned';
}

String? safeString(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

double? parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value.trim());
  return null;
}

int? parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value.trim());
  return null;
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
