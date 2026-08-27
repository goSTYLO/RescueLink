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
    case 'accident':
      return 'Accident';
    default:
      return v[0].toUpperCase() + v.substring(1);
  }
}

List<String> incidentTypesFrom(Map<String, dynamic>? incident) {
  if (incident == null) return const [];

  final raw = incident['incident_types'];
  if (raw is List && raw.isNotEmpty) {
    return raw
        .map((item) => item?.toString().trim() ?? '')
        .where((value) => value.isNotEmpty)
        .toList();
  }

  final primary = incident['incident_type']?.toString().trim();
  final secondary = incident['secondary_classification']?.toString().trim();
  return [
    if (primary != null && primary.isNotEmpty) primary,
    if (secondary != null && secondary.isNotEmpty) secondary,
  ];
}

String incidentTypesLabel(
  Map<String, dynamic>? incident, {
  String fallback = 'Emergency',
}) {
  final types = incidentTypesFrom(incident);
  if (types.isEmpty) return fallback;
  return types.map(incidentTypeLabel).join(' · ');
}

String? primaryIncidentType(Map<String, dynamic>? incident) {
  final types = incidentTypesFrom(incident);
  if (types.isNotEmpty) return types.first;
  final fallback = incident?['incident_type']?.toString().trim();
  return (fallback != null && fallback.isNotEmpty) ? fallback : null;
}

Color incidentTypeColor(String? value) {
  final t = (value ?? '').trim().toLowerCase();
  if (t.isEmpty) return const Color(0xFFEF4444);
  if (t == 'sos') return const Color(0xFFEF4444);
  if (t.contains('fire')) return const Color(0xFFEA580C);
  if (t.contains('medical') || t.contains('health') || t.contains('accident')) {
    return const Color(0xFFEC4899);
  }
  if (t.contains('police') || t.contains('crime')) return const Color(0xFF2563EB);
  if (t.contains('disaster') || t.contains('flood')) return const Color(0xFF0EA5E9);
  return const Color(0xFF64748B);
}

List<String> aiClassificationTypesFrom(
  Map<String, dynamic>? incident, [
  Map<String, dynamic>? aiClassification,
]) {
  final fromIncident = incidentTypesFrom(incident);
  if (fromIncident.isNotEmpty) return fromIncident;

  if (aiClassification != null) {
    final raw = aiClassification['incident_types'];
    if (raw is List && raw.isNotEmpty) {
      return raw
          .map((item) => item?.toString().trim() ?? '')
          .where((value) => value.isNotEmpty)
          .toList();
    }
    final primary = aiClassification['predicted_type']?.toString().trim();
    final secondary = aiClassification['secondary_predicted_type']?.toString().trim();
    return [
      if (primary != null && primary.isNotEmpty) primary,
      if (secondary != null && secondary.isNotEmpty) secondary,
    ];
  }

  return const [];
}

Widget _incidentTypeChip({
  required String type,
  required bool isPrimary,
  required Color accentColor,
  bool compact = false,
}) {
  return Container(
    padding: EdgeInsets.symmetric(
      horizontal: compact ? 7 : 10,
      vertical: compact ? 3 : 6,
    ),
    decoration: BoxDecoration(
      color: isPrimary
          ? accentColor.withValues(alpha: 0.14)
          : accentColor.withValues(alpha: 0.05),
      borderRadius: BorderRadius.circular(compact ? 14 : 20),
      border: Border.all(
        color: isPrimary
            ? accentColor.withValues(alpha: 0.45)
            : accentColor.withValues(alpha: 0.28),
        width: isPrimary ? 1.2 : 1,
      ),
    ),
    child: Text(
      incidentTypeLabel(type),
      style: TextStyle(
        fontSize: compact ? 11 : 13,
        fontWeight: isPrimary ? FontWeight.w700 : FontWeight.w600,
        color: isPrimary ? accentColor : accentColor.withValues(alpha: 0.85),
      ),
    ),
  );
}

