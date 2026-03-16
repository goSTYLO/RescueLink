import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import '../../services/incident_service.dart';
import '../../services/notification_service.dart';
import '../../services/websocket_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/report_ui.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gradient_header.dart';
import '../../widgets/skeleton_placeholder.dart';
import 'notifications_screen.dart';

class IncidentDetailsScreen extends StatefulWidget {
  final int? reportId;
  final Map<String, dynamic>? initialIncident;
  final VoidCallback? onBack;
  final VoidCallback? onNotificationsTap;
  final void Function(int reportId)? onReportTap;

  const IncidentDetailsScreen({
    super.key,
    this.reportId,
    this.initialIncident,
    this.onBack,
    this.onNotificationsTap,
    this.onReportTap,
  });

  @override
  State<IncidentDetailsScreen> createState() => _IncidentDetailsScreenState();
}

class _IncidentDetailsScreenState extends State<IncidentDetailsScreen> {
  Map<String, dynamic>? _incident;
  Map<String, dynamic>? _aiClassification;
  final IncidentService _incidentService = IncidentService();
  final AudioPlayer _audioPlayer = AudioPlayer();
  StreamSubscription<IncidentEvent>? _wsSubscription;
  final List<StreamSubscription<dynamic>> _audioSubscriptions =
      <StreamSubscription<dynamic>>[];
  bool _loading = true;
  bool _confirmingResolution = false;
  bool _downloadingAudio = false;
  bool _preparingAudio = false;
  bool _audioLoaded = false;
  bool _playingAudio = false;
  final Set<int> _downloadingMedia = <int>{};
  final Set<int> _previewingMedia = <int>{};
  final Map<int, Uint8List> _mediaPreviewBytes = <int, Uint8List>{};
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  String? _loadError;
  final Set<String> _expandedSections = {'timeline', 'summary'};
  int _apiUnreadCount = 0;

