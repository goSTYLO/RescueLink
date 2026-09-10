import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../services/auth_service.dart';
import '../../services/department_ops_service.dart';
import '../../services/incident_service.dart';
import '../../services/websocket_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/glass_card.dart';

/// Detail + assign / reassign / resolve for department ops (no personnel stepper).
class DepartmentOpsIncidentDetailScreen extends StatefulWidget {
  final int reportId;
  final Map<String, dynamic>? initialIncident;
  final VoidCallback? onChanged;

  const DepartmentOpsIncidentDetailScreen({
    super.key,
    required this.reportId,
    this.initialIncident,
    this.onChanged,
  });

  @override
  State<DepartmentOpsIncidentDetailScreen> createState() =>
      _DepartmentOpsIncidentDetailScreenState();
}

class _DepartmentOpsIncidentDetailScreenState
    extends State<DepartmentOpsIncidentDetailScreen> {
  final DepartmentOpsService _ops = DepartmentOpsService();
  final IncidentService _incidents = IncidentService();

  Map<String, dynamic>? _incident;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  StreamSubscription<IncidentEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    if (widget.initialIncident != null) {
      _incident = Map<String, dynamic>.from(widget.initialIncident!);
      _loading = false;
    }
    _load();
    _wsSub = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      final rid = parseInt(event.reportId ?? event.data['report_id']);
      if (rid != widget.reportId) return;
      if (event.event == 'incident:status_updated' ||
          event.event == 'incident:dispatched') {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _ops.close();
    _incidents.close();
    super.dispose();
  }

  Future<void> _load() async {
    final showSpinner = _incident == null;
    if (showSpinner) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final row = await _incidents.getIncidentById(widget.reportId);
      if (!mounted) return;
      setState(() {
        _incident = row;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String get _teamName =>
      (_incident?['assigned_team_name'] ?? '').toString().trim();

  bool get _needsTeam => _teamName.isEmpty;

  bool get _isClosed {
    final s = (_incident?['status'] ?? '').toString().toLowerCase();
    return s == 'closed' || s == 'archived' || s == 'resolved';
  }

  bool get _canReassign => !_needsTeam && !_isClosed;

  /// Match web: dept-admin/head + In Progress + team assigned.
  bool get _canMarkResolved {
    final s = (_incident?['status'] ?? '').toString().toLowerCase().replaceAll('_', ' ');
    return !_needsTeam && (s == 'in progress' || s == 'inprogress');
  }

  Future<List<Map<String, dynamic>>> _loadAssignableTeams() async {
    final deptCode = AuthService().getDepartmentCode();
    if (deptCode == null || deptCode.isEmpty) {
      throw DepartmentOpsException('Department code missing on your profile.');
    }
    final teams = await _ops.listTeams(departmentCode: deptCode);
    return teams.where((t) {
      final status = (t['team_status'] ?? '').toString().toLowerCase();
      final active = t['is_active'] != false;
      return active &&
          (status.contains('available') || status.contains('standby'));
    }).toList();
  }

  Future<Map<String, dynamic>?> _pickTeam({required String title}) async {
    List<Map<String, dynamic>> assignable;
    try {
      assignable = await _loadAssignableTeams();
    } catch (e) {
      if (!mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      return null;
    }
    if (!mounted) return null;
    if (assignable.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No available or standby teams in your department.'),
        ),
      );
      return null;
    }

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ),
              ...assignable.map((team) {
                final name = (team['team_name'] ?? 'Team').toString();
                final status = (team['team_status'] ?? '').toString();
                return ListTile(
                  title: Text(name),
                  subtitle: Text(status),
                  onTap: () => Navigator.pop(ctx, team),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _assignTeam() async {
    final deptCode = AuthService().getDepartmentCode();
    if (deptCode == null || deptCode.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Department code missing on your profile.')),
      );
      return;
    }
    final selected = await _pickTeam(title: 'Assign team');
    if (selected == null || !mounted) return;
    final teamName = (selected['team_name'] ?? '').toString().trim();
    if (teamName.isEmpty) return;

    setState(() => _busy = true);
    try {
      await _ops.assignTeam(
        reportId: widget.reportId,
        departmentCode: deptCode,
        departmentName: AuthService().getDepartmentName(),
        teamName: teamName,
      );
      widget.onChanged?.call();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$teamName assigned')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reassignTeam() async {
    final deptCode = AuthService().getDepartmentCode();
    if (deptCode == null || deptCode.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Department code missing on your profile.')),
      );
      return;
    }
    final selected = await _pickTeam(title: 'Reassign team');
    if (selected == null || !mounted) return;
    final teamName = (selected['team_name'] ?? '').toString().trim();
    if (teamName.isEmpty) return;
    if (teamName.toLowerCase() == _teamName.toLowerCase()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pick a different team to reassign.')),
      );
      return;
    }

    final reasonCtrl = TextEditingController();
    String? reason;
    try {
      reason = await showDialog<String>(
        context: context,
        builder: (ctx) {
          return AlertDialog(
            title: const Text('Reassign reason'),
            content: TextField(
              controller: reasonCtrl,
              maxLines: 3,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'At least 10 characters',
                border: OutlineInputBorder(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, reasonCtrl.text),
                child: const Text('Confirm'),
              ),
            ],
          );
        },
      );
    } finally {
      // Dialog TextField may still be unmounting — dispose next frame.
      WidgetsBinding.instance.addPostFrameCallback((_) => reasonCtrl.dispose());
    }
    if (reason == null || !mounted) return;
    if (!isValidReassignReason(reason)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter at least 10 characters explaining the reassignment.'),
        ),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      await _ops.reassignTeam(
        reportId: widget.reportId,
        departmentCode: deptCode,
        teamName: teamName,
        reason: reason,
      );
      widget.onChanged?.call();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reassigned to $teamName')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markResolved() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark resolved?'),
        content: Text(
          'Mark incident #${widget.reportId} as resolved? This matches the web department action.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Mark resolved'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await _ops.resolveIncident(widget.reportId);
      widget.onChanged?.call();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Incident marked resolved')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
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
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Incident #DGP-${widget.reportId}',
          style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
        ),
        iconTheme: IconThemeData(color: textPrimary),
      ),
      body: _loading && _incident == null
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFEF4444)),
            )
          : _error != null && _incident == null
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
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildContent(textPrimary, textSec),
    );
  }

  Widget _buildContent(Color textPrimary, Color textSec) {
    final inc = _incident!;
    final lat = parseDouble(inc['latitude']);
    final lon = parseDouble(inc['longitude']);
    final status = (inc['status'] ?? '').toString();
    final type = (inc['incident_type'] ?? 'Incident').toString();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_teamName.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF134178).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFF134178).withValues(alpha: 0.25),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.groups_outlined, color: Color(0xFF134178)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Formal team assigned: $_teamName',
                      style: TextStyle(
                        color: textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ] else ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.group_off_outlined, color: Color(0xFFD97706)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'No team assigned yet',
                      style: TextStyle(
                        color: textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (lat != null && lon != null) ...[
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Incident Location',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      height: 200,
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: LatLng(lat, lon),
                          initialZoom: 15,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.rescuelink.mobile',
                          ),
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: LatLng(lat, lon),
                                width: 40,
                                height: 40,
                                child: const Icon(
                                  Icons.location_pin,
                                  color: Color(0xFFEF4444),
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
              ),
            ),
            const SizedBox(height: 16),
          ],
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Incident Details',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                _infoRow('Type', type, textSec, textPrimary),
                _infoRow('Status', status.isEmpty ? '—' : status, textSec, textPrimary),
                _infoRow(
                  'Barangay',
                  (inc['barangay'] ?? '').toString().isEmpty
                      ? '—'
                      : inc['barangay'].toString(),
                  textSec,
                  textPrimary,
                ),
                _infoRow(
                  'Severity',
                  (inc['severity_level'] ?? '').toString().isEmpty
                      ? '—'
                      : inc['severity_level'].toString(),
                  textSec,
                  textPrimary,
                ),
                if ((inc['description'] ?? '').toString().trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Description', style: TextStyle(fontSize: 12, color: textSec)),
                  const SizedBox(height: 4),
                  Text(
                    inc['description'].toString(),
                    style: TextStyle(color: textPrimary, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (!_isClosed) ...[
            if (_needsTeam)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _assignTeam,
                  icon: _busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.group_add_rounded),
                  label: Text(_busy ? 'Working…' : 'Assign team'),
                ),
              )
            else ...[
              if (_canReassign)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : _reassignTeam,
                    icon: const Icon(Icons.swap_horiz_rounded),
                    label: const Text('Reassign team'),
                  ),
                ),
              if (_canMarkResolved) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                    ),
                    onPressed: _busy ? null : _markResolved,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Mark resolved'),
                  ),
                ),
              ],
            ],
          ],
        ],
      ),
    );
  }

  Widget _infoRow(
    String label,
    String value,
    Color textSec,
    Color textPrimary,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(label, style: TextStyle(fontSize: 13, color: textSec)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
