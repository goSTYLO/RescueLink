import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/responder_service.dart';
import '../../services/websocket_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/staggered_fade_in.dart';
import 'incident_alert_modal.dart';
import 'responder_incident_detail_screen.dart';

class ResponderDashboardScreen extends StatefulWidget {
  final void Function(int reportId)? onIncidentTap;

  const ResponderDashboardScreen({super.key, this.onIncidentTap});

  @override
  State<ResponderDashboardScreen> createState() => _ResponderDashboardScreenState();
}

class _ResponderDashboardScreenState extends State<ResponderDashboardScreen> {
  final ResponderService _service = ResponderService();

  bool _online = false;
  bool _togglingOnline = false;
  bool _loadingIncidents = true;
  List<Map<String, dynamic>> _activeIncidents = [];
  String? _error;

  StreamSubscription<IncidentEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadActiveIncidents();
    _listenForAlerts();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _service.close();
    super.dispose();
  }

  void _listenForAlerts() {
    _wsSub = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      if (event.event == 'responder:incident_alert' && _online) {
        _showAlert(event);
      }
      if (event.event == 'incident:accepted' || event.event == 'responder:status_changed') {
        _loadActiveIncidents();
      }
    });
  }

  void _showAlert(IncidentEvent event) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => IncidentAlertModal(
        event: event,
        onAccepted: (reportId) {
          Navigator.of(context).pop();
          _openIncidentDetail(reportId);
          _loadActiveIncidents();
        },
        onDeclined: () => Navigator.of(context).pop(),
      ),
    );
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await _service.getSelfProfile();
      if (mounted) {
        setState(() => _online = profile['responder_online'] == true);
      }
    } catch (_) {}
  }

  Future<void> _loadActiveIncidents() async {
    setState(() { _loadingIncidents = true; _error = null; });
    try {
      final incidents = await _service.getActiveIncidents();
      if (mounted) setState(() { _activeIncidents = incidents; _loadingIncidents = false; });
    } on ResponderServiceException catch (e) {
      if (mounted) setState(() { _error = e.message; _loadingIncidents = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'Unable to load incidents.'; _loadingIncidents = false; });
    }
  }

  Future<void> _toggleOnline() async {
    if (_togglingOnline) return;
    setState(() => _togglingOnline = true);
    try {
      await _service.toggleOnlineStatus(!_online);
      if (mounted) setState(() => _online = !_online);
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _togglingOnline = false);
    }
  }

  void _openIncidentDetail(int reportId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ResponderIncidentDetailScreen(reportId: reportId),
      ),
    ).then((_) => _loadActiveIncidents());
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'En Route': return const Color(0xFFF59E0B);
      case 'On Scene': return const Color(0xFFEF4444);
      case 'Resolved': return const Color(0xFF10B981);
      default: return const Color(0xFF3B82F6); // Assigned
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF0F1420) : const Color(0xFFF1F5F9);
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSec = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadActiveIncidents,
          color: const Color(0xFFEF4444),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            child: StaggeredFadeIn(
              staggerDelayMs: 50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text('Responder', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: textPrimary)),
                  const SizedBox(height: 4),
                  Text('Manage your assignments', style: TextStyle(fontSize: 13, color: textSec)),
                  const SizedBox(height: 24),

                  // Online/Offline toggle
                  GlassCard(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: (_online ? const Color(0xFF10B981) : const Color(0xFF6B7280)).withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _online ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                            color: _online ? const Color(0xFF10B981) : const Color(0xFF6B7280),
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Status', style: TextStyle(fontSize: 13, color: textSec)),
                              Text(
                                _online ? 'Online — receiving alerts' : 'Offline — not receiving alerts',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary),
                              ),
                            ],
                          ),
                        ),
                        _togglingOnline
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                            : Switch(
                                value: _online,
                                onChanged: (_) => _toggleOnline(),
                                activeColor: const Color(0xFF10B981),
                              ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Active incidents
                  Text('Active Assignments', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: textPrimary)),
                  const SizedBox(height: 12),

                  if (_loadingIncidents)
                    const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444)))
                  else if (_error != null)
                    Text(_error!, style: const TextStyle(color: Color(0xFFEF4444)))
                  else if (_activeIncidents.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 32),
                        child: Text('No active assignments.', style: TextStyle(color: textSec)),
                      ),
                    )
                  else
                    ..._activeIncidents.map((inc) {
                      final id = (inc['report_id'] as num?)?.toInt() ?? 0;
                      final type = (inc['incident_type'] as String?) ?? 'Incident';
                      final barangay = (inc['barangay'] as String?) ?? '';
                      final status = (inc['responder_status'] as String?) ?? 'Assigned';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: GlassCard(
                          onTap: () => _openIncidentDetail(id),
                          child: Row(
                            children: [
                              Container(
                                width: 4,
                                height: 52,
                                decoration: BoxDecoration(
                                  color: _statusColor(status),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Report #DGP-$id — $type',
                                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary)),
                                    const SizedBox(height: 3),
                                    Text(barangay, style: TextStyle(fontSize: 12, color: textSec)),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: _statusColor(status).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(status,
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _statusColor(status))),
                              ),
                              const SizedBox(width: 8),
                              Icon(Icons.chevron_right, color: textSec, size: 20),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
