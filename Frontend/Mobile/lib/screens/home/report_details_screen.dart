import 'package:flutter/material.dart';
import '../../services/incident_service.dart';
import '../../utils/report_ui.dart';

class ReportDetailsScreen extends StatefulWidget {
  final int? reportId;
  final VoidCallback? onBack;

  const ReportDetailsScreen({super.key, this.reportId, this.onBack});

  @override
  State<ReportDetailsScreen> createState() => _ReportDetailsScreenState();
}

class _ReportDetailsScreenState extends State<ReportDetailsScreen> {
  Map<String, dynamic>? _incident;
  Map<String, dynamic>? _aiClassification;
  final IncidentService _incidentService = IncidentService();
  bool _loading = true;
  bool _confirmingResolution = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    if (widget.reportId != null) {
      _loadIncident();
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadIncident() async {
    if (widget.reportId == null) return;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data =
          await IncidentService().getIncidentWithAiFallback(widget.reportId!);
      if (!mounted) return;
      setState(() {
        _incident = data['incident'] as Map<String, dynamic>?;
        _aiClassification = data['ai_classification'] as Map<String, dynamic>?;
        _loading = false;
        _loadError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e is IncidentServiceException ? e.message : e.toString();
      });
    }
  }

  bool get _reporterConfirmed =>
      (_incident?['reporter_confirmed_at'] as String?) != null;

