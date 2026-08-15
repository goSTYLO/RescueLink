import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import '../../services/incident_service.dart';
import '../../services/responder_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/glass_card.dart';
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

  List<dynamic> get _mediaPaths {
    final raw = _incident?['media_paths'];
    if (raw is List) return raw;
    return const [];
  }

  Future<void> _loadMediaPreviews() async {
    final paths = _mediaPaths;
    for (var i = 0; i < paths.length; i++) {
      if (!mounted) return;
      setState(() => _loadingMedia.add(i));
      try {
        final file = await _incidentService.downloadIncidentMedia(widget.reportId, i);
        if (mounted) setState(() => _mediaBytes[i] = Uint8List.fromList(file.bytes));
      } catch (_) {}
      if (mounted) setState(() => _loadingMedia.remove(i));
    }
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

  Color _severityColor(String? severity) {
    switch ((severity ?? '').toLowerCase()) {
      case 'critical': return const Color(0xFFEF4444);
      case 'high': return const Color(0xFFF97316);
      case 'medium': return const Color(0xFFF59E0B);
      default: return const Color(0xFF3B82F6);
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF0F1420) : const Color(0xFFF1F5F9);
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSec = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Incident ${formatIncidentCode(widget.reportId)}',
          style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
        ),
        iconTheme: IconThemeData(color: textPrimary),
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
                        Text(_error!, style: const TextStyle(color: Color(0xFFEF4444)), textAlign: TextAlign.center),
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
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                        child: _buildContent(textPrimary, textSec),
                      ),
                    ),
                    _buildBottomBar(textSec),
                  ],
                ),
    );
  }

  Widget _buildContent(Color textPrimary, Color textSec) {
    final inc = _incident!;
    final type = incidentTypeLabel(inc['incident_type'] as String?);
    final severity = (inc['severity_level'] as String?) ?? 'medium';
    final status = ReportStatusUi.label(inc['status'] as String?);
    final lat = parseDouble(inc['latitude']);
    final lon = parseDouble(inc['longitude']);
    final transcription = inc['transcription'] as String?;
    final hasAudio = (inc['audio_path'] as String?)?.isNotEmpty == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(type, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textPrimary)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _severityColor(severity).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      severity.isNotEmpty
                          ? severity[0].toUpperCase() + severity.substring(1).toLowerCase()
                          : 'Medium',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _severityColor(severity)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text('Status: $status', style: TextStyle(fontSize: 13, color: textSec)),
              const SizedBox(height: 4),
              Text(
                formatReportDateTime(inc['created_at'] as String?),
                style: TextStyle(fontSize: 13, color: textSec),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Reporter', style: TextStyle(fontSize: 12, color: textSec)),
              const SizedBox(height: 4),
              Text(_reporterName(), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary)),
              if ((inc['reporter_phone'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 4),
                Text(inc['reporter_phone'] as String, style: TextStyle(fontSize: 13, color: textSec)),
              ],
              const SizedBox(height: 12),
              Text('Location', style: TextStyle(fontSize: 12, color: textSec)),
              const SizedBox(height: 4),
              Text(
                safeString(inc['barangay']) != null
                    ? '${safeString(inc['barangay'])}, Dagupan City'
                    : 'Dagupan City',
                style: TextStyle(fontSize: 15, color: textPrimary),
              ),
            ],
          ),
        ),
        if (_aiClassification != null) ...[
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AI Classification', style: TextStyle(fontSize: 12, color: textSec)),
                const SizedBox(height: 4),
                Text(
                  incidentTypeLabel(_aiClassification!['predicted_type'] as String?),
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary),
                ),
                if (_aiClassification!['confidence_score'] != null)
                  Text(
                    'Confidence: ${_aiClassification!['confidence_score']}%',
                    style: TextStyle(fontSize: 13, color: textSec),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Description', style: TextStyle(fontSize: 12, color: textSec)),
              const SizedBox(height: 8),
              Text(
                (inc['description'] as String?) ?? 'No description provided.',
                style: TextStyle(fontSize: 14, height: 1.5, color: textPrimary),
              ),
            ],
          ),
        ),
        if (lat != null && lon != null) ...[
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 200,
              child: FlutterMap(
                options: MapOptions(initialCenter: LatLng(lat, lon), initialZoom: 15),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.rescuelink.mobile',
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(lat, lon),
                        width: 40,
                        height: 40,
                        child: const Icon(Icons.location_on, color: Color(0xFFEF4444), size: 36),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
        if (hasAudio || (transcription?.isNotEmpty == true)) ...[
          const SizedBox(height: 12),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Audio Intelligence', style: TextStyle(fontSize: 12, color: textSec)),
                const SizedBox(height: 8),
                if (transcription?.isNotEmpty == true)
                  Text(transcription!, style: TextStyle(fontSize: 14, height: 1.5, color: textPrimary))
                else
                  Text('No transcription available.', style: TextStyle(fontSize: 13, color: textSec)),
                if (hasAudio) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      IconButton(
                        onPressed: _preparingAudio ? null : _toggleAudio,
                        icon: _preparingAudio
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Icon(_playingAudio ? Icons.pause_circle_filled : Icons.play_circle_fill,
                                color: const Color(0xFFEF4444), size: 36),
                      ),
                      Expanded(
                        child: Text(
                          _audioLoaded
                              ? '${_formatDuration(_audioPosition)} / ${_formatDuration(_audioDuration)}'
                              : 'Tap to play recording',
                          style: TextStyle(fontSize: 13, color: textSec),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
        if (_mediaPaths.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('Media & Evidence', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary)),
          const SizedBox(height: 8),
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _mediaPaths.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                if (_loadingMedia.contains(index)) {
                  return Container(
                    width: 120,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: textSec.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const CircularProgressIndicator(strokeWidth: 2),
                  );
                }
                final bytes = _mediaBytes[index];
                if (bytes == null) {
                  return Container(
                    width: 120,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: textSec.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.broken_image_outlined, color: textSec),
                  );
                }
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.memory(bytes, width: 120, height: 120, fit: BoxFit.cover),
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBottomBar(Color textSec) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          border: Border(top: BorderSide(color: textSec.withValues(alpha: 0.2))),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _accepting ? null : _decline,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Decline', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _accepting ? null : _accept,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _accepting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Accept Incident', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