List<Widget> incidentTypeChipWidgets({
  required Map<String, dynamic>? incident,
  Map<String, dynamic>? aiClassification,
  int maxVisible = 3,
  bool compact = true,
}) {
  final types = aiClassificationTypesFrom(incident, aiClassification);
  if (types.isEmpty) {
    final fallback = incident?['incident_type']?.toString();
    if (fallback == null || fallback.isEmpty) {
      return [
        Text(
          'Emergency',
          style: TextStyle(
            fontSize: compact ? 13 : 16,
            fontWeight: FontWeight.w600,
            color: incidentTypeColor(null),
          ),
        ),
      ];
    }
    return [
      _incidentTypeChip(
        type: fallback,
        isPrimary: true,
        accentColor: incidentTypeColor(fallback),
        compact: compact,
      ),
    ];
  }

  final visible = types.take(maxVisible).toList();
  final overflow = types.length - visible.length;

  return [
    for (var i = 0; i < visible.length; i++) ...[
      if (i > 0) SizedBox(width: compact ? 4 : 6),
      _incidentTypeChip(
        type: visible[i],
        isPrimary: i == 0,
        accentColor: incidentTypeColor(visible[i]),
        compact: compact,
      ),
    ],
    if (overflow > 0) ...[
      SizedBox(width: compact ? 4 : 6),
      Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 6 : 8,
          vertical: compact ? 3 : 5,
        ),
        decoration: BoxDecoration(
          color: const Color(0xFF64748B).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(compact ? 14 : 20),
          border: Border.all(color: const Color(0xFF64748B).withValues(alpha: 0.25)),
        ),
        child: Text(
          '+$overflow',
          style: TextStyle(
            fontSize: compact ? 10 : 12,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF64748B),
          ),
        ),
      ),
    ],
  ];
}

Widget incidentTypeChips({
  required Map<String, dynamic>? incident,
  Map<String, dynamic>? aiClassification,
  Color? primaryColor,
}) {
  final types = aiClassificationTypesFrom(incident, aiClassification);
  final accent = primaryColor ??
      incidentTypeColor(
        primaryIncidentType(incident) ?? (types.isNotEmpty ? types.first : null),
      );

  if (types.isEmpty) {
    return Text(
      incidentTypeLabel(incident?['incident_type'] as String?),
      style: TextStyle(fontWeight: FontWeight.w600, color: accent),
    );
  }

  return Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (var i = 0; i < types.length; i++)
        _incidentTypeChip(
          type: types[i],
          isPrimary: i == 0,
          accentColor: i == 0 ? accent : incidentTypeColor(types[i]),
        ),
    ],
  );
}

Widget compactIncidentTypeChips({
  required Map<String, dynamic>? incident,
  Map<String, dynamic>? aiClassification,
  int maxVisible = 2,
}) {
  final chips = incidentTypeChipWidgets(
    incident: incident,
    aiClassification: aiClassification,
    maxVisible: maxVisible,
    compact: true,
  );

  return SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    clipBehavior: Clip.none,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: chips,
    ),
  );
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

class DepartmentTeamEntry {
  final String departmentName;
  final String? teamName;
  final bool isLead;
  final String? status;

  const DepartmentTeamEntry({
    required this.departmentName,
    this.teamName,
    this.isLead = false,
    this.status,
  });
}