  Future<void> _confirmResolution() async {
    final reportId = widget.reportId;
    if (reportId == null || _confirmingResolution) return;
    setState(() => _confirmingResolution = true);
    try {
      await _incidentService.confirmIncidentResolution(reportId);
      if (!mounted) return;
      await _loadIncident();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resolution confirmed.')),
      );
    } on IncidentServiceException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) {
        setState(() => _confirmingResolution = false);
      }
    }
  }

  String _reportIdDisplay() {
    return formatIncidentCode(
        ((_incident?['report_id'] as num?)?.toInt()) ?? widget.reportId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Column(
          children: [
            // Red header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.onBack,
                    icon: const CircleAvatar(
                      backgroundColor: Colors.white,
                      child: Icon(Icons.arrow_back,
                          color: Color(0xFF111827), size: 22),
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
                          'Report Details',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _reportIdDisplay(),
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.95),
                              fontSize: 12),
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
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadIncident,
                child: _loading
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(
                            height: 320,
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        ],
                      )
                    : _loadError != null
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(20),
                            children: [
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(_loadError!,
                                      style: const TextStyle(
                                          color: Color(0xFFDC2626)),
                                      textAlign: TextAlign.center),
                                  const SizedBox(height: 12),
                                  TextButton(
                                    onPressed: _loadIncident,
                                    child: const Text('Retry'),
                                  ),
                                ],
                              ),
                            ],
                          )
                        : SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                              // Status card
                              _buildStatusCard(),
                              const SizedBox(height: 16),
                              // Incident Summary card
                              _whiteCard(
                                title: 'Incident Summary',
                                icon: Icons.emergency,
                                iconColor: const Color(0xFFEA580C),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _detailRow(
                                      icon: Icons.whatshot_outlined,
                                      iconBg: const Color(0xFFFFEDD5),
                                      label: 'Emergency Type',
                                      value: incidentTypeLabel(
                                          _incident?['incident_type']
                                              as String?),
                                    ),
                                    const SizedBox(height: 12),
                                    _detailRow(
                                      icon: Icons.calendar_today,
                                      iconBg: const Color(0xFFDBEAFE),
                                      label: 'Date & Time',
                                      value: formatReportDateTime(
                                          _incident?['created_at'] as String?),
                                    ),
                                    const SizedBox(height: 12),
                                    _detailRow(
                                      icon: Icons.location_on,
                                      iconBg: const Color(0xFFDBEAFE),
                                      label: 'Location',
                                      value: safeString(
                                                  _incident?['barangay']) !=
                                              null
                                          ? '${safeString(_incident?['barangay'])}, Dagupan City'
                                          : 'Dagupan City',
                                      subtitle: _incident != null &&
                                              _incident!['latitude'] != null &&
                                              _incident!['longitude'] != null
                                          ? '${(_incident!['latitude'] as num).toStringAsFixed(4)}° N, ${(_incident!['longitude'] as num).toStringAsFixed(4)}° E'
                                          : null,
                                    ),
                                    if (_incident?['description'] != null &&
                                        (_incident!['description'] as String)
                                            .isNotEmpty) ...[
                                      const SizedBox(height: 12),
                                      _detailRow(
                                        icon: Icons.description,
                                        iconBg: const Color(0xFFF3F4F6),
                                        label: 'Description',
                                        value:
                                            _incident!['description'] as String,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              // Voice Recording card
                              _whiteCard(
                                title: 'Voice Recording',
                                icon: Icons.mic,
                                iconColor: const Color(0xFFEF4444),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _simpleRow(
                                      'Audio File',
                                      safeString(_incident?['audio_path']) !=
                                              null
                                          ? 'Available'
                                          : 'Not available',
                                    ),
                                    if (_incident?['transcription'] != null ||
                                        _aiClassification?['transcription'] !=
                                            null) ...[
                                      const SizedBox(height: 10),
                                      const Text(
                                        'Transcription',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Color(0xFF6B7280)),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _incident?['transcription']
                                                as String? ??
                                            _aiClassification?['transcription']
                                                as String? ??
                                            '',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFF374151),
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 10),
                                    const Text(
                                      'Playback and download controls will be added once audio-stream endpoint wiring is completed.',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF6B7280)),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              // Attach Media card
                              _whiteCard(
                                title: 'Attached Media',
                                icon: Icons.attach_file,
                                iconColor: const Color(0xFF374151),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _simpleRow(
                                      'Media files',
                                      ((_incident?['media_paths'] as List?)
                                                  ?.length ??
                                              0)
                                          .toString(),
                                    ),
                                    const SizedBox(height: 10),
                                    const Text(
                                      'Preview/download actions are disabled until media endpoint handling is integrated in this screen.',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF6B7280)),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              // Response Details card
                              _whiteCard(
                                title: 'Response Details',
                                icon: Icons.info_outline,
                                iconColor: const Color(0xFF374151),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _simpleRow(
                                        'Status',
                                        ReportStatusUi.label(
                                            _incident?['status'] as String?)),
                                    const SizedBox(height: 10),
                                    _simpleRow(
                                        'Department',
                                        departmentFromIncidentType(
                                            _incident?['incident_type']
                                                as String?)),
                                    const SizedBox(height: 10),
                                    _simpleRow(
                                        'Severity',
                                        severityLabel(
                                            _incident?['severity_level']
                                                as String?)),
                                    const SizedBox(height: 10),
                                    _simpleRow(
                                        'Type',
                                        incidentTypeLabel(
                                            _incident?['incident_type']
                                                as String?)),
                                    const SizedBox(height: 10),
                                    _simpleRow(
                                        'Barangay',
                                        safeString(_incident?['barangay']) ??
                                            'Unknown'),
                                    if (_aiClassification != null) ...[
                                      const SizedBox(height: 10),
                                      _simpleRow(
                                          'AI Severity',
                                          safeString(_aiClassification?[
                                                  'severity']) ??
                                              'Unknown'),
                                      const SizedBox(height: 10),
                                      _simpleRow(
                                        'AI Confidence',
                                        _aiClassification?['confidence'] != null
                                            ? '${((_aiClassification!['confidence'] as num) * 100).toStringAsFixed(0)}%'
                                            : 'Unknown',
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              // Resolution footer
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: ReportStatusUi.isResolved(
                                          _incident?['status'] as String?)
                                      ? const Color(0xFFDCFCE7)
                                      : const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: ReportStatusUi.isResolved(
                                            _incident?['status'] as String?)
                                        ? const Color(0xFF86EFAC)
                                        : const Color(0xFFBFDBFE),
                                  ),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      ReportStatusUi.isResolved(
                                              _incident?['status'] as String?)
                                          ? Icons.check_circle
                                          : Icons.info,
                                      color: ReportStatusUi.isResolved(
                                              _incident?['status'] as String?)
                                          ? const Color(0xFF22C55E)
                                          : const Color(0xFF2563EB),
                                      size: 24,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            ReportStatusUi.isResolved(
                                                    _incident?['status']
                                                        as String?)
                                                ? 'Emergency Resolved'
                                                : 'Emergency In Progress',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: ReportStatusUi.isResolved(
                                                      _incident?['status']
                                                          as String?)
                                                  ? const Color(0xFF166534)
                                                  : const Color(0xFF1E40AF),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            ReportStatusUi.isResolved(
                                                    _incident?['status']
                                                        as String?)
                                                ? 'Resolved on ${formatReportDateTime(_incident?['updated_at'] as String?)}.'
                                                : 'Latest status: ${ReportStatusUi.label(_incident?['status'] as String?)}.',
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: ReportStatusUi.isResolved(
                                                      _incident?['status']
                                                          as String?)
                                                  ? const Color(0xFF15803D)
                                                  : const Color(0xFF1E40AF),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (ReportStatusUi.isResolved(
                                      _incident?['status'] as String?) &&
                                  !_reporterConfirmed) ...[
                                const SizedBox(height: 16),
                                FilledButton.icon(
                                  onPressed: _confirmingResolution ? null : _confirmResolution,
                                  icon: _confirmingResolution
                                      ? const SizedBox(
                                          height: 16,
                                          width: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Icon(Icons.thumb_up_alt_outlined),
                                  label: Text(_confirmingResolution
                                      ? 'Confirming...'
                                      : 'Confirm Resolution'),
                                ),
                              ],
                              if (ReportStatusUi.isResolved(
                                      _incident?['status'] as String?) &&
                                  _reporterConfirmed) ...[
                                const SizedBox(height: 12),
                                const Row(
                                  children: [
                                    Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 20),
                                    SizedBox(width: 8),
                                    Text('You confirmed this resolution.',
                                        style: TextStyle(fontSize: 13, color: Color(0xFF15803D))),
                                  ],
                                ),
                              ],
                                const SizedBox(height: 24),
                              ],
                            ),
                          ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard() {
    final status = _incident?['status'] as String?;
    final isResolved = ReportStatusUi.isResolved(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      decoration: BoxDecoration(
        color: ReportStatusUi.badgeBackground(status),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ReportStatusUi.badgeBorder(status)),
      ),
      child: Column(
        children: [
          Icon(
            ReportStatusUi.badgeIcon(status),
            color: ReportStatusUi.badgeText(status),
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            isResolved ? 'Successfully Resolved' : ReportStatusUi.label(status),
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: ReportStatusUi.badgeText(status),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isResolved
                ? 'Emergency handled'
                : 'Report status is synced from database',
            style: TextStyle(
              fontSize: 13,
              color: ReportStatusUi.badgeText(status),
            ),
          ),
        ],
      ),
    );
  }

  Widget _whiteCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
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
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 8),
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

  Widget _detailRow({
    required IconData icon,
    required Color iconBg,
    required String label,
    required String value,
    String? subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon,
              color: iconBg == const Color(0xFFFFEDD5)
                  ? const Color(0xFFEA580C)
                  : const Color(0xFF2563EB),
              size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827)),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _simpleRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF111827)),
          ),
        ),
      ],
    );
  }
}
