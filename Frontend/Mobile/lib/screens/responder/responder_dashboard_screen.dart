import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../services/responder_service.dart';
import '../../services/websocket_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/staggered_fade_in.dart';
import 'responder_incident_detail_screen.dart';
import 'responder_incident_preview_screen.dart';

enum _ActiveIncidentsView { list, map }

class ResponderDashboardScreen extends StatefulWidget {
  final void Function(int reportId)? onIncidentTap;
  final VoidCallback? onNotificationsTap;
  final int unreadNotificationCount;
  final bool online;
  final ValueChanged<bool>? onOnlineStatusChanged;

  const ResponderDashboardScreen({
    super.key,
    this.onIncidentTap,
    this.onNotificationsTap,
    this.unreadNotificationCount = 0,
    this.online = false,
    this.onOnlineStatusChanged,
  });

  @override
  State<ResponderDashboardScreen> createState() => _ResponderDashboardScreenState();
}

class _ResponderDashboardScreenState extends State<ResponderDashboardScreen> {
  static const _dagupanCenter = LatLng(16.043, 120.333);
  static const _refreshEvents = {
    'incident:created',
    'incident:status_updated',
    'incident:accepted',
    'responder:incident_alert',
    'responder:status_changed',
  };

  final ResponderService _service = ResponderService();
  final MapController _mapController = MapController();

  bool _togglingOnline = false;
  bool _loadingIncidents = true;
  List<Map<String, dynamic>> _activeIncidents = [];
  String? _error;
  _ActiveIncidentsView _incidentsView = _ActiveIncidentsView.list;

  StreamSubscription<IncidentEvent>? _wsSub;

  @override
  void initState() {
    super.initState();
    _loadActiveIncidents();
    _listenForIncidentUpdates();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _service.close();
    super.dispose();
  }