List<DepartmentTeamEntry> assignedDepartmentTeamEntries(Map<String, dynamic>? incident) {
  if (incident == null) return const [];
  final List<DepartmentTeamEntry> entries = [];
  final seenDepts = <String>{};

  final dispatches = incident['dispatches'];
  if (dispatches is List && dispatches.isNotEmpty) {
    for (var i = 0; i < dispatches.length; i++) {
      final d = dispatches[i];
      if (d is Map) {
        final deptName = (d['department_name'] ?? d['department_code'] ?? '').toString().trim();
        if (deptName.isEmpty) continue;
        final teamName = d['team_name']?.toString().trim();
        final status = d['response_status']?.toString().trim();
        entries.add(DepartmentTeamEntry(
          departmentName: deptName,
          teamName: (teamName != null && teamName.isNotEmpty) ? teamName : null,
          isLead: i == 0,
          status: status,
        ));
        seenDepts.add(deptName.toLowerCase());
      }
    }
  }

  final assignedList = incident['assigned_departments'] ?? incident['assignedDepartments'];
  if (assignedList is List) {
    for (var i = 0; i < assignedList.length; i++) {
      final deptName = assignedList[i]?.toString().trim() ?? '';
      if (deptName.isNotEmpty && !seenDepts.contains(deptName.toLowerCase())) {
        entries.add(DepartmentTeamEntry(
          departmentName: deptName,
          teamName: (i == 0) ? incident['assigned_team_name']?.toString().trim() : null,
          isLead: i == 0,
        ));
        seenDepts.add(deptName.toLowerCase());
      }
    }
  }

  if (entries.isEmpty) {
    final singleDept = assignedDepartmentDisplayName(incident);
    if (singleDept != 'Not assigned') {
      final team = incident['assigned_team_name']?.toString().trim();
      entries.add(DepartmentTeamEntry(
        departmentName: singleDept,
        teamName: (team != null && team.isNotEmpty) ? team : null,
        isLead: true,
      ));
    }
  }

  return entries;
}

/// Display name for assigned department: uses API assigned_department when present,
/// otherwise handles multiple assigned_departments list, or fallback.
String assignedDepartmentDisplayName(Map<String, dynamic>? incident) {
  if (incident == null) return 'Not assigned';

  final assignedList = incident['assigned_departments'] ?? incident['assignedDepartments'];
  if (assignedList is List && assignedList.isNotEmpty) {
    final names = assignedList
        .map((e) => e?.toString().trim())
        .where((e) => e != null && e.isNotEmpty)
        .toList();
    if (names.isNotEmpty) return names.join(' · ');
  }

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

/// Backup request status helpers shared by citizen and volunteer incident detail screens.
class BackupStatusUi {
  static bool hasPendingBackup(Map<String, dynamic>? incident) {
    if (incident == null) return false;
    if (incident['has_pending_backup'] == true) return true;
    final status = (incident['latest_backup_status'] as String?)?.trim().toLowerCase();
    return status == 'pending';
  }

  static bool isBackupAcknowledged(Map<String, dynamic>? incident) {
    if (incident == null || hasPendingBackup(incident)) return false;
    final status = (incident['latest_backup_status'] as String?)?.trim().toLowerCase();
    return status == 'acknowledged';
  }

  static bool hasBackupContext(Map<String, dynamic>? incident) {
    if (incident == null) return false;
    if (hasPendingBackup(incident) || isBackupAcknowledged(incident)) return true;
    final status = (incident['latest_backup_status'] as String?)?.trim();
    return status != null && status.isNotEmpty;
  }

  static String? assignedBackupTeamLabel(Map<String, dynamic>? incident) {
    if (incident == null || !hasBackupContext(incident)) return null;
    final team = (incident['assigned_team_name'] as String?)?.trim();
    if (team == null || team.isEmpty) return null;
    final dept = assignedDepartmentDisplayName(incident);
    if (dept != 'Not assigned' && dept.isNotEmpty) {
      return '$team ($dept)';
    }
    return team;
  }

  static bool hasBackupUnitDispatched(Map<String, dynamic>? incident) {
    return assignedBackupTeamLabel(incident) != null;
  }

  static List<Map<String, dynamic>> joinedBackupVolunteers(Map<String, dynamic>? incident) {
    final raw = incident?['backup_volunteers'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((entry) => entry.cast<String, dynamic>())
        .where((entry) => (entry['status'] as String?) != 'declined')
        .toList();
  }

  static bool hasJoinedBackupVolunteers(Map<String, dynamic>? incident) {
    return joinedBackupVolunteers(incident).isNotEmpty;
  }
}
