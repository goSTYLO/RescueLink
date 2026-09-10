import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/department_ops_service.dart';
import '../../services/websocket_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/glass_card.dart';
import '../responder/widgets/responder_incident_card.dart';
import 'department_ops_incident_detail_screen.dart';

/// Department-admin / head queue — responder-like list chrome, dept-scoped incidents.
class DepartmentOpsDashboardScreen extends StatefulWidget {
  final VoidCallback? onNotificationsTap;
  final int unreadNotificationCount;

  const DepartmentOpsDashboardScreen({
    super.key,
    this.onNotificationsTap,
    this.unreadNotificationCount = 0,
  });

  @override
  State<DepartmentOpsDashboardScreen> createState() =>
      DepartmentOpsDashboardScreenState();
}

class DepartmentOpsDashboardScreenState
    extends State<DepartmentOpsDashboardScreen> {
  static const _refreshEvents = {
    'incident:created',
    'incident:status_updated',
    'incident:dispatched',
    'incident:verified',
  };

  final DepartmentOpsService _service = DepartmentOpsService();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _incidents = [];
  StreamSubscription<IncidentEvent>? _wsSub;

  Future<void> refreshIncidents() => _load();

  @override
  void initState() {
    super.initState();
    _load();
    _wsSub = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      if (_refreshEvents.contains(event.event)) {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _service.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _service.listDepartmentIncidents();
      final open = rows.where((inc) {
        final status = (inc['status'] ?? '').toString().toLowerCase();
        return status != 'closed' &&
            status != 'archived' &&
            status != 'resolved';
      }).toList();
      if (!mounted) return;
      setState(() {
        _incidents = open;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openIncident(Map<String, dynamic> incident) async {
    final reportId = parseInt(incident['report_id']);
    if (reportId == null) return;
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => DepartmentOpsIncidentDetailScreen(
          reportId: reportId,
          initialIncident: incident,
          onChanged: refreshIncidents,
        ),
      ),
    );
    if (mounted) await refreshIncidents();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSec = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final bg = isDark ? const Color(0xFF0F1420) : const Color(0xFFF1F5F9);
    final deptName = AuthService().getDepartmentName() ?? 'Your department';
    final needsTeam =
        _incidents.where((i) => (i['assigned_team_name'] ?? '').toString().trim().isEmpty).length;

    return ColoredBox(
      color: bg,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          'Reports',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: _loading ? null : _load,
                        icon: Icon(Icons.refresh_rounded, color: textPrimary),
                      ),
                      if (widget.onNotificationsTap != null)
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: (isDark ? Colors.white : Colors.black)
                                    .withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              child: IconButton(
                                padding: EdgeInsets.zero,
                                icon: Icon(
                                  Icons.notifications_outlined,
                                  color: textPrimary,
                                  size: 22,
                                ),
                                onPressed: widget.onNotificationsTap,
                              ),
                            ),
                            if (widget.unreadNotificationCount > 0)
                              Positioned(
                                top: 2,
                                right: 2,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFEF4444),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Center(
                                    child: Text(
                                      widget.unreadNotificationCount > 9
                                          ? '9+'
                                          : '${widget.unreadNotificationCount}',
                                      style: const TextStyle(
                                        fontSize: 8,
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  GlassCard(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF134178).withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.apartment_rounded,
                            color: Color(0xFF134178),
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(deptName, style: TextStyle(fontSize: 13, color: textSec)),
                              Text(
                                _loading
                                    ? 'Loading…'
                                    : '${_incidents.length} open'
                                        '${needsTeam > 0 ? ' · $needsTeam need team' : ''}',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
            Expanded(child: _buildBody(textPrimary, textSec)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(Color textPrimary, Color textSec) {
    if (_loading && _incidents.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFEF4444)),
      );
    }
    if (_error != null && _incidents.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFEF4444)),
              ),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_incidents.isEmpty) {
      return Center(
        child: Text(
          'No open incidents for your department',
          style: TextStyle(color: textSec),
        ),
      );
    }
    return RefreshIndicator(
      color: const Color(0xFFEF4444),
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        itemCount: _incidents.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final incident = _incidents[index];
          final team = (incident['assigned_team_name'] ?? '').toString().trim();
          return ResponderIncidentCard(
            incident: incident,
            badgeText: team.isEmpty ? 'Needs team' : team,
            onTap: () => _openIncident(incident),
          );
        },
      ),
    );
  }
}