  void _listenForIncidentUpdates() {
    _wsSub = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      if (_refreshEvents.contains(event.event)) {
        _loadActiveIncidents();
      }
    });
  }

  Future<void> _loadActiveIncidents() async {
    setState(() {
      _loadingIncidents = true;
      _error = null;
    });
    try {
      final incidents = await _service.getActiveIncidents();
      if (!mounted) return;
      setState(() {
        _activeIncidents = incidents;
        _loadingIncidents = false;
      });
      if (_incidentsView == _ActiveIncidentsView.map) {
        _fitMapToIncidents();
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loadingIncidents = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load incidents.';
          _loadingIncidents = false;
        });
      }
    }
  }

  Future<void> _toggleOnline() async {
    if (_togglingOnline) return;
    setState(() => _togglingOnline = true);
    try {
      final nextOnline = !widget.online;
      await _service.toggleOnlineStatus(nextOnline);
      if (mounted) {
        widget.onOnlineStatusChanged?.call(nextOnline);
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _togglingOnline = false);
    }
  }

  void _openIncidentDetail(int reportId) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => ResponderIncidentDetailScreen(reportId: reportId),
      ),
    ).then((_) => _loadActiveIncidents());
  }

  void _openIncident(Map<String, dynamic> inc) {
    final id = (inc['report_id'] as num?)?.toInt() ?? 0;
    if (id <= 0) return;

    if (inc['accepted_by_user_id'] == null) {
      Navigator.of(context, rootNavigator: true).push(
        MaterialPageRoute<void>(
          builder: (_) => ResponderIncidentPreviewScreen(reportId: id),
        ),
      ).then((_) => _loadActiveIncidents());
      return;
    }

    _openIncidentDetail(id);
  }

  LatLng? _incidentLatLng(Map<String, dynamic> inc) {
    final lat = (inc['latitude'] as num?)?.toDouble();
    final lon = (inc['longitude'] as num?)?.toDouble();
    if (lat == null || lon == null) return null;
    return LatLng(lat, lon);
  }

  void _fitMapToIncidents() {
    final points = _activeIncidents.map(_incidentLatLng).whereType<LatLng>().toList();
    if (points.isEmpty) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        if (points.length == 1) {
          _mapController.move(points.first, 14);
          return;
        }
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds.fromPoints(points),
            padding: const EdgeInsets.all(48),
          ),
        );
      } catch (_) {}
    });
  }

  void _onIncidentsViewChanged(Set<_ActiveIncidentsView> selection) {
    if (selection.isEmpty) return;
    final next = selection.first;
    setState(() => _incidentsView = next);
    if (next == _ActiveIncidentsView.map) {
      _fitMapToIncidents();
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'En Route':
        return const Color(0xFFF59E0B);
      case 'On Scene':
        return const Color(0xFFEF4444);
      case 'Resolved':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  Color _typeColor(String? type) {
    final t = (type ?? '').toLowerCase();
    if (t == 'sos') return const Color(0xFFEF4444);
    if (t.contains('fire')) return const Color(0xFFEA580C);
    if (t.contains('medical') || t.contains('accident')) return const Color(0xFFEC4899);
    if (t.contains('police')) return const Color(0xFF2563EB);
    if (t.contains('disaster') || t.contains('flood')) return const Color(0xFF0EA5E9);
    return const Color(0xFFEF4444);
  }

  String _badgeLabel(Map<String, dynamic> inc) {
    if (inc['accepted_by_user_id'] == null) return 'Open';
    return (inc['responder_status'] as String?) ?? 'Assigned';
  }

  Color _badgeColor(Map<String, dynamic> inc) {
    if (inc['accepted_by_user_id'] == null) return const Color(0xFF64748B);
    return _statusColor(inc['responder_status'] as String?);
  }

  String? _distanceLabel(Map<String, dynamic> inc) {
    final distance = inc['distance_km'];
    if (distance == null) return null;
    final km = (distance as num).toDouble();
    return '${km.toStringAsFixed(1)} km away';
  }

  Widget _buildIncidentList(Color textPrimary, Color textSec) {
    return Column(
      children: _activeIncidents.map((inc) {
        final id = (inc['report_id'] as num?)?.toInt() ?? 0;
        final type = (inc['incident_type'] as String?) ?? 'Incident';
        final barangay = (inc['barangay'] as String?) ?? '';
        final badge = _badgeLabel(inc);
        final badgeColor = _badgeColor(inc);
        final distance = _distanceLabel(inc);

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: GlassCard(
            onTap: () => _openIncident(inc),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 52,
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Report #DGP-$id — $type',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: textPrimary,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        distance != null ? '$barangay · $distance' : barangay,
                        style: TextStyle(fontSize: 12, color: textSec),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    badge,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: badgeColor,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right, color: textSec, size: 20),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildIncidentMap(Color textPrimary, Color textSec) {
    final markers = <Marker>[];
    for (final inc in _activeIncidents) {
      final point = _incidentLatLng(inc);
      if (point == null) continue;
      final type = (inc['incident_type'] as String?) ?? 'Incident';
      final color = _typeColor(type);

      markers.add(
        Marker(
          point: point,
          width: 44,
          height: 44,
          child: GestureDetector(
            onTap: () => _openIncident(inc),
            child: Icon(Icons.location_on, color: color, size: 36),
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: 420,
        child: FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: markers.isNotEmpty ? markers.first.point : _dagupanCenter,
            initialZoom: 13,
            interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.rescuelink.mobile',
            ),
            MarkerLayer(markers: markers),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveIncidentsSection(Color textPrimary, Color textSec) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Active Incidents',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: textPrimary),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<_ActiveIncidentsView>(
            segments: const [
              ButtonSegment(
                value: _ActiveIncidentsView.list,
                label: Text('List'),
                icon: Icon(Icons.list_rounded),
              ),
              ButtonSegment(
                value: _ActiveIncidentsView.map,
                label: Text('Map'),
                icon: Icon(Icons.map_rounded),
              ),
            ],
            selected: {_incidentsView},
            onSelectionChanged: _onIncidentsViewChanged,
          ),
        ),
        const SizedBox(height: 16),
        if (_loadingIncidents)
          const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444)))
        else if (_error != null)
          Text(_error!, style: const TextStyle(color: Color(0xFFEF4444)))
        else if (_activeIncidents.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Text('No nearby incidents', style: TextStyle(color: textSec)),
            ),
          )
        else if (_incidentsView == _ActiveIncidentsView.map)
          _buildIncidentMap(textPrimary, textSec)
        else
          _buildIncidentList(textPrimary, textSec),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final online = widget.online;
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
            child: StaggeredFadeIn.single(
              staggerDelayMs: 50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          'Responder',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: textPrimary,
                          ),
                        ),
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
                  const SizedBox(height: 24),
                  GlassCard(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: (online ? const Color(0xFF10B981) : const Color(0xFF6B7280))
                                .withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            online ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                            color: online ? const Color(0xFF10B981) : const Color(0xFF6B7280),
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
                                online ? 'Online' : 'Offline',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        _togglingOnline
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Switch(
                                value: online,
                                onChanged: (_) => _toggleOnline(),
                                activeTrackColor: const Color(0xFF10B981),
                              ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  _buildActiveIncidentsSection(textPrimary, textSec),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
