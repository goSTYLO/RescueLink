import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../services/responder_service.dart';
import '../../services/incident_service.dart';
import '../../services/websocket_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/animated_collapse.dart';
import '../../widgets/glass_card.dart';

/// Full-detail screen opened after a responder accepts an incident.
/// Shows map, status tracker, and action buttons.
class ResponderIncidentDetailScreen extends StatefulWidget {
  final int reportId;
  final bool readOnly;
  final Map<String, dynamic>? initialIncident;
  final bool isBackupHelper;
  final int? backupRequestId;

  const ResponderIncidentDetailScreen({
    super.key,
    required this.reportId,
    this.readOnly = false,
    this.initialIncident,
    this.isBackupHelper = false,
    this.backupRequestId,
  });

  @override
  State<ResponderIncidentDetailScreen> createState() =>
      _ResponderIncidentDetailScreenState();
}

class _ResponderIncidentDetailScreenState
    extends State<ResponderIncidentDetailScreen> {
  final ResponderService _service = ResponderService();
  final IncidentService _incidentService = IncidentService();

  bool _loading = true;
  Map<String, dynamic>? _incident;
  String? _error;
  bool _submitting = false;
  final Set<String> _expandedSections = {'map', 'progress', 'info'};

  StreamSubscription<IncidentEvent>? _wsSub;

  static const _statuses = ['Assigned', 'En Route', 'On Scene', 'Resolved'];
  static const _nextStatus = {
    'Assigned': 'En Route',
    'En Route': 'On Scene',
    'On Scene': 'Resolved',
  };
  static const _nextStatusLabels = {
    'En Route': 'Mark En Route (OTW)',
    'On Scene': 'Mark On Scene',
    'Resolved': 'Mark Resolved',
  };

  bool get _isBackupHelper =>
      widget.isBackupHelper || _incident?['is_backup_assignment'] == true;

  int? get _backupRequestId =>
      widget.backupRequestId ?? parseInt(_incident?['backup_request_id']);

  @override
  void initState() {
    super.initState();
    if (widget.initialIncident != null) {
      _incident = Map<String, dynamic>.from(widget.initialIncident!);
      _loading = false;
    }
    _loadIncident();
    _wsSub = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      if (event.event == 'application:status_changed' &&
          event.data['status']?.toString().toLowerCase() == 'revoked') {
        Navigator.of(context).pop();
        return;
      }
      final rid = parseInt(event.reportId ?? event.data['report_id']);
      if (rid != widget.reportId) return;
      const refreshEvents = {
        'responder:status_changed',
        'responder:backup_requested',
        'responder:backup_acknowledged',
        'responder:backup_joined',
        'responder:backup_declined',
        'responder:backup_status_changed',
        'responder:backup_withdrawn',
        'incident:status_updated',
        'incident:dispatched',
      };
      if (refreshEvents.contains(event.event)) {
        _loadIncident();
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _service.close();
    _incidentService.close();
    super.dispose();
  }

  Future<void> _loadIncident() async {
    final showSpinner = _incident == null;
    if (showSpinner) {
      setState(() { _loading = true; _error = null; });
    }
    try {
      try {
        final detail = await _incidentService.getIncidentById(widget.reportId);
        if (mounted) {
          setState(() {
            _incident = detail;
            _loading = false;
            _error = null;
          });
        }
        return;
      } on IncidentServiceException {
        // Fall back to active/history list when direct GET is unavailable.
      }

      final list = await _service.getActiveIncidents();
      final found = list
          .where((i) => parseInt(i['report_id']) == widget.reportId)
          .toList();
      if (found.isEmpty && !widget.readOnly) {
        final hist = await _service.getIncidentHistory();
        final hFound = hist
            .where((i) => parseInt(i['report_id']) == widget.reportId)
            .toList();
        if (hFound.isNotEmpty) {
          if (mounted) setState(() { _incident = hFound.first; _loading = false; });
          return;
        }
      }
      if (mounted) {
        setState(() {
          if (found.isNotEmpty) _incident = found.first;
          _loading = false;
          if (found.isEmpty && _incident == null) {
            _error = 'Incident not found in your active assignments.';
          }
        });
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        setState(() {
          if (_incident == null) _error = e.message;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          if (_incident == null) _error = 'Failed to load incident.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _submitting = true);
    try {
      if (_isBackupHelper) {
        final backupId = _backupRequestId;
        if (backupId == null) {
          throw ResponderServiceException('Backup assignment id missing.');
        }
        await _service.updateBackupResponderStatus(widget.reportId, backupId, newStatus);
      } else {
        await _service.updateResponderStatus(widget.reportId, newStatus);
      }
      if (mounted) {
        setState(() {
          _incident = {
            if (_incident != null) ..._incident!,
            'responder_status': newStatus,
          };
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to $newStatus'), backgroundColor: const Color(0xFF10B981), closeIconColor: Colors.white),
        );
        if (newStatus == 'Resolved') {
          await Future<void>.delayed(const Duration(milliseconds: 600));
          if (mounted) Navigator.of(context).pop();
          return;
        }
        await _loadIncident();
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: const Color(0xFFEF4444), closeIconColor: Colors.white),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _requestBackup() async {
    String selected = 'cdrrmo';
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Backup'),
        content: StatefulBuilder(
          builder: (ctx, setDlg) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioGroup<String>(
                groupValue: selected,
                onChanged: (v) => setDlg(() => selected = v!),
                child: const Column(
                  children: [
                    RadioListTile<String>(
                      title: Text('CDRRMO'),
                      value: 'cdrrmo',
                    ),
                    RadioListTile<String>(
                      title: Text('Nearby Responders'),
                      value: 'nearby_responders',
                    ),
                    RadioListTile<String>(
                      title: Text('Both'),
                      value: 'both',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await _service.requestBackup(widget.reportId, selected, notes: controller.text.trim());
        if (mounted) {
          setState(() {
            _incident = {
              if (_incident != null) ..._incident!,
              'has_pending_backup': true,
              'latest_backup_status': 'pending',
            };
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Backup request sent.'), backgroundColor: Color(0xFF10B981), closeIconColor: Colors.white),
          );
          await _loadIncident();
        }
      } on ResponderServiceException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message), backgroundColor: const Color(0xFFEF4444), closeIconColor: Colors.white),
          );
        }
      }
    }
  }

  Color _stepColor(int index, int currentIndex) {
    if (index < currentIndex) return const Color(0xFF10B981);
    if (index == currentIndex) return const Color(0xFFEF4444);
    return const Color(0xFFCBD5E1);
  }

  Widget _buildBackupStatusChip({
    required String label,
    required IconData icon,
    required Color backgroundColor,
    required Color borderColor,
    required Color textColor,
    String? subtitle,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                ),
                if (subtitle != null && subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: textColor.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
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
          _isBackupHelper
              ? 'Backup #DGP-${widget.reportId}'
              : 'Incident #DGP-${widget.reportId}',
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
                        TextButton(onPressed: _loadIncident, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _incident == null
                  ? Center(child: Text('Incident not found.', style: TextStyle(color: textSec)))
                  : _buildContent(textPrimary, textSec),
    );
  }

  Widget _buildContent(Color textPrimary, Color textSec) {
    final inc = _incident!;
    final lat = parseDouble(inc['latitude']);
    final lon = parseDouble(inc['longitude']);
    final currentStatus = (inc['responder_status'] as String?) ?? 'Assigned';
    final currentIndex = _statuses.indexOf(currentStatus).clamp(0, _statuses.length - 1);
    final next = _nextStatus[currentStatus];
    final nextLabel = next != null ? (_nextStatusLabels[next] ?? 'Update to $next') : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (lat != null && lon != null) ...[
            _collapsibleCard(
              key: 'map',
              title: 'Incident Location',
              icon: Icons.map_outlined,
              iconColor: const Color(0xFF22C55E),
              textPrimary: textPrimary,
              textSec: textSec,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 220,
                  child: FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(lat, lon),
                      initialZoom: 15,
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
                            width: 40,
                            height: 40,
                            child: const Icon(Icons.location_pin, color: Color(0xFFEF4444), size: 40),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          _collapsibleCard(
            key: 'progress',
            title: 'Response Progress',
            icon: Icons.timeline,
            iconColor: const Color(0xFFEF4444),
            textPrimary: textPrimary,
            textSec: textSec,
            child: Row(
              children: List.generate(_statuses.length * 2 - 1, (i) {
                if (i.isOdd) {
                  final stepIndex = (i - 1) ~/ 2;
                  return Expanded(
                    child: Container(
                      height: 2,
                      color: stepIndex < currentIndex
                          ? const Color(0xFF10B981)
                          : const Color(0xFFCBD5E1),
                    ),
                  );
                }
                final stepIndex = i ~/ 2;
                final color = _stepColor(stepIndex, currentIndex);
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      child: stepIndex < currentIndex
                          ? const Icon(Icons.check, color: Colors.white, size: 14)
                          : stepIndex == currentIndex
                              ? const Icon(Icons.circle, color: Colors.white, size: 8)
                              : null,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _statuses[stepIndex],
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: stepIndex == currentIndex ? FontWeight.bold : FontWeight.normal,
                        color: color,
                      ),
                    ),
                  ],
                );
              }),
            ),
          ),
          const SizedBox(height: 16),

          _collapsibleCard(
            key: 'info',
            title: 'Incident Details',
            icon: Icons.info_outline,
            iconColor: const Color(0xFF2563EB),
            textPrimary: textPrimary,
            textSec: textSec,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _infoRowWidget(
                  'Type',
                  incidentTypeChips(incident: inc),
                ),
                _infoRow('Barangay', inc['barangay']?.toString()),
                _infoRow('Severity', _capitalize(inc['severity_level']?.toString())),
                if ((inc['description'] as String?)?.isNotEmpty == true)
                  _infoRow('Description', inc['description'].toString()),
              ],
            ),
          ),
          const SizedBox(height: 20),

          if (_isBackupHelper)
            _buildBackupStatusChip(
              label: 'You joined as backup volunteer',
              icon: Icons.groups_outlined,
              backgroundColor: const Color(0xFFE0E7FF),
              borderColor: const Color(0xFF6366F1),
              textColor: const Color(0xFF4338CA),
            )
          else if (BackupStatusUi.hasPendingBackup(inc))
            _buildBackupStatusChip(
              label: 'Backup requested',
              icon: Icons.shield_outlined,
              backgroundColor: const Color(0xFFFEF3C7),
              borderColor: const Color(0xFFF59E0B),
              textColor: const Color(0xFFB45309),
            )
          else if (BackupStatusUi.hasBackupUnitDispatched(inc))
            _buildBackupStatusChip(
              label: 'Backup unit dispatched',
              subtitle: BackupStatusUi.assignedBackupTeamLabel(inc),
              icon: Icons.local_shipping_outlined,
              backgroundColor: const Color(0xFFDBEAFE),
              borderColor: const Color(0xFF2563EB),
              textColor: const Color(0xFF1D4ED8),
            )
          else if (BackupStatusUi.isBackupAcknowledged(inc))
            _buildBackupStatusChip(
              label: 'Backup acknowledged',
              icon: Icons.check_circle_outline,
              backgroundColor: const Color(0xFFD1FAE5),
              borderColor: const Color(0xFF10B981),
              textColor: const Color(0xFF047857),
            ),
          if (_isBackupHelper ||
              BackupStatusUi.hasPendingBackup(inc) ||
              BackupStatusUi.isBackupAcknowledged(inc) ||
              BackupStatusUi.hasBackupUnitDispatched(inc))
            const SizedBox(height: 12),

          if (!_isBackupHelper && BackupStatusUi.hasJoinedBackupVolunteers(inc)) ...[
            _collapsibleCard(
              key: 'backup_volunteers',
              title: 'Backup volunteers',
              icon: Icons.groups_outlined,
              iconColor: const Color(0xFF6366F1),
              textPrimary: textPrimary,
              textSec: textSec,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: BackupStatusUi.joinedBackupVolunteers(inc).map((vol) {
                  final name = (vol['name'] as String?)?.trim().isNotEmpty == true
                      ? vol['name'].toString()
                      : 'Volunteer';
                  final status = (vol['responder_status'] as String?) ?? 'Assigned';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        const Icon(Icons.person_outline, size: 18, color: Color(0xFF6366F1)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(name, style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600))),
                        Text(status, style: TextStyle(color: textSec, fontSize: 12)),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Actions
          if (!widget.readOnly) ...[
            if (next != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : () => _updateStatus(next),
                  icon: _submitting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.arrow_forward_rounded),
                  label: Text(nextLabel!, style: const TextStyle(fontWeight: FontWeight.bold)),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            const SizedBox(height: 10),
            if (!_isBackupHelper && currentStatus != 'Resolved' && !BackupStatusUi.hasPendingBackup(inc))
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _submitting ? null : _requestBackup,
                  icon: const Icon(Icons.shield_rounded),
                  label: const Text('Request Backup', style: TextStyle(fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFF59E0B),
                    side: const BorderSide(color: Color(0xFFF59E0B)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _collapsibleCard({
    required String key,
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color textPrimary,
    required Color textSec,
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
                        color: textPrimary,
                      ),
                    ),
                  ),
                  AnimatedExpandIcon(
                    expanded: isExpanded,
                    color: textSec,
                  ),
                ],
              ),
            ),
          ),
          AnimatedCollapse(
            expanded: isExpanded,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 14),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRowWidget(String label, Widget value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF6B7280))),
          ),
          Expanded(child: value),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF6B7280))),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  String _capitalize(String? s) {
    if (s == null || s.isEmpty) return '';
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
  }
}
