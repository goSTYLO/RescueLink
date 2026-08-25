class IncidentModel {
  final int? reportId;
  final int? userId;
  final String? incidentType;
  final List<String> incidentTypes;
  final String? severityLevel;
  final String? status;
  final String? description;
  final double? latitude;
  final double? longitude;
  final String? barangay;
  final String? mediaUrl;
  final String? createdAt;
  final String? resolvedAt;
  final String? closedAt;
  final bool isArchived;
  final String? archivedAt;
  final int? archivedByUserId;
  final String? archiveNotes;

  const IncidentModel({
    this.reportId,
    this.userId,
    this.incidentType,
    this.incidentTypes = const [],
    this.severityLevel,
    this.status,
    this.description,
    this.latitude,
    this.longitude,
    this.barangay,
    this.mediaUrl,
    this.createdAt,
    this.resolvedAt,
    this.closedAt,
    this.isArchived = false,
    this.archivedAt,
    this.archivedByUserId,
    this.archiveNotes,
  });

  factory IncidentModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedTypes = [];
    if (json['incident_types'] is List) {
      parsedTypes = (json['incident_types'] as List)
          .map((e) => e?.toString() ?? '')
          .where((e) => e.isNotEmpty)
          .toList();
    }

    return IncidentModel(
      reportId: json['report_id'] is int ? json['report_id'] as int : int.tryParse(json['report_id']?.toString() ?? ''),
      userId: json['user_id'] is int ? json['user_id'] as int : int.tryParse(json['user_id']?.toString() ?? ''),
      incidentType: json['incident_type']?.toString(),
      incidentTypes: parsedTypes,
      severityLevel: json['severity_level']?.toString(),
      status: json['status']?.toString(),
      description: json['description']?.toString(),
      latitude: json['latitude'] is num ? (json['latitude'] as num).toDouble() : double.tryParse(json['latitude']?.toString() ?? ''),
      longitude: json['longitude'] is num ? (json['longitude'] as num).toDouble() : double.tryParse(json['longitude']?.toString() ?? ''),
      barangay: json['barangay']?.toString(),
      mediaUrl: json['media_url']?.toString(),
      createdAt: json['created_at']?.toString(),
      resolvedAt: json['resolved_at']?.toString(),
      closedAt: json['closed_at']?.toString(),
      isArchived: json['is_archived'] == true || json['is_archived'] == 1 || json['is_archived'] == 'true',
      archivedAt: json['archived_at']?.toString(),
      archivedByUserId: json['archived_by_user_id'] is int ? json['archived_by_user_id'] as int : int.tryParse(json['archived_by_user_id']?.toString() ?? ''),
      archiveNotes: json['archive_notes']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (reportId != null) 'report_id': reportId,
      if (userId != null) 'user_id': userId,
      if (incidentType != null) 'incident_type': incidentType,
      'incident_types': incidentTypes,
      if (severityLevel != null) 'severity_level': severityLevel,
      if (status != null) 'status': status,
      if (description != null) 'description': description,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (barangay != null) 'barangay': barangay,
      if (mediaUrl != null) 'media_url': mediaUrl,
      if (createdAt != null) 'created_at': createdAt,
      if (resolvedAt != null) 'resolved_at': resolvedAt,
      if (closedAt != null) 'closed_at': closedAt,
      'is_archived': isArchived,
      if (archivedAt != null) 'archived_at': archivedAt,
      if (archivedByUserId != null) 'archived_by_user_id': archivedByUserId,
      if (archiveNotes != null) 'archive_notes': archiveNotes,
    };
  }
}
