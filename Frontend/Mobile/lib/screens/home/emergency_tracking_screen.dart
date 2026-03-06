import 'package:flutter/material.dart';
import '../../services/incident_service.dart';
import '../../utils/report_ui.dart';

class EmergencyTrackingScreen extends StatefulWidget {
  final int? reportId;
  final Map<String, dynamic>? initialIncident;
  final VoidCallback? onBack;

  const EmergencyTrackingScreen({
    super.key,
    this.reportId,
    this.initialIncident,
    this.onBack,
  });

  @override
  State<EmergencyTrackingScreen> createState() =>
      _EmergencyTrackingScreenState();
}

class _EmergencyTrackingScreenState extends State<EmergencyTrackingScreen> {
  static const _gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEF4444), Color(0xFF7C3AED), Color(0xFF1E3A8A)],
  );

  Map<String, dynamic>? _incident;
  Map<String, dynamic>? _aiClassification;
  final IncidentService _incidentService = IncidentService();
  bool _loading = true;
  bool _confirmingResolution = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _incident = widget.initialIncident;
    _loadIncident();
  }

  Future<void> _loadIncident() async {
    final reportId =
        widget.reportId ?? (_incident?['report_id'] as num?)?.toInt();
    if (reportId == null) {
      setState(() {
        _loading = false;
        _loadError = 'No report id found for this tracking screen.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final data = await IncidentService().getIncidentWithAiFallback(reportId);
      if (!mounted) return;
      setState(() {
        _incident = (data['incident'] as Map?)?.cast<String, dynamic>();
        _aiClassification =
            (data['ai_classification'] as Map?)?.cast<String, dynamic>();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e is IncidentServiceException ? e.message : e.toString();
      });
    }
  }

  int? get _reportId =>
      (_incident?['report_id'] as num?)?.toInt() ?? widget.reportId;

  String get _status =>
      ReportStatusUi.normalize(_incident?['status'] as String?);

  bool get _reporterConfirmed =>
      (_incident?['reporter_confirmed_at'] as String?) != null;

  Future<void> _confirmResolution() async {
    final reportId = _reportId;
    if (reportId == null || _confirmingResolution) return;
    setState(() => _confirmingResolution = true);
    try {
      await _incidentService.confirmIncidentResolution(reportId);
      if (!mounted) return;
      await _loadIncident();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resolution confirmed. Thank you for your feedback.')),
      );
    } on IncidentServiceException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) {
        setState(() => _confirmingResolution = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _loadError != null
                      ? _buildError()
                      : RefreshIndicator(
                          onRefresh: _loadIncident,
                          child: ListView(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 16),
                            children: [
                              _buildStatusCard(),
                              const SizedBox(height: 16),
                              _buildReporterConfirmationCard(),
                              const SizedBox(height: 16),
                              _buildTimelineCard(),
                              const SizedBox(height: 16),
                              _buildIncidentSnapshotCard(),
                              const SizedBox(height: 16),
                              _buildDepartmentCard(),
                              const SizedBox(height: 16),
                              _buildLocationPlaceholderCard(),
                              const SizedBox(height: 16),
                              _buildDisabledActions(),
                              const SizedBox(height: 16),
                              _buildInfoFooter(),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: const BoxDecoration(
        gradient: _gradient,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: widget.onBack,
            icon: const CircleAvatar(
              backgroundColor: Colors.white,
              child: Icon(Icons.arrow_back, color: Color(0xFF111827), size: 22),
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Emergency Tracking',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formatIncidentCode(_reportId),
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                ),
              ],
            ),
          ),
          Image.asset(
            'assets/logo/logo2.png',
            width: 32,
            height: 32,
            fit: BoxFit.contain,
            color: Colors.white,
            colorBlendMode: BlendMode.srcIn,
            errorBuilder: (_, __, ___) =>
                const Icon(Icons.shield, color: Colors.white, size: 28),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _loadError ?? 'Unable to load tracking data.',
              style: const TextStyle(color: Color(0xFFDC2626)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loadIncident,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final statusLabel = ReportStatusUi.label(_status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: ReportStatusUi.badgeBackground(_status),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ReportStatusUi.badgeBorder(_status)),
      ),
      child: Column(
        children: [
          Icon(
            ReportStatusUi.badgeIcon(_status),
            color: ReportStatusUi.badgeText(_status),
            size: 44,
          ),
          const SizedBox(height: 12),
          Text(
            statusLabel,
            style: TextStyle(
              color: ReportStatusUi.badgeText(_status),
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            ReportStatusUi.isResolved(_status)
                ? 'Incident is resolved.'
                : 'Status is synced from the latest report record.',
            style: TextStyle(
              color: ReportStatusUi.badgeText(_status),
              fontSize: 13,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          const Text(
            'ETA and responder assignment are temporary estimates until user-safe dispatch endpoints are available.',
            style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineCard() {
    final timeline = ReportStatusUi.timeline(
      status: _incident?['status'] as String?,
      hasAiClassification: _aiClassification != null,
      createdAt: _incident?['created_at'] as String?,
      updatedAt: _incident?['updated_at'] as String?,
    );
    return _whiteCard(
      title: 'Status Timeline',
      child: Column(
        children: timeline
            .map(
              (step) => _timelineItem(
                icon: step.icon,
                iconBg: step.iconColor,
                title: step.title,
                subtitle: step.subtitle,
                isCompleted: step.isCompleted,
                isInProgress: step.isInProgress,
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _buildReporterConfirmationCard() {
    if (!ReportStatusUi.isResolved(_status)) {
      return const SizedBox.shrink();
    }
    return _whiteCard(
      title: 'Resolution Confirmation',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _reporterConfirmed
                ? 'You already confirmed this incident resolution.'
                : 'Please confirm once responders have fully handled your report.',
            style: const TextStyle(fontSize: 13, color: Color(0xFF374151)),
          ),
          const SizedBox(height: 12),
          if (_reporterConfirmed)
            const Row(
              children: [
                Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 20),
                SizedBox(width: 8),
                Text('Confirmed', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            )
          else
            FilledButton.icon(
              onPressed: _confirmingResolution ? null : _confirmResolution,
              icon: _confirmingResolution
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.thumb_up_alt_outlined),
              label: Text(_confirmingResolution ? 'Confirming...' : 'Confirm Resolution'),
            ),
        ],
      ),
    );
  }

  Widget _buildIncidentSnapshotCard() {
    final incidentType =
        incidentTypeLabel(_incident?['incident_type'] as String?);
    final severity = severityLabel(_incident?['severity_level'] as String?);
    final barangay = safeString(_incident?['barangay']) ?? 'Unknown barangay';
    final createdAt = formatReportDateTime(_incident?['created_at'] as String?);

    String locationText = 'Coordinates unavailable';
    final latitude = _incident?['latitude'] as num?;
    final longitude = _incident?['longitude'] as num?;
    if (latitude != null && longitude != null) {
      locationText =
          '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';
    }

    return _whiteCard(
      title: 'Incident Snapshot',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow('Type', incidentType),
          const SizedBox(height: 10),
          _infoRow('Severity', severity),
          const SizedBox(height: 10),
          _infoRow('Barangay', barangay),
          const SizedBox(height: 10),
          _infoRow('Created', createdAt),
          const SizedBox(height: 10),
          _infoRow('Location', locationText),
        ],
      ),
    );
  }

  Widget _buildDepartmentCard() {
    final department =
        departmentFromIncidentType(_incident?['incident_type'] as String?);
    return _whiteCard(
      title: 'Assigned Department',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFEDD5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.local_fire_department,
                color: Color(0xFFEA580C), size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  department,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Dispatcher/unit assignment is not yet exposed to user API.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationPlaceholderCard() {
    return _whiteCard(
      title: 'Live Location',
      titleIcon: Icons.location_on,
      titleIconColor: const Color(0xFF2563EB),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 150,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.map, color: Color(0xFF2563EB), size: 38),
                  SizedBox(height: 8),
                  Text(
                    'Live responder map pending backend support',
                    style: TextStyle(fontSize: 13, color: Color(0xFF374151)),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDisabledActions() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: null,
            icon: const Icon(Icons.phone, size: 22),
            label: const Text('Call Responder'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: null,
            icon: const Icon(Icons.message_outlined, size: 22),
            label: const Text('Send Info'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: const Row(
        children: [
          Icon(Icons.info, color: Color(0xFF2563EB), size: 22),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Tracking view shows live incident status from the database. Responder-level details remain temporary.',
              style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _whiteCard({
    required String title,
    IconData? titleIcon,
    Color? titleIconColor,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (titleIcon != null) ...[
                Icon(titleIcon,
                    color: titleIconColor ?? const Color(0xFF111827), size: 20),
                const SizedBox(width: 8),
              ],
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _timelineItem({
    required IconData icon,
    required Color iconBg,
    required String title,
    required String subtitle,
    required bool isCompleted,
    bool isInProgress = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: isInProgress
                        ? const Color(0xFFEF4444)
                        : const Color(0xFF6B7280),
                    fontWeight:
                        isInProgress ? FontWeight.w500 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
          if (isCompleted)
            const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 22),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF111827),
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}
