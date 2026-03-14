import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import '../../services/auth_service.dart';
import '../../services/incident_service.dart';

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
  String? _locationError;
  bool _locationLoading = false;
  bool _isRecording = false;
  List<int>? _audioBytes;
  final List<({List<int> bytes, String filename})> _mediaFiles = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchLocation();
  }

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _fetchLocation() async {
    if (_currentLat != null && _currentLng != null) return;
    setState(() {
      _locationLoading = true;
      _locationError = null;
    });
    try {
      final result = await AuthService().getCurrentLocation();
      if (!mounted) return;
      setState(() {
        _locationLoading = false;
        if (result['success'] == true) {
          _currentLat = (result['latitude'] as num).toDouble();
          _currentLng = (result['longitude'] as num).toDouble();
          _locationError = null;
        } else {
          _locationError =
              result['error'] as String? ?? 'Could not get location.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locationLoading = false;
        _locationError = e.toString();
      });
    }
  }

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      try {
        final path = await _recorder.stop();
        if (path != null && mounted) {
          final file = File(path);
          final bytes = await file.readAsBytes();
          setState(() {
            _audioBytes = bytes;
            _isRecording = false;
          });
        } else {
          setState(() => _isRecording = false);
        }
      } catch (e) {
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
          setState(() {
            _isRecording = true;
            _audioBytes = null;
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
      final ext = xfile.path.split('.').last.toLowerCase();
      final filename =
          'photo_${DateTime.now().millisecondsSinceEpoch}.${ext == 'jpg' || ext == 'jpeg' ? 'jpg' : 'png'}';
      setState(() => _mediaFiles.add((bytes: bytes, filename: filename)));
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

  Future<void> _pickVideo() async {
    try {
      final picker = ImagePicker();
      final xfile = await picker.pickVideo(source: ImageSource.camera);
      if (xfile == null || !mounted) return;
      final bytes = await xfile.readAsBytes();
      final ext = xfile.path.split('.').last.toLowerCase();
      final filename =
          'video_${DateTime.now().millisecondsSinceEpoch}.${ext == 'mov' ? 'mov' : 'mp4'}';
      setState(() => _mediaFiles.add((bytes: bytes, filename: filename)));
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

    if (_audioBytes == null || _audioBytes!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please record audio before submitting.'),
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
        mediaFiles: _mediaFiles.isEmpty ? null : _mediaFiles,
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
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // Red header bar
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEF4444),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: _isSubmitting ? null : widget.onBack,
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
                              'Emergency Report',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Choose the type that best matches your situation.',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.95),
                                fontSize: 12,
                              ),
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
                        errorBuilder: (_, __, ___) => const Icon(Icons.shield,
                            color: Colors.white, size: 28),
                      ),
                    ],
                  ),
                ),
                // Scrollable content
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Voice Recording card
                        Container(
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
                                    const Text(
                                      'Recording...',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFEF4444),
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ] else if (_audioBytes != null) ...[
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
                                    color: const Color(0xFFEF4444),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Column(
                                    children: [
                                      const Icon(Icons.mic,
                                          color: Colors.white, size: 48),
                                      const SizedBox(height: 12),
                                      Text(
                                        _isRecording
                                            ? 'Tap to Stop Recording'
                                            : (_audioBytes != null
                                                ? 'Tap to Re-record'
                                                : 'Tap to Start Recording'),
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        'Audio is required for AI classification',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.white70),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        _sectionTitle(
                            icon: Icons.location_on,
                            iconColor: const Color(0xFF0EA5E9),
                            title: 'Location'),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 20),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.location_on,
                                  color: Color(0xFF0EA5E9), size: 40),
                              const SizedBox(height: 12),
                              if (_locationLoading)
                                const Text(
                                  'Getting location...',
                                  style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF374151)),
                                )
                              else if (_locationError != null)
                                Text(
                                  _locationError!,
                                  style: const TextStyle(
                                      fontSize: 13, color: Color(0xFFDC2626)),
                                  textAlign: TextAlign.center,
                                )
                              else ...[
                                const Text(
                                  'GPS Location Captured',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF374151),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _currentLat != null && _currentLng != null
                                      ? '${_currentLat!.toStringAsFixed(5)}, ${_currentLng!.toStringAsFixed(5)}'
                                      : 'Dagupan City',
                                  style: const TextStyle(
                                      fontSize: 13, color: Color(0xFF6B7280)),
                                ),
                                const SizedBox(height: 10),
                                const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.check_circle,
                                        color: Color(0xFF22C55E), size: 18),
                                    SizedBox(width: 6),
                                    Text(
                                      'Accuracy: High',
                                      style: TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFF22C55E),
                                          fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Additional Details (Optional)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF374151),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _detailsController,
                          maxLines: 4,
                          enabled: !_isSubmitting,
                          decoration: InputDecoration(
                            hintText: 'Describe the emergency situation..',
                            hintStyle: const TextStyle(
                                color: Color(0xFF9CA3AF), fontSize: 14),
                            filled: true,
                            fillColor: const Color(0xFFF3F4F6),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Attach Media (Optional)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF374151),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: _isSubmitting ? null : _pickPhoto,
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 20),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color: const Color(0xFF86EFAC)),
                                  ),
                                  child: Column(
                                    children: [
                                      Icon(Icons.camera_alt,
                                          size: 28,
                                          color: _mediaFiles.isNotEmpty
                                              ? const Color(0xFF22C55E)
                                              : const Color(0xFF16A34A)),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Photo (${_mediaFiles.length})',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: _mediaFiles.isNotEmpty
                                              ? const Color(0xFF22C55E)
                                              : const Color(0xFF166534),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Icon(Icons.add_circle_outline,
                                          size: 20,
                                          color: _mediaFiles.isNotEmpty
                                              ? const Color(0xFF22C55E)
                                              : const Color(0xFF86EFAC)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: InkWell(
                                onTap: _isSubmitting ? null : _pickVideo,
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 20),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color: const Color(0xFF86EFAC)),
                                  ),
                                  child: const Column(
                                    children: [
                                      Icon(Icons.videocam,
                                          size: 28, color: Color(0xFF16A34A)),
                                      SizedBox(height: 8),
                                      Text(
                                        'Video',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF166534),
                                        ),
                                      ),
                                      SizedBox(height: 6),
                                      Icon(Icons.add_circle_outline,
                                          size: 20, color: Color(0xFF86EFAC)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
                // Bottom submit button
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                  decoration: BoxDecoration(
                    color: Colors.white,
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
                      onPressed: _isSubmitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
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
                          : const Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Submit Emergency Report',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'AI will verify and dispatch immediately',
                                  style: TextStyle(
                                      color: Colors.white70, fontSize: 12),
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
                      CircularProgressIndicator(),
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

  Widget _sectionTitle(
      {required IconData icon,
      required Color iconColor,
      required String title}) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 22),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: Color(0xFF374151),
          ),
        ),
      ],
    );
  }
}