  @override
  void initState() {
    super.initState();
    _incident = widget.initialIncident;
    _audioSubscriptions.add(
      _audioPlayer.onPlayerStateChanged.listen((state) {
        if (!mounted) return;
        final isPlaying = state == PlayerState.playing;
        setState(() => _playingAudio = isPlaying);
      }),
    );
    _audioSubscriptions.add(
      _audioPlayer.onPositionChanged.listen((position) {
        if (!mounted) return;
        setState(() => _audioPosition = position);
      }),
    );
    _audioSubscriptions.add(
      _audioPlayer.onDurationChanged.listen((duration) {
        if (!mounted) return;
        setState(() => _audioDuration = duration);
      }),
    );
    _audioSubscriptions.add(
      _audioPlayer.onPlayerComplete.listen((_) {
        if (!mounted) return;
        setState(() {
          _playingAudio = false;
          _audioPosition = Duration.zero;
        });
      }),
    );

    _fetchUnreadCount();
    if (_resolvedReportId != null) {
      _loadIncident();
      _wsSubscription = WebSocketService().eventStream.listen((event) {
        if (!mounted) return;
        final rid = event.reportId ?? event.data['report_id'];
        if (rid != null && rid == _resolvedReportId) {
          _loadIncident();
        }
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  void didUpdateWidget(IncidentDetailsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reportId != widget.reportId && widget.reportId != null) {
      setState(() {
        _incident = null;
        _aiClassification = null;
        _loading = true;
      });
      _loadIncident();
    }
  }

  Future<void> _fetchUnreadCount() async {
    try {
      final count = await NotificationService().getUnreadCount();
      if (mounted) setState(() => _apiUnreadCount = count);
    } catch (_) {}
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    for (final subscription in _audioSubscriptions) {
      subscription.cancel();
    }
    _audioPlayer.dispose();
    _incidentService.close();
    super.dispose();
  }

  Future<void> _loadIncident() async {
    final reportId = _resolvedReportId;
    if (reportId == null) return;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await IncidentService().getIncidentWithAiFallback(reportId);
      if (!mounted) return;
      setState(() {
        _incident = _mapOrNull(data['incident']);
        _aiClassification = _mapOrNull(data['ai_classification']);
        _loading = false;
        _loadError = null;
      });
      if (mounted && _mediaPaths.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _loadThumbnailsForImages();
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e is IncidentServiceException ? e.message : e.toString();
      });
    }
  }

  Future<void> _loadThumbnail(int mediaIndex) async {
    if (_previewingMedia.contains(mediaIndex) ||
        _mediaPreviewBytes.containsKey(mediaIndex)) return;
    if (mediaIndex < 0 || mediaIndex >= _mediaPaths.length) return;
    if (!_isImagePath(_mediaPaths[mediaIndex])) return;
    final reportId = _resolvedReportId;
    if (reportId == null) return;
    setState(() => _previewingMedia.add(mediaIndex));
    try {
      final file =
          await _incidentService.downloadIncidentMedia(reportId, mediaIndex);
      final bytes = Uint8List.fromList(file.bytes);
      if (!mounted) return;
      setState(() {
        _mediaPreviewBytes[mediaIndex] = bytes;
        _previewingMedia.remove(mediaIndex);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _previewingMedia.remove(mediaIndex));
    }
  }

  void _loadThumbnailsForImages() {
    if (_resolvedReportId == null) return;
    for (int i = 0; i < _mediaPaths.length; i++) {
      if (!_isImagePath(_mediaPaths[i])) continue;
      if (_mediaPreviewBytes.containsKey(i)) continue;
      if (_previewingMedia.contains(i)) continue;
      _loadThumbnail(i);
    }
  }

  int? get _resolvedReportId =>
      widget.reportId ?? (_incident?['report_id'] as num?)?.toInt();

  String get _status => ReportStatusUi.normalize(_incident?['status'] as String?);

  int? get _estimatedEtaMinutes {
    final raw = _incident?['estimated_eta_minutes'];
    if (raw is num) return raw.toInt();
    if (raw is String) return int.tryParse(raw);
    return null;
  }

  String get _estimatedArrivalLabel {
    final raw = _incident?['estimated_arrival_at'] as String?;
    if (raw == null || raw.isEmpty) return '-';
    return formatReportDateTime(raw);
  }

  Map<String, dynamic>? _mapOrNull(dynamic value) {
    if (value is Map) {
      return value.cast<String, dynamic>();
    }
    return null;
  }

  List<String> get _mediaPaths {
    // Support both media_paths (snake_case) and mediaPaths (camelCase)
    dynamic raw = _incident?['media_paths'] ?? _incident?['mediaPaths'];
    if (raw is List) {
      return raw.whereType<String>().where((path) => path.isNotEmpty).toList();
    }
    if (raw is String && raw.isNotEmpty) {
      try {
        final parsed = jsonDecode(raw);
        if (parsed is List) {
          return parsed.whereType<String>().where((path) => path.isNotEmpty).toList();
        }
      } catch (_) {}
    }
    return const [];
  }

  bool _isImagePath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png');
  }

  bool _isVideoPath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi');
  }

  Future<void> _toggleAudioPlayback() async {
    final reportId = _resolvedReportId;
    if (reportId == null || _preparingAudio) {
      return;
    }

    try {
      if (!_audioLoaded) {
        setState(() => _preparingAudio = true);
        final file = await _incidentService.downloadIncidentAudio(reportId);
        await _audioPlayer.setSource(BytesSource(Uint8List.fromList(file.bytes)));
        if (!mounted) return;
        setState(() {
          _audioLoaded = true;
          _preparingAudio = false;
        });
      }

      if (_playingAudio) {
        await _audioPlayer.pause();
      } else {
        await _audioPlayer.resume();
      }
    } on IncidentServiceException catch (error) {
      if (!mounted) return;
      setState(() => _preparingAudio = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _preparingAudio = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to play audio preview right now.')),
      );
    }
  }

