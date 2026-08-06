import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../services/responder_service.dart';
import '../../widgets/glass_card.dart';

/// Full-detail screen opened after a responder accepts an incident.
/// Shows map, status tracker, and action buttons.
class ResponderIncidentDetailScreen extends StatefulWidget {
  final int reportId;
  final bool readOnly;

  const ResponderIncidentDetailScreen({
    super.key,
    required this.reportId,
    this.readOnly = false,
  });

  @override
  State<ResponderIncidentDetailScreen> createState() =>
      _ResponderIncidentDetailScreenState();
}

class _ResponderIncidentDetailScreenState
    extends State<ResponderIncidentDetailScreen> {
  final ResponderService _service = ResponderService();

  bool _loading = true;
  Map<String, dynamic>? _incident;
  String? _error;
  bool _submitting = false;

  static const _statuses = ['Assigned', 'En Route', 'On Scene', 'Resolved'];
  static const _nextStatus = {
    'Assigned': 'En Route',
    'En Route': 'On Scene',
    'On Scene': 'Resolved',
  };

  @override
  void initState() {
    super.initState();
    _loadIncident();
  }

  @override
  void dispose() {
    _service.close();
    super.dispose();
  }

  Future<void> _loadIncident() async {
    setState(() { _loading = true; _error = null; });
    try {
      // We fetch the responder's active list and find this report
      final list = await _service.getActiveIncidents();
      final found = list.where((i) => (i['report_id'] as num?)?.toInt() == widget.reportId).toList();
      if (found.isEmpty && !widget.readOnly) {
        // Check history for read-only view
        final hist = await _service.getIncidentHistory();
        final hFound = hist.where((i) => (i['report_id'] as num?)?.toInt() == widget.reportId).toList();
        if (hFound.isNotEmpty) {
          setState(() { _incident = hFound.first; _loading = false; });
          return;
        }
      }
      setState(() {
        _incident = found.isNotEmpty ? found.first : null;
        _loading = false;
      });
    } on ResponderServiceException catch (e) {
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'Failed to load incident.'; _loading = false; });
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _submitting = true);
    try {
      await _service.updateResponderStatus(widget.reportId, newStatus);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to $newStatus'), backgroundColor: const Color(0xFF10B981)),
        );
        await _loadIncident();
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: const Color(0xFFEF4444)),
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
              RadioListTile<String>(
                title: const Text('CDRRMO'),
                value: 'cdrrmo',
                groupValue: selected,
                onChanged: (v) => setDlg(() => selected = v!),
              ),
              RadioListTile<String>(
                title: const Text('Nearby Responders'),
                value: 'nearby_responders',
                groupValue: selected,
                onChanged: (v) => setDlg(() => selected = v!),
              ),
              RadioListTile<String>(
                title: const Text('Both'),
                value: 'both',
                groupValue: selected,
                onChanged: (v) => setDlg(() => selected = v!),
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
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Backup request sent.'), backgroundColor: Color(0xFF10B981)),
          );
        }
      } on ResponderServiceException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.message), backgroundColor: const Color(0xFFEF4444)),
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
        title: Text('Incident #DGP-${widget.reportId}',
            style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold)),
        iconTheme: IconThemeData(color: textPrimary),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444)))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))))
              : _incident == null
                  ? Center(child: Text('Incident not found.', style: TextStyle(color: textSec)))
                  : _buildContent(textPrimary, textSec),
    );
  }

  Widget _buildContent(Color textPrimary, Color textSec) {
    final inc = _incident!;
    final lat = (inc['latitude'] as num?)?.toDouble();
    final lon = (inc['longitude'] as num?)?.toDouble();
    final currentStatus = (inc['responder_status'] as String?) ?? 'Assigned';
    final currentIndex = _statuses.indexOf(currentStatus).clamp(0, _statuses.length - 1);
    final next = _nextStatus[currentStatus];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Map
          if (lat != null && lon != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
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
          const SizedBox(height: 20),

          // Status stepper
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Response Progress',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                Row(
                  children: List.generate(_statuses.length * 2 - 1, (i) {
                    if (i.isOdd) {
                      // Connector line
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
                        Text(_statuses[stepIndex],
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: stepIndex == currentIndex ? FontWeight.bold : FontWeight.normal,
                                color: color)),
                      ],
                    );
                  }),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Info
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _infoRow('Type', _capitalize(inc['incident_type']?.toString())),
                _infoRow('Barangay', inc['barangay']?.toString()),
                _infoRow('Severity', _capitalize(inc['severity_level']?.toString())),
                if ((inc['description'] as String?)?.isNotEmpty == true)
                  _infoRow('Description', inc['description'].toString()),
              ],
            ),
          ),
          const SizedBox(height: 20),

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
                  label: Text('Update to $next', style: const TextStyle(fontWeight: FontWeight.bold)),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            const SizedBox(height: 10),
            if (currentStatus != 'Resolved')
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
