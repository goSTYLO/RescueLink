import 'package:flutter/material.dart';

import '../screens/responder/responder_incident_detail_screen.dart';
import '../services/auth_service.dart';
import '../services/incident_service.dart';
import '../services/responder_service.dart';
import 'report_ui.dart';

/// Derive how the current user relates to an incident.
String? computeInvolvement(Map<String, dynamic> incident, int? userId) {
  final fromApi = incident['involvement']?.toString();
  if (fromApi != null && fromApi.isNotEmpty) {
    return fromApi;
  }
  if (userId == null) return null;

  final reporterId = parseInt(incident['user_id']);
  final acceptorId = parseInt(incident['accepted_by_user_id']);
  final isReporter = reporterId == userId;
  final isAcceptor = acceptorId == userId;

  if (isReporter && isAcceptor) return 'both';
  if (isReporter) return 'reported';
  if (isAcceptor) return 'accepted';
  return null;
}

/// Whether tapping a history row should open the responder detail screen.
bool shouldOpenResponderDetail({
  required String? involvement,
  String involvementFilter = 'all',
}) {
  if (involvement == 'accepted' || involvement == 'assigned') return true;
  if (involvement == 'both' && (involvementFilter == 'accepted' || involvementFilter == 'assigned')) return true;
  return false;
}

/// Opens citizen or responder incident details based on involvement, not account role.
Future<void> openIncidentByInvolvement(
  BuildContext context, {
  required Map<String, dynamic> incident,
  String involvementFilter = 'all',
  required void Function(int reportId) onCitizenTap,
}) async {
  final reportId = parseInt(incident['report_id']);
  if (reportId == null || reportId <= 0) return;

  final userId = AuthService().getUserId();
  final involvement = computeInvolvement(incident, userId);

  if (shouldOpenResponderDetail(
    involvement: involvement,
    involvementFilter: involvementFilter,
  )) {
    final readOnly =
        incident['responder_status']?.toString() == 'Resolved';
    if (!context.mounted) return;
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => ResponderIncidentDetailScreen(
          reportId: reportId,
          readOnly: readOnly,
          isTeamAssignment: involvement == 'assigned' || involvementFilter == 'assigned',
          initialIncident: incident,
        ),
      ),
    );
    return;
  }

  onCitizenTap(reportId);
}

/// Loads an incident when only [reportId] is known, then routes by involvement.
Future<void> openIncidentByReportId(
  BuildContext context, {
  required int reportId,
  Map<String, dynamic>? incidentHint,
  String involvementFilter = 'all',
  required void Function(int reportId) onCitizenTap,
}) async {
  if (AuthService().isPersonnelResponder) {
    try {
      final assigned = await ResponderService().getAssignedIncidents();
      final match = assigned
          .where((row) => parseInt(row['report_id']) == reportId)
          .toList();
      if (match.isNotEmpty) {
        if (!context.mounted) return;
        await Navigator.of(context, rootNavigator: true).push(
          MaterialPageRoute<void>(
            builder: (_) => ResponderIncidentDetailScreen(
              reportId: reportId,
              isTeamAssignment: true,
              initialIncident: match.first,
            ),
          ),
        );
        return;
      }
    } catch (_) {}
  }

  Map<String, dynamic>? incident = incidentHint;
  if (incident == null || incident['user_id'] == null) {
    try {
      final data =
          await IncidentService().getIncidentWithAiFallback(reportId);
      final raw = data['incident'] ?? data;
      if (raw is Map<String, dynamic>) {
        incident = raw;
      } else if (raw is Map) {
        incident = raw.cast<String, dynamic>();
      }
    } catch (_) {
      onCitizenTap(reportId);
      return;
    }
  }

  if (incident == null) {
    onCitizenTap(reportId);
    return;
  }

  if (!context.mounted) return;
  await openIncidentByInvolvement(
    context,
    incident: incident,
    involvementFilter: involvementFilter,
    onCitizenTap: onCitizenTap,
  );
}
