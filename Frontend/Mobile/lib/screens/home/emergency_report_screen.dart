import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';
import '../../services/auth_service.dart';
import '../../services/incident_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/animated_collapse.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gradient_header.dart';
import '../../widgets/skeleton_placeholder.dart';

class EmergencyReportScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final void Function(Map<String, dynamic> incident)? onSubmit;

  const EmergencyReportScreen({
    super.key,
    this.onBack,
    this.onSubmit,
  });

  @override
  State<EmergencyReportScreen> createState() => _EmergencyReportScreenState();
}

class _EmergencyReportScreenState extends State<EmergencyReportScreen> {
  final _detailsController = TextEditingController();
  final AudioRecorder _recorder = AudioRecorder();

  double? _currentLat;
  double? _currentLng;
  String? _barangay;
  String? _locationError;
  bool _locationLoading = false;
  bool _additionalDetailsExpanded = false;
  static const int _minAudioDurationSeconds = 5;

  bool _isRecording = false;
  DateTime? _recordingStartedAt;
  Timer? _recordingTimer;
  int _recordingElapsedSeconds = 0;
  double? _recordedDurationSeconds;
  bool _audioTooShort = false;
  List<int>? _audioBytes;
  ({List<int> bytes, String filename})? _photoFile;
  ({List<int> bytes, String filename})? _videoFile;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchLocation();
  }

  @override
  void dispose() {
    _recordingTimer?.cancel();
    _recorder.dispose();
    _detailsController.dispose();
    super.dispose();
  }

  void _stopRecordingTimer() {
    _recordingTimer?.cancel();
    _recordingTimer = null;
    _recordingStartedAt = null;
    _recordingElapsedSeconds = 0;
  }

  void _startRecordingTimer() {
    _stopRecordingTimer();
    _recordingStartedAt = DateTime.now();
    _recordingElapsedSeconds = 0;
    _recordingTimer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted || _recordingStartedAt == null) return;
      setState(() {
        _recordingElapsedSeconds =
            DateTime.now().difference(_recordingStartedAt!).inSeconds;
      });
    });
  }

  Future<void> _fetchLocation() async {
    if (_currentLat != null && _currentLng != null) return;
    setState(() {
      _locationLoading = true;
      _locationError = null;
      _barangay = null;
    });
    try {
      final result = await AuthService().getCurrentLocation();
      if (!mounted) return;
      if (result['success'] == true) {
        final lat = (result['latitude'] as num).toDouble();
        final lng = (result['longitude'] as num).toDouble();
        final barangay = await AuthService().getBarangayFromCoordinates(lat, lng);
        if (!mounted) return;
        setState(() {
          _currentLat = lat;
          _currentLng = lng;
          _barangay = barangay;
          _locationLoading = false;
          _locationError = null;
        });
      } else {
        setState(() {
          _locationLoading = false;
          _locationError = result['error'] as String? ?? 'Could not get location.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locationLoading = false;
        _locationError = e.toString();
      });
    }
  }

  bool get _hasValidRecording =>
      _audioBytes != null &&
      _audioBytes!.isNotEmpty &&
      (_recordedDurationSeconds ?? 0) >= _minAudioDurationSeconds;

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      final elapsedSeconds = _recordingStartedAt == null
          ? 0.0
          : DateTime.now().difference(_recordingStartedAt!).inMilliseconds /
              1000.0;

      try {
        final path = await _recorder.stop();
        _stopRecordingTimer();
        if (path != null && mounted) {
          if (elapsedSeconds < _minAudioDurationSeconds) {
            try {
              await File(path).delete();
            } catch (_) {}
            setState(() {
              _isRecording = false;
              _audioBytes = null;
              _recordedDurationSeconds = elapsedSeconds;
              _audioTooShort = true;
            });
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Recording too short (${elapsedSeconds.toStringAsFixed(1)}s). '
                  'Please try again — at least $_minAudioDurationSeconds seconds required.',
                ),
                backgroundColor: Colors.red,
                action: SnackBarAction(
                  label: 'Try again',
                  textColor: Colors.white,
                  onPressed: _toggleRecording,
                ),
              ),
            );
          } else {
            final file = File(path);
            final bytes = await file.readAsBytes();
            setState(() {
              _audioBytes = bytes;
              _recordedDurationSeconds = elapsedSeconds;
              _audioTooShort = false;
              _isRecording = false;
            });
          }
        } else {
          setState(() => _isRecording = false);
        }
      } catch (e) {
        _stopRecordingTimer();
        if (mounted) setState(() => _isRecording = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Recording error: $e'),
                backgroundColor: Colors.red),
          );
        }
      }
    } else {
      try {
        if (await _recorder.hasPermission()) {
          final dir = await getTemporaryDirectory();
          final path =
              '${dir.path}/recording_${DateTime.now().millisecondsSinceEpoch}.wav';
          await _recorder.start(
              const RecordConfig(encoder: AudioEncoder.wav, sampleRate: 44100),
              path: path);
          _startRecordingTimer();
          setState(() {
            _isRecording = true;
            _audioBytes = null;
            _recordedDurationSeconds = null;
            _audioTooShort = false;
          });
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text('Microphone permission is required.'),
                  backgroundColor: Colors.red),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Could not start recording: $e'),
                backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final xfile = await picker.pickImage(source: ImageSource.camera);
      if (xfile == null || !mounted) return;
      final bytes = await xfile.readAsBytes();
      final pathExt = xfile.path.split('.').last.toLowerCase();
      final ext = (pathExt == 'jpg' || pathExt == 'jpeg' || pathExt == 'png')
          ? (pathExt == 'png' ? 'png' : 'jpg')
          : 'jpg';
      final filename = 'photo_${DateTime.now().millisecondsSinceEpoch}.$ext';
      setState(() => _photoFile = (bytes: bytes, filename: filename));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Could not pick photo: $e'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  static const int _maxVideoDurationSeconds = 10;

  Future<void> _pickVideo() async {
    try {
      final picker = ImagePicker();
      final xfile = await picker.pickVideo(source: ImageSource.camera);
      if (xfile == null || !mounted) return;

      final file = File(xfile.path);
      final controller = VideoPlayerController.file(file);
      await controller.initialize();
      final duration = controller.value.duration;
      await controller.dispose();

      if (!mounted) return;
      if (duration.inSeconds > _maxVideoDurationSeconds) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Video must be 10 seconds or less.'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      final bytes = await xfile.readAsBytes();
      final pathExt = xfile.path.split('.').last.toLowerCase();
      final ext = (pathExt == 'mov' || pathExt == 'avi') ? pathExt : 'mp4';
      final filename = 'video_${DateTime.now().millisecondsSinceEpoch}.$ext';
      setState(() => _videoFile = (bytes: bytes, filename: filename));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Could not pick video: $e'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  List<({List<int> bytes, String filename})>? _buildMediaFilesList() {
    final list = <({List<int> bytes, String filename})>[];
    if (_photoFile != null) list.add(_photoFile!);
    if (_videoFile != null) list.add(_videoFile!);
    return list.isEmpty ? null : list;
  }

  Widget _buildMediaAddButton({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: _isSubmitting ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF86EFAC)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 28, color: const Color(0xFF16A34A)),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF166534),
              ),
            ),
            const SizedBox(height: 6),
            const Icon(Icons.add_circle_outline,
                size: 20, color: Color(0xFF86EFAC)),
          ],
        ),
      ),
    );
  }

  Widget _buildDisabledMediaButton({
    required IconData icon,
    required String label,
    required String hint,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Icon(icon, size: 28, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            hint,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade400,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoPreview() {
    final file = _photoFile!;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.memory(
            Uint8List.fromList(file.bytes),
            fit: BoxFit.cover,
            height: 120,
            width: double.infinity,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: IconButton(
            onPressed: _isSubmitting ? null : () => setState(() => _photoFile = null),
            icon: const Icon(Icons.close, color: Colors.white, size: 20),
            style: IconButton.styleFrom(
              backgroundColor: Colors.black54,
              padding: const EdgeInsets.all(4),
              minimumSize: const Size(28, 28),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVideoPreview() {
    final file = _videoFile!;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: 120,
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFF1F2937),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.videocam, color: Colors.white70, size: 40),
                const SizedBox(height: 8),
                Text(
                  file.filename,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Colors.white70,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: IconButton(
            onPressed: _isSubmitting ? null : () => setState(() => _videoFile = null),
            icon: const Icon(Icons.close, color: Colors.white, size: 20),
            style: IconButton.styleFrom(
              backgroundColor: Colors.black54,
              padding: const EdgeInsets.all(4),
              minimumSize: const Size(28, 28),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;

    await _fetchLocation();
    if (!mounted) return;
    if (_currentLat == null || _currentLng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              _locationError ?? 'Location is required. Please enable GPS.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!_hasValidRecording) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _audioTooShort
                ? 'Recording too short. Please try again (minimum $_minAudioDurationSeconds seconds).'
                : 'Please record audio before submitting.',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final response = await IncidentService().reportWithAudio(
        latitude: _currentLat!,
        longitude: _currentLng!,
        description: _detailsController.text.trim().isEmpty
            ? null
            : _detailsController.text.trim(),
        audioBytes: _audioBytes!,
        audioFilename: 'recording.wav',
        mediaFiles: _buildMediaFilesList(),
      );
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      final dynamic rawIncident = response['incident'] ?? response;
      final incident = rawIncident is Map
          ? rawIncident.cast<String, dynamic>()
          : <String, dynamic>{};
      final dupInfo = DuplicateInfo.fromResponse(response);
      if (dupInfo?.shouldShowDialog == true && mounted) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Possible Duplicate Detected'),
            content: Text(
              dupInfo!.isDuplicate
                  ? 'This report was linked to an existing incident (same location/time).'
                  : 'This appears related to an existing incident. Your report was submitted.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
      if (!mounted) return;
      widget.onSubmit?.call(incident);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(e is IncidentServiceException ? e.message : e.toString()),
          backgroundColor: Colors.red,
        ),
      );
    }
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
        body: Stack(
          children: [
            Column(
              children: [
                GradientHeader(
                  title: 'Emergency Report',
                  onBack: _isSubmitting ? null : widget.onBack,
                  transparentFade: true,
                  trailing: Image.asset(
                    'assets/logo/icon.png',
                    width: 64,
                    height: 64,
                    fit: BoxFit.contain,
                    color: Colors.white,
                    colorBlendMode: BlendMode.srcIn,
                    errorBuilder: (_, __, ___) => const Icon(Icons.shield,
                        color: Colors.white, size: 28),
                  ),
                ),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Voice Recording card
                        GlassCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.mic,
                                      color: Color(0xFFEF4444), size: 22),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Voice Recording',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF374151),
                                    ),
                                  ),
                                  const Spacer(),
                                  if (_isRecording) ...[
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFFEF4444),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      _recordingElapsedSeconds <
                                              _minAudioDurationSeconds
                                          ? 'Recording... $_recordingElapsedSeconds / $_minAudioDurationSeconds s'
                                          : 'Recording... ${_recordingElapsedSeconds}s',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFEF4444),
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ] else if (_audioTooShort) ...[
                                    const Icon(Icons.error_outline,
                                        color: Color(0xFFEF4444), size: 20),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Too short (${_recordedDurationSeconds?.toStringAsFixed(1) ?? '0'}s)',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFEF4444),
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ] else if (_hasValidRecording) ...[
                                    const Icon(Icons.check_circle,
                                        color: Color(0xFF22C55E), size: 20),
                                    const SizedBox(width: 6),
                                    const Text(
                                      'Recorded',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFF22C55E),
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 12),
                              InkWell(
                                onTap: _isSubmitting ? null : _toggleRecording,
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20, vertical: 28),
                                  decoration: BoxDecoration(
                                    color: _audioTooShort
                                        ? const Color(0xFFF97316)
                                        : const Color(0xFFEF4444),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Column(
                                    children: [
                                      Icon(
                                        _audioTooShort
                                            ? Icons.replay
                                            : Icons.mic,
                                        color: Colors.white,
                                        size: 48,
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        _isRecording
                                            ? 'Tap to Stop Recording'
                                            : (_audioTooShort
                                                ? 'Tap to Try Again'
                                                : (_hasValidRecording
                                                    ? 'Tap to Re-record'
                                                    : 'Tap to Start Recording')),
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      if (!_isRecording &&
                                          !_hasValidRecording &&
                                          !_audioTooShort)
                                        const Padding(
                                          padding: EdgeInsets.only(top: 8),
                                          child: Text(
                                            'Record at least 5 seconds describing the emergency.',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.white70,
                                            ),
                                            textAlign: TextAlign.center,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                              if (_audioTooShort) ...[
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEE2E2),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: const Color(0xFFEF4444)
                                          .withValues(alpha: 0.35),
                                    ),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.warning_amber_rounded,
                                          color: Color(0xFFEF4444), size: 22),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          'Recording was only '
                                          '${_recordedDurationSeconds?.toStringAsFixed(1) ?? '0'} seconds. '
                                          'Please try again — at least '
                                          '$_minAudioDurationSeconds seconds '
                                          'is required for AI to classify your report.',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFF991B1B),
                                            height: 1.35,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        GlassCard(
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.location_on,
                                      color: theme.colorScheme.primary, size: 22),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Location',
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (!_locationLoading)
                                    IconButton(
                                      icon: const Icon(Icons.refresh),
                                      onPressed: _isSubmitting
                                          ? null
                                          : () {
                                              setState(() {
                                                _currentLat = null;
                                                _currentLng = null;
                                                _barangay = null;
                                              });
                                              _fetchLocation();
                                            },
                                      tooltip: 'Refresh location',
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              if (_locationLoading)
                                const SkeletonPlaceholder(
                                  width: double.infinity,
                                  height: 48,
                                  borderRadius: 8,
                                )
                              else if (_locationError != null)
                                Text(
                                  _locationError!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: theme.colorScheme.error,
                                  ),
                                  textAlign: TextAlign.center,
                                )
                              else ...[
                                Text(
                                  _barangay != null && _barangay!.isNotEmpty
                                      ? _barangay!
                                      : 'Dagupan City',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                if (_currentLat != null && _currentLng != null) ...[
                                  const SizedBox(height: 12),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: SizedBox(
                                      height: 160,
                                      child: FlutterMap(
                                        options: MapOptions(
                                          initialCenter: LatLng(_currentLat!, _currentLng!),
                                          initialZoom: 15,
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
                                                point: LatLng(_currentLat!, _currentLng!),
                                                width: 40,
                                                height: 40,
                                                child: Icon(
                                                  Icons.location_on,
                                                  color: theme.colorScheme.error,
                                                  size: 40,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        GlassCard(
                          onTap: () => setState(() =>
                              _additionalDetailsExpanded = !_additionalDetailsExpanded),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.description,
                                      color: theme.colorScheme.primary, size: 22),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Additional Details (Optional)',
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  AnimatedExpandIcon(
                                    expanded: _additionalDetailsExpanded,
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ],
                              ),
                              AnimatedCollapse(
                                expanded: _additionalDetailsExpanded,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    const SizedBox(height: 12),
                                    TextField(
                                      controller: _detailsController,
                                      maxLines: 4,
                                      enabled: !_isSubmitting,
                                      decoration: InputDecoration(
                                        hintText: 'Describe the emergency situation..',
                                        filled: true,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(12),
                                          borderSide: BorderSide.none,
                                        ),
                                        contentPadding: const EdgeInsets.symmetric(
                                            horizontal: 16, vertical: 14),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Attach Media (Optional)',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Video max 10 seconds. Choose either photo OR video.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: _photoFile != null
                                  ? _buildPhotoPreview()
                                  : _videoFile != null
                                      ? _buildDisabledMediaButton(
                                          icon: Icons.camera_alt,
                                          label: 'Photo',
                                          hint: 'Video already selected',
                                        )
                                      : _buildMediaAddButton(
                                          icon: Icons.camera_alt,
                                          label: 'Photo',
                                          onTap: _pickPhoto,
                                        ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _videoFile != null
                                  ? _buildVideoPreview()
                                  : _photoFile != null
                                      ? _buildDisabledMediaButton(
                                          icon: Icons.videocam,
                                          label: 'Video',
                                          hint: 'Photo already selected',
                                        )
                                      : _buildMediaAddButton(
                                          icon: Icons.videocam,
                                          label: 'Video',
                                          onTap: _pickVideo,
                                        ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                        // Bottom submit button
                        Container(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                          decoration: BoxDecoration(
                            color: isDark ? AppTheme.darkCard : theme.scaffoldBackgroundColor,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 10,
                                offset: const Offset(0, -2),
                              ),
                            ],
                          ),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: (_isSubmitting || !_hasValidRecording)
                                  ? null
                                  : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEF4444),
                                disabledBackgroundColor:
                                    const Color(0xFFEF4444).withValues(alpha: 0.45),
                                disabledForegroundColor: Colors.white70,
                                padding: const EdgeInsets.symmetric(vertical: 18),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                              child: _isSubmitting
                                  ? const SizedBox(
                                      height: 24,
                                      width: 24,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text(
                                      'Submit Emergency Report',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
            if (_isSubmitting)
              Container(
                color: Colors.black26,
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(strokeWidth: 2),
                      SizedBox(height: 16),
                      Text('Submitting...',
                          style: TextStyle(color: Colors.white, fontSize: 16)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

}
