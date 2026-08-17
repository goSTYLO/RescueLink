import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/incident_service.dart';
import '../../services/responder_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/animated_collapse.dart';
import '../../widgets/bottom_sheet_wrapper.dart';
import 'responder_incident_detail_screen.dart';

/// Full incident preview for volunteers before accepting (web Details tab parity).
class ResponderIncidentPreviewScreen extends StatefulWidget {
  final int reportId;

  const ResponderIncidentPreviewScreen({super.key, required this.reportId});

  @override
  State<ResponderIncidentPreviewScreen> createState() =>
      _ResponderIncidentPreviewScreenState();
}

class _ResponderIncidentPreviewScreenState
    extends State<ResponderIncidentPreviewScreen> {
  static const Color _screenBg = Color(0xFF0B0E14);
  static const Color _cardBg = Color(0xFF151922);
  static const Color _cardBorder = Color(0xFF252D40);
  static const Color _mutedText = Color(0xFF94A3B8);
  static const Color _primaryText = Color(0xFFF9FAFB);

  final ResponderService _responderService = ResponderService();
  final IncidentService _incidentService = IncidentService();
  final AudioPlayer _audioPlayer = AudioPlayer();

  Map<String, dynamic>? _incident;
  Map<String, dynamic>? _aiClassification;
  bool _loading = true;
  bool _accepting = false;
  String? _error;

  bool _preparingAudio = false;
  bool _audioLoaded = false;
  bool _playingAudio = false;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  final Set<int> _loadingMedia = <int>{};
  final Map<int, Uint8List> _mediaBytes = <int, Uint8List>{};

  final Map<String, bool> _sectionExpanded = {
    'overview': true,
    'reporterLocation': true,
    'ai': false,
    'description': false,
    'media': false,
    'audio': false,
    'map': true,
  };

  @override
  void initState() {
    super.initState();
    _audioPlayer.onPlayerStateChanged.listen((state) {
      if (!mounted) return;
      setState(() => _playingAudio = state == PlayerState.playing);
    });
    _audioPlayer.onPositionChanged.listen((position) {
      if (!mounted) return;
      setState(() => _audioPosition = position);
    });
    _audioPlayer.onDurationChanged.listen((duration) {
      if (!mounted) return;
      setState(() => _audioDuration = duration);
    });
    _audioPlayer.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() {
        _playingAudio = false;
        _audioPosition = Duration.zero;
      });
    });
    _loadPreview();
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _responderService.close();
    super.dispose();
  }

  Future<void> _loadPreview() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _responderService.getIncidentPreview(widget.reportId);
      if (!mounted) return;
      setState(() {
        _incident = data;
        _aiClassification = data['ai_classification'] as Map<String, dynamic>?;
        _loading = false;
      });
      _loadMediaPreviews();
    } on ResponderServiceException catch (e) {
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'Failed to load incident.'; _loading = false; });
    }
  }

  List<String> get _mediaPaths {
    final raw = _incident?['media_paths'];
    if (raw is List) {
      return raw.map((e) => e?.toString() ?? '').where((s) => s.isNotEmpty).toList();
    }
    return const [];
  }

  Future<void> _loadMediaPreviews() async {
    final paths = _mediaPaths;
    for (var i = 0; i < paths.length; i++) {
      if (!mounted) return;
      if (!_isImagePath(paths[i])) continue;
      setState(() => _loadingMedia.add(i));
      try {
        final file = await _incidentService.downloadIncidentMedia(widget.reportId, i);
        if (mounted) setState(() => _mediaBytes[i] = Uint8List.fromList(file.bytes));
      } catch (_) {}
      if (mounted) setState(() => _loadingMedia.remove(i));
    }
  }

  bool _isImagePath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp');
  }

  bool _isVideoPath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.mkv');
  }

  Future<void> _prepareAudio() async {
    if (_preparingAudio || _audioLoaded) return;
    setState(() => _preparingAudio = true);
    try {
      final file = await _incidentService.downloadIncidentAudio(widget.reportId);
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/${file.filename}';
      await File(path).writeAsBytes(file.bytes, flush: true);
      await _audioPlayer.setSourceDeviceFile(path);
      if (mounted) setState(() => _audioLoaded = true);
    } on IncidentServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _preparingAudio = false);
    }
  }

  Future<void> _toggleAudio() async {
    if (!_audioLoaded) {
      await _prepareAudio();
      if (!_audioLoaded) return;
    }
    if (_playingAudio) {
      await _audioPlayer.pause();
    } else {
      await _audioPlayer.resume();
    }
  }

  Future<void> _accept() async {
    setState(() => _accepting = true);
    try {
      final accepted = await _responderService.acceptIncident(widget.reportId);
      if (!mounted) return;
      final initialIncident = <String, dynamic>{
        if (_incident != null) ..._incident!,
        'report_id': widget.reportId,
        'responder_status': accepted['responder_status']?.toString() ?? 'Assigned',
      };
      Navigator.of(context, rootNavigator: true).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ResponderIncidentDetailScreen(
            reportId: widget.reportId,
            initialIncident: initialIncident,
          ),
        ),
      );
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  Future<void> _decline() async {
    try {
      await _responderService.declineIncident(widget.reportId);
    } catch (_) {}
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _openExternalMap(double? lat, double? lng) async {
    if (lat == null || lng == null || lat.isNaN || lng.isNaN) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location not available')),
      );
      return;
    }

    final geoUri = Uri.parse('geo:$lat,$lng?q=$lat,$lng');
    final webUri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );

    if (await canLaunchUrl(geoUri)) {
      final launched = await launchUrl(geoUri, mode: LaunchMode.externalApplication);
      if (launched) return;
    }
    if (await canLaunchUrl(webUri)) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Unable to open maps')),
    );
  }

  void _toggleSection(String id) {
    setState(() => _sectionExpanded[id] = !(_sectionExpanded[id] ?? false));
  }

  Color _severityColor(String? severity) {
    switch ((severity ?? '').toLowerCase()) {
      case 'critical':
        return const Color(0xFFEF4444);
      case 'high':
        return const Color(0xFFF97316);
      case 'medium':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  Color _statusAccentColor(String? status) {
    switch (ReportStatusUi.normalize(status)) {
      case 'closed':
      case 'resolved':
        return const Color(0xFF22C55E);
      case 'in_progress':
        return const Color(0xFF2563EB);
      case 'verified':
        return const Color(0xFF9333EA);
      case 'pending':
      default:
        return const Color(0xFFF59E0B);
    }
  }

  String _formatDuration(Duration value) {
    final m = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _reporterName() {
    final first = (_incident?['reporter_first_name'] as String?)?.trim() ?? '';
    final last = (_incident?['reporter_last_name'] as String?)?.trim() ?? '';
    final combined = [first, last].where((s) => s.isNotEmpty).join(' ');
    return combined.isNotEmpty ? combined : 'Reporter';
  }

  String _formatConfidence(dynamic raw) {
    if (raw is num) {
      final pct = raw <= 1 ? raw * 100 : raw;
      return '${pct.round()}%';
    }
    return raw?.toString() ?? '—';
  }

  IconData _iconForType(String? type) {
    if (type == null) return Icons.emergency;
    final t = type.toLowerCase();
    if (t == 'sos') return Icons.emergency;
    if (t.contains('fire')) return Icons.local_fire_department;
    if (t.contains('medical') || t.contains('health') || t.contains('accident')) {
      return Icons.monitor_heart_outlined;
    }
    if (t.contains('police')) return Icons.shield_outlined;
    if (t.contains('disaster') || t.contains('flood')) return Icons.water_drop_outlined;
    return Icons.emergency;
  }

  Future<void> _previewMedia(int index) async {
    if (index < 0 || index >= _mediaPaths.length) return;
    final path = _mediaPaths[index];
    if (!_isImagePath(path)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isVideoPath(path)
                ? 'Video inline preview is not available yet.'
                : 'Preview is not available for this file type.',
          ),
        ),
      );
      return;
    }

    var bytes = _mediaBytes[index];
    if (bytes == null) {
      setState(() => _loadingMedia.add(index));
      try {
        final file = await _incidentService.downloadIncidentMedia(widget.reportId, index);
        bytes = Uint8List.fromList(file.bytes);
        if (mounted) setState(() => _mediaBytes[index] = bytes!);
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Unable to load media')),
          );
        }
        return;
      } finally {
        if (mounted) setState(() => _loadingMedia.remove(index));
      }
    }

    if (!mounted) return;
    final imageBytes = _mediaBytes[index];
    if (imageBytes == null) return;
    showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: _cardBg,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close, color: _primaryText),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(imageBytes, fit: BoxFit.contain),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openMediaGallery() async {
    await BottomSheetWrapper.show<void>(
      context: context,
      title: 'Possible Media (${_mediaPaths.length})',
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
        ),
        itemCount: _mediaPaths.length,
        itemBuilder: (context, index) => _mediaThumbnail(index, size: 100),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _screenBg,
      appBar: AppBar(
        backgroundColor: _screenBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'Incident ${formatIncidentCode(widget.reportId)}',
          style: const TextStyle(
            color: _primaryText,
            fontWeight: FontWeight.bold,
            fontSize: 17,
          ),
        ),
        iconTheme: const IconThemeData(color: _primaryText),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444)))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          style: const TextStyle(color: Color(0xFFEF4444)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _loadPreview, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: _buildContent(),
                      ),
                    ),
                    _buildBottomBar(),
                  ],
                ),
    );
  }

  Widget _buildContent() {
    final inc = _incident!;
    final type = primaryIncidentType(inc) ?? inc['incident_type'] as String?;
    final severity = (inc['severity_level'] as String?) ?? 'medium';
    final status = inc['status'] as String?;
    final lat = parseDouble(inc['latitude']);
    final lon = parseDouble(inc['longitude']);
    final transcription = inc['transcription'] as String?;
    final hasAudio = (inc['audio_path'] as String?)?.isNotEmpty == true;
    final typeColor = incidentTypeColor(type);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CollapsibleSection(
          sectionId: 'overview',
          expanded: _sectionExpanded['overview'] ?? true,
          onToggle: () => _toggleSection('overview'),
          icon: _iconForType(type),
          iconColor: typeColor,
          title: 'Overview',
          child: _overviewBody(inc, type, severity, status, typeColor),
        ),
        const SizedBox(height: 8),
        _CollapsibleSection(
          sectionId: 'reporterLocation',
          expanded: _sectionExpanded['reporterLocation'] ?? true,
          onToggle: () => _toggleSection('reporterLocation'),
          icon: Icons.person_outline,
          iconColor: const Color(0xFF2563EB),
          title: 'Reporter & Location',
          child: _reporterLocationRow(inc, lat, lon),
        ),
        if (_aiClassification != null) ...[
          const SizedBox(height: 8),
          _CollapsibleSection(
            sectionId: 'ai',
            expanded: _sectionExpanded['ai'] ?? false,
            onToggle: () => _toggleSection('ai'),
            icon: Icons.psychology_outlined,
            iconColor: const Color(0xFF9333EA),
            title: 'AI Classification',
            child: _aiBody(inc),
          ),
        ],
        const SizedBox(height: 8),
        _CollapsibleSection(
          sectionId: 'description',
          expanded: _sectionExpanded['description'] ?? false,
          onToggle: () => _toggleSection('description'),
          icon: Icons.description_outlined,
          iconColor: const Color(0xFF2563EB),
          title: 'Description',
          child: Text(
            (inc['description'] as String?)?.trim().isNotEmpty == true
                ? inc['description'] as String
                : 'No description provided.',
            style: const TextStyle(
              fontSize: 13,
              height: 1.45,
              color: _primaryText,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        if (_mediaPaths.isNotEmpty) ...[
          const SizedBox(height: 8),
          _CollapsibleSection(
            sectionId: 'media',
            expanded: _sectionExpanded['media'] ?? false,
            onToggle: () => _toggleSection('media'),
            icon: Icons.photo_library_outlined,
            iconColor: const Color(0xFF9333EA),
            title: 'Possible Media (${_mediaPaths.length})',
            trailing: TextButton(
              onPressed: _openMediaGallery,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'View all ›',
                style: TextStyle(fontSize: 11, color: Color(0xFF2563EB)),
              ),
            ),
            child: SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _mediaPaths.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) => _mediaThumbnail(index),
              ),
            ),
          ),
        ],
        if (hasAudio || (transcription?.isNotEmpty == true)) ...[
          const SizedBox(height: 8),
          _CollapsibleSection(
            sectionId: 'audio',
            expanded: _sectionExpanded['audio'] ?? false,
            onToggle: () => _toggleSection('audio'),
            icon: Icons.mic_none_outlined,
            iconColor: const Color(0xFF9333EA),
            title: 'Audio Intelligence',
            child: _audioBody(transcription, hasAudio),
          ),
        ],
        if (lat != null && lon != null && !lat.isNaN && !lon.isNaN) ...[
          const SizedBox(height: 8),
          _CollapsibleSection(
            sectionId: 'map',
            expanded: _sectionExpanded['map'] ?? true,
            onToggle: () => _toggleSection('map'),
            icon: Icons.map_outlined,
            iconColor: const Color(0xFF22C55E),
            title: 'Map',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                height: 160,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(lat, lon),
                    initialZoom: 15,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.all,
                    ),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.rescuelink.mobile',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(lat, lon),
                          width: 36,
                          height: 36,
                          child: const Icon(
                            Icons.location_on,
                            color: Color(0xFFEF4444),
                            size: 36,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _overviewBody(
    Map<String, dynamic> inc,
    String? type,
    String severity,
    String? status,
    Color typeColor,
  ) {
    final severityLabel = severity.isNotEmpty
        ? severity[0].toUpperCase() + severity.substring(1).toLowerCase()
        : 'Medium';
    final statusLabel = ReportStatusUi.label(status);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: typeColor.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: typeColor.withValues(alpha: 0.3),
                blurRadius: 8,
                spreadRadius: -2,
              ),
            ],
          ),
          child: Icon(_iconForType(type), color: typeColor, size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    incidentTypeLabel(type),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _primaryText,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _severityColor(severity).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _severityColor(severity).withValues(alpha: 0.4),
                      ),
                    ),
                    child: Text(
                      severityLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _severityColor(severity),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 12, color: _mutedText),
                  children: [
                    const TextSpan(text: 'Status: '),
                    TextSpan(
                      text: statusLabel,
                      style: TextStyle(
                        color: _statusAccentColor(status),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 11, color: _mutedText),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      formatReportDateTime(inc['created_at'] as String?),
                      style: const TextStyle(fontSize: 11, color: _mutedText),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reporterLocationRow(Map<String, dynamic> inc, double? lat, double? lon) {
    final phone = inc['reporter_phone'] as String?;
    final location = safeString(inc['barangay']) != null
        ? '${safeString(inc['barangay'])}, Dagupan City'
        : 'Dagupan City';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _miniInfoCard(
            icon: Icons.person_outline,
            iconColor: const Color(0xFF2563EB),
            label: 'Reporter',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _reporterName(),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _primaryText,
                  ),
                ),
                if (phone != null && phone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.phone_outlined, size: 11, color: _mutedText),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          phone,
                          style: const TextStyle(fontSize: 11, color: _mutedText),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _miniInfoCard(
            icon: Icons.location_on_outlined,
            iconColor: const Color(0xFF22C55E),
            label: 'Location',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  location,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _primaryText,
                  ),
                ),
                const SizedBox(height: 4),
                GestureDetector(
                  onTap: () => _openExternalMap(lat, lon),
                  child: const Row(
                    children: [
                      Text(
                        'View on map',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF2563EB),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(Icons.chevron_right, size: 14, color: Color(0xFF2563EB)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _miniInfoCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: _screenBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 13, color: iconColor),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(fontSize: 10, color: _mutedText),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }

  Widget _aiBody(Map<String, dynamic> inc) {
    final confidence = _aiClassification?['confidence_score'];
    final chips = incidentTypeChipWidgets(
      incident: inc,
      aiClassification: _aiClassification,
      maxVisible: 2,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(mainAxisSize: MainAxisSize.min, children: chips),
          ),
        ),
        if (confidence != null) ...[
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                'Model confidence',
                style: TextStyle(fontSize: 10, color: _mutedText),
              ),
              Text(
                _formatConfidence(confidence),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF22C55E),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _audioBody(String? transcription, bool hasAudio) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (transcription?.isNotEmpty == true)
          Text(
            '"$transcription"',
            style: const TextStyle(
              fontSize: 13,
              height: 1.45,
              color: _primaryText,
              fontStyle: FontStyle.italic,
            ),
          )
        else
          const Text(
            'No transcription available.',
            style: TextStyle(fontSize: 12, color: _mutedText),
          ),
        if (hasAudio) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              SizedBox(
                width: 36,
                height: 36,
                child: IconButton(
                  padding: EdgeInsets.zero,
                  onPressed: _preparingAudio ? null : _toggleAudio,
                  icon: _preparingAudio
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          _playingAudio ? Icons.pause_circle_filled : Icons.play_circle_fill,
                          color: const Color(0xFFEF4444),
                          size: 32,
                        ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _audioLoaded
                      ? '${_formatDuration(_audioPosition)} / ${_formatDuration(_audioDuration)}'
                      : 'Tap to play recording',
                  style: const TextStyle(fontSize: 12, color: _mutedText),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _mediaThumbnail(int index, {double size = 88}) {
    final path = _mediaPaths[index];
    final isVideo = _isVideoPath(path);
    final isLoading = _loadingMedia.contains(index);
    final bytes = _mediaBytes[index];

    return GestureDetector(
      onTap: () => _previewMedia(index),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: _screenBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _cardBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: isLoading
            ? const Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : bytes != null
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.memory(bytes, fit: BoxFit.cover),
                      if (isVideo)
                        Container(
                          color: Colors.black38,
                          child: const Center(
                            child: Icon(Icons.play_circle_fill, color: Colors.white, size: 28),
                          ),
                        ),
                    ],
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(color: _cardBorder.withValues(alpha: 0.3)),
                      Center(
                        child: Icon(
                          isVideo ? Icons.videocam_outlined : Icons.image_outlined,
                          color: _mutedText,
                          size: 28,
                        ),
                      ),
                      if (isVideo)
                        const Positioned(
                          bottom: 6,
                          left: 6,
                          child: Text(
                            '0:18',
                            style: TextStyle(
                              fontSize: 9,
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        decoration: const BoxDecoration(
          color: _screenBg,
          border: Border(top: BorderSide(color: _cardBorder)),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _accepting ? null : _decline,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFEF4444),
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text(
                  'Decline',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _accepting ? null : _accept,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _accepting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        'Accept Incident',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CollapsibleSection extends StatelessWidget {
  final String sectionId;
  final bool expanded;
  final VoidCallback onToggle;
  final IconData icon;
  final Color iconColor;
  final String title;
  final Widget? trailing;
  final Widget child;

  const _CollapsibleSection({
    required this.sectionId,
    required this.expanded,
    required this.onToggle,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.child,
    this.trailing,
  });

  static const Color _cardBg = Color(0xFF151922);
  static const Color _cardBorder = Color(0xFF252D40);
  static const Color _mutedText = Color(0xFF94A3B8);
  static const Color _primaryText = Color(0xFFF9FAFB);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: onToggle,
                    borderRadius: BorderRadius.circular(8),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: iconColor.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, size: 15, color: iconColor),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _primaryText,
                            ),
                          ),
                        ),
                        AnimatedExpandIcon(
                          expanded: expanded,
                          size: 20,
                          color: _mutedText,
                        ),
                      ],
                    ),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          AnimatedCollapse(
            expanded: expanded,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}
