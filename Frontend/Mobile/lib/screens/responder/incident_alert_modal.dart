import 'package:flutter/material.dart';
import '../../services/responder_service.dart';
import '../../utils/report_ui.dart';
import '../../services/websocket_service.dart';

/// Bottom-sheet modal triggered when a `responder:incident_alert` WS event arrives.
/// Shows incident info and Accept / Decline buttons.
class IncidentAlertModal extends StatefulWidget {
  final IncidentEvent event;
  final void Function(int reportId, Map<String, dynamic> initialIncident) onAccepted;
  final VoidCallback onDeclined;
  final VoidCallback? onViewDetails;

  const IncidentAlertModal({
    super.key,
    required this.event,
    required this.onAccepted,
    required this.onDeclined,
    this.onViewDetails,
  });

  @override
  State<IncidentAlertModal> createState() => _IncidentAlertModalState();
}

class _IncidentAlertModalState extends State<IncidentAlertModal> {
  final ResponderService _service = ResponderService();
  bool _loading = false;
  String? _error;

  int? get _reportId {
    final id = widget.event.reportId ?? widget.event.data['report_id'];
    return id is int ? id : (id is num ? id.toInt() : int.tryParse(id?.toString() ?? ''));
  }

  Future<void> _accept() async {
    final reportId = _reportId;
    if (reportId == null) return;
    setState(() { _loading = true; _error = null; });
    try {
      final accepted = await _service.acceptIncident(reportId);
      if (mounted) {
        final initialIncident = <String, dynamic>{
          ...widget.event.data,
          'report_id': reportId,
          'responder_status': accepted['responder_status']?.toString() ?? 'Assigned',
        };
        widget.onAccepted(reportId, initialIncident);
      }
    } on ResponderServiceException catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.message; });
    } finally {
      _service.close();
    }
  }

  Future<void> _decline() async {
    final reportId = _reportId;
    setState(() { _loading = true; });
    try {
      if (reportId != null) await _service.declineIncident(reportId);
    } catch (_) {}
    if (mounted) widget.onDeclined();
  }

  Color _severityColor(String? severity) {
    switch ((severity ?? '').toLowerCase()) {
      case 'critical': return const Color(0xFFEF4444);
      case 'high': return const Color(0xFFF97316);
      case 'medium': return const Color(0xFFF59E0B);
      default: return const Color(0xFF3B82F6);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSec = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final data = widget.event.data;
    final barangay = (data['barangay'] as String?) ?? 'Unknown location';
    final severity = data['severity_level'] as String?;
    final severityLabel = (severity != null && severity.isNotEmpty)
        ? '${severity[0].toUpperCase()}${severity.substring(1).toLowerCase()}'
        : null;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: textSec.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Alert banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.emergency_rounded, color: Color(0xFFEF4444), size: 28),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Incident Alert', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFEF4444))),
                    Text('Response needed nearby', style: TextStyle(fontSize: 11, color: textSec)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Incident type + severity
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Incident Type', style: TextStyle(fontSize: 12, color: textSec)),
                    const SizedBox(height: 6),
                    incidentTypeChips(incident: data),
                  ],
                ),
              ),
              if (severityLabel != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _severityColor(severity).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    severityLabel,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _severityColor(severity)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Location
          Row(
            children: [
              Icon(Icons.location_on_outlined, color: textSec, size: 16),
              const SizedBox(width: 6),
              Expanded(child: Text(barangay, style: TextStyle(fontSize: 13, color: textSec))),
            ],
          ),
          const SizedBox(height: 24),

          if (widget.onViewDetails != null) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _loading ? null : widget.onViewDetails,
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('View Details', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF2563EB),
                  side: const BorderSide(color: Color(0xFF2563EB)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Error
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
            ),

          // Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _loading ? null : _decline,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: textSec,
                    side: BorderSide(color: textSec.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Decline', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _loading ? null : _accept,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Accept Incident', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