  Future<void> _previewMedia(int mediaIndex) async {
    if (_previewingMedia.contains(mediaIndex)) {
      return;
    }

    if (mediaIndex < 0 || mediaIndex >= _mediaPaths.length) {
      return;
    }

    final mediaPath = _mediaPaths[mediaIndex];
    if (!_isImagePath(mediaPath)) {
      final message = _isVideoPath(mediaPath)
          ? 'Video inline preview is not available yet. Use download for this file.'
          : 'Preview is not available for this media type. Use download instead.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      return;
    }

    final cached = _mediaPreviewBytes[mediaIndex];
    if (cached != null) {
      _showImagePreview(mediaPath, cached);
      return;
    }

    final reportId = _resolvedReportId;
    if (reportId == null) {
      return;
    }

    setState(() => _previewingMedia.add(mediaIndex));
    try {
      final file = await _incidentService.downloadIncidentMedia(reportId, mediaIndex);
      final bytes = Uint8List.fromList(file.bytes);
      if (!mounted) return;
      setState(() {
        _mediaPreviewBytes[mediaIndex] = bytes;
        _previewingMedia.remove(mediaIndex);
      });
      _showImagePreview(mediaPath, bytes);
    } on IncidentServiceException catch (error) {
      if (!mounted) return;
      setState(() => _previewingMedia.remove(mediaIndex));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _previewingMedia.remove(mediaIndex));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to preview media right now.')),
      );
    }
  }

  void _showImagePreview(String mediaPath, Uint8List bytes) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Media Preview',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: InteractiveViewer(
                  child: Image.memory(
                    bytes,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(20),
                      child: Text('Unable to render this image preview.'),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  mediaPath,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDuration(Duration value) {
    final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  double? _parseNumeric(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      final normalized = value.trim().replaceAll('%', '');
      return double.tryParse(normalized);
    }
    return null;
  }

  String _aiConfidenceLabel() {
    final raw =
        _aiClassification?['confidence'] ??
        _aiClassification?['confidence_score'] ??
        _incident?['primary_confidence'];
    final numeric = _parseNumeric(raw);
    if (numeric == null) {
      return 'Unknown';
    }

    // Support both ratio (0-1) and percent-like (0-100) confidence values.
    final percent = numeric <= 1 ? numeric * 100 : numeric;
    final clamped = percent.clamp(0, 100).toDouble();
    final nearInteger = (clamped - clamped.roundToDouble()).abs() < 0.05;
    final display = nearInteger
        ? clamped.round().toString()
        : clamped.toStringAsFixed(1);
    return '$display%';
  }

  Future<void> _downloadAudio() async {
    final reportId = _resolvedReportId;
    if (reportId == null || _downloadingAudio) {
      return;
    }

    setState(() => _downloadingAudio = true);
    try {
      final file = await _incidentService.downloadIncidentAudio(reportId);
      final savedPath = await _saveToDevice(file);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Audio downloaded to $savedPath')),
      );
    } on IncidentServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) {
        setState(() => _downloadingAudio = false);
      }
    }
  }

  Future<void> _downloadMedia(int mediaIndex) async {
    final reportId = _resolvedReportId;
    if (reportId == null || _downloadingMedia.contains(mediaIndex)) {
      return;
    }

    setState(() => _downloadingMedia.add(mediaIndex));
    try {
      final file = await _incidentService.downloadIncidentMedia(reportId, mediaIndex);
      final savedPath = await _saveToDevice(file);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Media downloaded to $savedPath')),
      );
    } on IncidentServiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) {
        setState(() => _downloadingMedia.remove(mediaIndex));
      }
    }
  }

  Future<String> _saveToDevice(IncidentFileDownload file) async {
    final documents = await getApplicationDocumentsDirectory();
    final downloadDir = Directory('${documents.path}/incident_downloads');
    if (!await downloadDir.exists()) {
      await downloadDir.create(recursive: true);
    }
    final outputFile = File('${downloadDir.path}/${file.filename}');
    await outputFile.writeAsBytes(file.bytes, flush: true);
    return outputFile.path;
  }

  bool get _reporterConfirmed =>
      (_incident?['reporter_confirmed_at'] as String?) != null;

  Future<void> _confirmResolution() async {
    final reportId = _resolvedReportId;
    if (reportId == null || _confirmingResolution) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm resolution?'),
        content: const Text(
          'Confirm that this incident is resolved on your end? This will record your confirmation for our records.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
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
      ((_incident?['report_id'] as num?)?.toInt()) ?? _resolvedReportId);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onBack?.call();
      },
      child: Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor,
      body: Column(
        children: [
          GradientHeader(
            title: 'Incident Details',
            subtitle: _reportIdDisplay(),
            onBack: widget.onBack,
            transparentFade: true,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Badge(
                  isLabelVisible: _apiUnreadCount > 0,
                  label: Text(
                    '$_apiUnreadCount',
                    style: const TextStyle(fontSize: 10, color: Colors.white),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.notifications_none, color: Colors.white, size: 28),
                    onPressed: widget.onNotificationsTap ?? _openNotifications,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ),
                const SizedBox(width: 8),
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
            child: SafeArea(
              top: false,
              child: RefreshIndicator(
                onRefresh: _loadIncident,
                child: _loading
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        children: const [
                          SkeletonCard(height: 120),
                          SizedBox(height: 12),
                          SkeletonCard(height: 100),
                          SizedBox(height: 12),
                          SkeletonCard(height: 100),
                          SizedBox(height: 12),
                          SkeletonCard(height: 150),
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
                              if (ReportStatusUi.isResolvedOrClosed(
                                      _incident?['status'] as String?) &&
                                  _reporterConfirmed) ...[
                                const SizedBox(height: 12),
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    return Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 20),
                                        const SizedBox(width: 8),
                                        SizedBox(
                                          width: constraints.maxWidth.isFinite
                                              ? (constraints.maxWidth - 28).clamp(0.0, double.infinity)
                                              : 300,
                                          child: Text(
                                            ReportStatusUi.isClosed(_incident?['status'] as String?)
                                                ? 'You confirmed this resolution. Incident is now closed.'
                                                : 'You confirmed this resolution.',
                                            style: const TextStyle(fontSize: 13, color: Color(0xFF15803D)),
                                            maxLines: 3,
                                            overflow: TextOverflow.ellipsis,
                                            softWrap: true,
                                          ),
                                        ),
                                      ],
                                    );
                                  },
                                ),
                              ],
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'timeline',
                                title: 'Status Timeline',
                                icon: Icons.timeline,
                                iconColor: const Color(0xFF2563EB),
                                child: _buildTimelineCardContent(),
                              ),
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'responder',
                                title: 'Assigned Department',
                                icon: Icons.local_fire_department,
                                iconColor: const Color(0xFFEA580C),
                                child: _buildResponderAvailabilityCardContent(),
                              ),
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'location',
                                title: 'Incident Location',
                                icon: Icons.location_on,
                                iconColor: const Color(0xFF2563EB),
                                child: _buildResponderLocationCardContent(),
                              ),
                              const SizedBox(height: 16),
                              _buildResponderActions(),
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'summary',
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
                                      value: safeString(_incident?['barangay']) != null
                                          ? '${safeString(_incident?['barangay'])}, Dagupan City'
                                          : 'Dagupan City',
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
                              _collapsibleCard(
                                key: 'voice',
                                title: 'Voice Recording',
                                icon: Icons.mic,
                                iconColor: const Color(0xFFEF4444),
                                child: _buildVoiceRecordingCardContent(),
                              ),
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'media',
                                title: 'Attached Media',
                                icon: Icons.attach_file,
                                iconColor: Theme.of(context).colorScheme.onSurfaceVariant,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _simpleRow(
                                      'Media files',
                                      _mediaPaths.length.toString(),
                                    ),
                                    const SizedBox(height: 10),
                                    if (_mediaPaths.isEmpty)
                                      Text(
                                        'No media attachments are available for this incident.',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Theme.of(context).colorScheme.onSurfaceVariant),
                                      )
                                    else
                                      Wrap(
                                        spacing: 12,
                                        runSpacing: 12,
                                        children: List<Widget>.generate(_mediaPaths.length, (index) {
                                          final path = _mediaPaths[index];
                                          final isImage = _isImagePath(path);
                                          final downloading = _downloadingMedia.contains(index);
                                          final loadingThumb = _previewingMedia.contains(index);
                                          final cached = _mediaPreviewBytes[index];
                                          if (isImage) {
                                            return Padding(
                                              padding: const EdgeInsets.only(bottom: 8),
                                              child: Row(
                                                crossAxisAlignment: CrossAxisAlignment.center,
                                                children: [
                                                  SizedBox(
                                                    width: 80,
                                                    height: 80,
                                                    child: GestureDetector(
                                                      onTap: cached != null
                                                          ? () => _showImagePreview(path, cached)
                                                          : null,
                                                      child: ClipRRect(
                                                        borderRadius: BorderRadius.circular(8),
                                                        child: Container(
                                                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                                          child: loadingThumb
                                                              ? const Center(
                                                                  child: SizedBox(
                                                                    width: 24,
                                                                    height: 24,
                                                                    child: CircularProgressIndicator(strokeWidth: 2),
                                                                  ),
                                                                )
                                                              : cached != null
                                                                  ? Image.memory(
                                                                      cached,
                                                                      fit: BoxFit.cover,
                                                                      width: 80,
                                                                      height: 80,
                                                                      errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined, size: 32),
                                                                    )
                                                                  : const Icon(Icons.image_outlined, size: 32),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 12),
                                                  Expanded(
                                                    child: OutlinedButton.icon(
                                                      onPressed: downloading ? null : () => _downloadMedia(index),
                                                      icon: downloading
                                                          ? const SizedBox(
                                                              width: 14,
                                                              height: 14,
                                                              child: CircularProgressIndicator(strokeWidth: 2),
                                                            )
                                                          : const Icon(Icons.download_outlined, size: 18),
                                                      label: const Text('Download'),
                                                      style: OutlinedButton.styleFrom(
                                                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }
                                          return Padding(
                                            padding: const EdgeInsets.only(bottom: 8),
                                            child: Row(
                                              crossAxisAlignment: CrossAxisAlignment.center,
                                              children: [
                                                SizedBox(
                                                  width: 80,
                                                  height: 80,
                                                  child: GestureDetector(
                                                    onTap: () => _previewMedia(index),
                                                    child: ClipRRect(
                                                      borderRadius: BorderRadius.circular(8),
                                                      child: Container(
                                                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                                        child: const Center(
                                                          child: Icon(Icons.videocam_outlined, size: 32),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 12),
                                                Expanded(
                                                  child: OutlinedButton.icon(
                                                    onPressed: downloading ? null : () => _downloadMedia(index),
                                                    icon: downloading
                                                        ? const SizedBox(
                                                            width: 14,
                                                            height: 14,
                                                            child: CircularProgressIndicator(strokeWidth: 2),
                                                          )
                                                        : const Icon(Icons.download_outlined, size: 18),
                                                    label: const Text('Download'),
                                                    style: OutlinedButton.styleFrom(
                                                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          );
                                        }),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              _collapsibleCard(
                                key: 'response',
                                title: 'Response Details',
                                icon: Icons.info_outline,
                                iconColor: Theme.of(context).colorScheme.onSurfaceVariant,
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
                                        assignedDepartmentDisplayName(
                                            _incident)),
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
                                        'AI Confidence',
                                        _aiConfidenceLabel(),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: ReportStatusUi.isResolvedOrClosed(
                                          _incident?['status'] as String?)
                                      ? const Color(0xFFDCFCE7)
                                      : const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: ReportStatusUi.isResolvedOrClosed(
                                            _incident?['status'] as String?)
                                        ? const Color(0xFF86EFAC)
                                        : const Color(0xFFBFDBFE),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      ReportStatusUi.isResolvedOrClosed(
                                              _incident?['status'] as String?)
                                          ? Icons.check_circle
                                          : Icons.info,
                                      color: ReportStatusUi.isResolvedOrClosed(
                                              _incident?['status'] as String?)
                                          ? const Color(0xFF22C55E)
                                          : const Color(0xFF2563EB),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      ReportStatusUi.isClosed(_incident?['status'] as String?)
                                          ? 'Incident Closed'
                                          : (ReportStatusUi.isResolved(_incident?['status'] as String?)
                                              ? 'Emergency Resolved'
                                              : ReportStatusUi.label(_incident?['status'] as String?)),
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: ReportStatusUi.isResolvedOrClosed(
                                                _incident?['status'] as String?)
                                            ? const Color(0xFF166534)
                                            : const Color(0xFF1E40AF),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 24),
                              ],
                            ),
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
    final status = _status;
    final isResolved = ReportStatusUi.isResolved(status);
    final isClosed = ReportStatusUi.isClosed(status);
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
            isClosed
                ? 'Incident Closed'
                : (isResolved ? 'Successfully Resolved' : ReportStatusUi.label(status)),
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: ReportStatusUi.badgeText(status),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isClosed
                ? 'Incident is fully closed after your confirmation.'
                : (isResolved
                ? 'Incident is resolved and waiting for reporter confirmation.'
                : 'Status is synced from the latest report record.'),
            style: TextStyle(
              fontSize: 13,
              color: ReportStatusUi.badgeText(status),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResponderActions() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _showResponderUnavailableMessage,
            icon: const Icon(Icons.phone, size: 22),
            label: const Text('Call Responder'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _showResponderUnavailableMessage,
            icon: const Icon(Icons.message_outlined, size: 22),
            label: const Text('Send Info'),
          ),
        ),
      ],
    );
  }

  void _showResponderUnavailableMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
            'Responder contact details are not available for this incident yet.'),
      ),
    );
  }

  void _openNotifications() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (ctx) => Scaffold(
          backgroundColor: Theme.of(ctx).scaffoldBackgroundColor,
          body: Column(
            children: [
              GradientHeader(
                title: 'Notifications',
                onBack: () => Navigator.of(ctx).pop(),
                transparentFade: true,
              ),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: NotificationsScreen(
                    onNotificationTap: (reportId) {
                      Navigator.of(ctx).pop();
                      if (reportId != null) {
                        widget.onReportTap?.call(reportId);
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).then((_) => _fetchUnreadCount());
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
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: isInProgress
                        ? const Color(0xFFEF4444)
                        : Theme.of(context).colorScheme.onSurfaceVariant,
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

  Widget _collapsibleCard({
    required String key,
    required String title,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    final isExpanded = _expandedSections.contains(key);
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedSections.remove(key);
                } else {
                  _expandedSections.add(key);
                }
              });
            },
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(icon, color: iconColor, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            const SizedBox(height: 14),
            child,
          ],
        ],
      ),
    );
  }

  Widget _buildTimelineCardContent() {
    final timeline = ReportStatusUi.timeline(
      status: _incident?['status'] as String?,
      hasAiClassification: _aiClassification != null,
      createdAt: _incident?['created_at'] as String?,
      updatedAt: _incident?['updated_at'] as String?,
      closedAt: _incident?['closed_at'] as String?,
      estimatedEtaMinutes: _estimatedEtaMinutes,
      estimatedArrivalAt: _incident?['estimated_arrival_at'] as String?,
    );
    return Column(
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
    );
  }

  Widget _buildResponderAvailabilityCardContent() {
    final department = assignedDepartmentDisplayName(_incident);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _simpleRow('Department', department),
        const SizedBox(height: 8),
        _simpleRow('Estimated Arrival', _estimatedEtaMinutes != null ? '$_estimatedEtaMinutes min' : 'Pending'),
        const SizedBox(height: 8),
        _simpleRow('ETA Clock', _estimatedEtaMinutes != null ? _estimatedArrivalLabel : 'Pending'),
      ],
    );
  }

  Widget _buildResponderLocationCardContent() {
    final latRaw = _incident?['latitude'];
    final lngRaw = _incident?['longitude'];
    final lat = latRaw is num ? latRaw.toDouble() : null;
    final lng = lngRaw is num ? lngRaw.toDouble() : null;
    final hasCoords = lat != null && lng != null &&
        !lat.isNaN && !lng.isNaN;

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 192,
        child: hasCoords
            ? FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng(lat, lng),
                  initialZoom: 14,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.rescuelink.mobile',
                    subdomains: const ['a', 'b', 'c'],
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(lat, lng),
                        width: 40,
                        height: 40,
                        child: const Icon(
                          Icons.location_on,
                          color: Color(0xFFEF4444),
                          size: 40,
                        ),
                      ),
                    ],
                  ),
                ],
              )
            : Container(
                color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.map_outlined,
                        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                        size: 48,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Location not available',
                        style: TextStyle(
                          fontSize: 14,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildVoiceRecordingCardContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _simpleRow(
          'Audio File',
          safeString(_incident?['audio_path']) != null
              ? 'Available'
              : 'Not available',
        ),
        if (_incident?['transcription'] != null ||
            _aiClassification?['transcription'] != null) ...[
          const SizedBox(height: 10),
          Text(
            'Transcription',
            style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 4),
          Text(
            _incident?['transcription'] as String? ??
                _aiClassification?['transcription'] as String? ??
                '',
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
        const SizedBox(height: 10),
        if (safeString(_incident?['audio_path']) != null)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _preparingAudio ? null : _toggleAudioPlayback,
                      icon: _preparingAudio
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(_playingAudio ? Icons.pause : Icons.play_arrow),
                      label: Text(_preparingAudio
                          ? 'Preparing...'
                          : _playingAudio
                              ? 'Pause Audio'
                              : 'Play Audio'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _downloadingAudio ? null : _downloadAudio,
                      icon: _downloadingAudio
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.download),
                      label: Text(_downloadingAudio
                          ? 'Downloading...'
                          : 'Download'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: _audioDuration.inMilliseconds > 0
                    ? _audioPosition.inMilliseconds /
                        _audioDuration.inMilliseconds
                    : 0,
                minHeight: 6,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerHighest,
              ),
              const SizedBox(height: 6),
              Text(
                '${_formatDuration(_audioPosition)} / ${_formatDuration(_audioDuration)}',
                style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          )
        else
          Text(
            'No audio file is available for this incident.',
            style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
      ],
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
                style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _simpleRow(String label, String value) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface),
          ),
        ),
      ],
    );
  }
}
