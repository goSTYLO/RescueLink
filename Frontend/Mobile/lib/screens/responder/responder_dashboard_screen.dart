import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../services/geolocation_service.dart';
import '../../services/responder_service.dart';
import '../../services/websocket_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/app_map_tile_layer.dart';
import '../../widgets/glass_card.dart';
import 'responder_incident_detail_screen.dart';
import 'responder_incident_preview_screen.dart';
import 'widgets/responder_incident_card.dart';

enum _ActiveIncidentsView { list, map }

enum _IncidentSort { nearest, newest }

class ResponderDashboardScreen extends StatefulWidget {
  final VoidCallback? onNotificationsTap;
  final int unreadNotificationCount;
  final bool online;
  final ValueChanged<bool>? onOnlineStatusChanged;

  const ResponderDashboardScreen({
    super.key,
    this.onNotificationsTap,
    this.unreadNotificationCount = 0,
    this.online = false,
    this.onOnlineStatusChanged,
  });

  @override
  State<ResponderDashboardScreen> createState() => ResponderDashboardScreenState();
}

class ResponderDashboardScreenState extends State<ResponderDashboardScreen> {
  static const _dagupanCenter = LatLng(16.043, 120.333);
  static const _refreshEvents = {
    'incident:created',
    'incident:status_updated',
    'incident:accepted',
    'incident:dispatched',
    'responder:incident_alert',
    'responder:backup_alert',
    'responder:backup_joined',
    'responder:status_changed',
  };

  final ResponderService _service = ResponderService();
  final MapController _mapController = MapController();

  bool _togglingOnline = false;
  bool _loadingIncidents = true;
  List<Map<String, dynamic>> _activeIncidents = [];
  List<Map<String, dynamic>> _assignedIncidents = [];
  String? _error;
  DateTime? _lastRefreshedAt;
  _ActiveIncidentsView _incidentsView = _ActiveIncidentsView.list;
  _IncidentSort _sort = _IncidentSort.nearest;
  String? _typeFilter;
  Map<String, dynamic>? _selectedMapIncident;
  LatLng? _userLocation;
  bool _mapReady = false;
  Timer? _mapCameraTimer;

  StreamSubscription<IncidentEvent>? _wsSub;

  /// Called from [HomePlaceholderScreen] when an alert modal is dismissed.
  Future<void> refreshIncidents() => _loadActiveIncidents();

  @override
  void initState() {
    super.initState();
    _loadActiveIncidents();
    _listenForIncidentUpdates();
  }

  @override
  void dispose() {
    _mapCameraTimer?.cancel();
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

  Future<void> _syncResponderLocationIfOnline() async {
    if (!widget.online) return;
    try {
      final pos = await GeolocationService.getCurrentPosition();
      if (!mounted) return;
      setState(() => _userLocation = LatLng(pos.latitude, pos.longitude));
      await _service.toggleOnlineStatus(
        true,
        latitude: pos.latitude,
        longitude: pos.longitude,
      );
    } catch (_) {}
  }

  Future<void> _loadActiveIncidents() async {
    setState(() {
      _loadingIncidents = true;
      _error = null;
    });
    try {
      await _syncResponderLocationIfOnline();
      List<Map<String, dynamic>> incidents = [];
      List<Map<String, dynamic>> assigned = [];
      Object? nearbyError;
      try {
        incidents = await _service.getActiveIncidents();
      } catch (e) {
        nearbyError = e;
      }
      try {
        assigned = await _service.getAssignedIncidents();
      } catch (_) {}
      assigned = assigned.where((inc) {
        final status = (inc['status'] ?? '').toString().toLowerCase();
        return status != 'closed' && status != 'archived';
      }).toList();
      if (!mounted) return;
      if (nearbyError != null && incidents.isEmpty && assigned.isEmpty) {
        throw nearbyError;
      }
      setState(() {
        _activeIncidents = incidents
            .where((inc) => inc['accepted_by_user_id'] == null)
            .toList();
        _assignedIncidents = assigned;
        _loadingIncidents = false;
        _lastRefreshedAt = DateTime.now();
        _pruneMapSelection();
      });
      if (_incidentsView == _ActiveIncidentsView.map) {
        _scheduleMapCameraUpdate();
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

  void _pruneMapSelection() {
    if (_selectedMapIncident == null) return;
    final selectedId = (_selectedMapIncident!['report_id'] as num?)?.toInt();
    final stillVisible = _visibleIncidents.any(
      (inc) => (inc['report_id'] as num?)?.toInt() == selectedId,
    );
    if (!stillVisible) _selectedMapIncident = null;
  }

  List<Map<String, dynamic>> get _visibleIncidents {
    var list = List<Map<String, dynamic>>.from(_activeIncidents);

    if (_typeFilter != null && _typeFilter!.isNotEmpty) {
      final filter = _typeFilter!.toLowerCase();
      list = list.where((inc) {
        final type = (primaryIncidentType(inc) ?? inc['incident_type']?.toString() ?? '')
            .toLowerCase();
        if (type == 'sos') return filter == 'sos';
        return type == filter || type.contains(filter);
      }).toList();
    }

    list.sort((a, b) {
      if (_sort == _IncidentSort.newest) {
        final aTime = DateTime.tryParse(a['created_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = DateTime.tryParse(b['created_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      }
      final aDist = _incidentDistanceKm(a);
      final bDist = _incidentDistanceKm(b);
      if (aDist == null && bDist == null) return 0;
      if (aDist == null) return 1;
      if (bDist == null) return -1;
      return aDist.compareTo(bDist);
    });

    return list;
  }

  List<String> get _availableTypeFilters {
    final types = <String>{};
    for (final inc in _activeIncidents) {
      final type = primaryIncidentType(inc) ?? inc['incident_type']?.toString();
      if (type != null && type.trim().isNotEmpty) {
        types.add(type.trim().toLowerCase());
      }
    }
    final sorted = types.toList()..sort();
    return sorted;
  }

  Future<void> _toggleOnline() async {
    if (_togglingOnline) return;
    setState(() => _togglingOnline = true);
    try {
      final nextOnline = !widget.online;
      double? lat;
      double? lon;
      if (nextOnline) {
        try {
          final pos = await GeolocationService.getCurrentPosition();
          lat = pos.latitude;
          lon = pos.longitude;
          if (mounted) setState(() => _userLocation = LatLng(lat!, lon!));
        } catch (_) {}
      }
      await _service.toggleOnlineStatus(
        nextOnline,
        latitude: lat,
        longitude: lon,
      );
      if (mounted) {
        widget.onOnlineStatusChanged?.call(nextOnline);
        if (nextOnline) unawaited(_loadActiveIncidents());
      }
    } on ResponderServiceException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _togglingOnline = false);
    }
  }

  void _openIncidentPreview(Map<String, dynamic> inc) {
    final id = (inc['report_id'] as num?)?.toInt() ?? 0;
    if (id <= 0) return;
    Navigator.of(context, rootNavigator: true)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => ResponderIncidentPreviewScreen(reportId: id),
          ),
        )
        .then((_) => _loadActiveIncidents());
  }

  void _openAssignedIncident(Map<String, dynamic> inc) {
    final id = parseInt(inc['report_id']) ?? 0;
    if (id <= 0) return;
    Navigator.of(context, rootNavigator: true)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => ResponderIncidentDetailScreen(
              reportId: id,
              isTeamAssignment: true,
              initialIncident: inc,
            ),
          ),
        )
        .then((_) => _loadActiveIncidents());
  }

  LatLng? _incidentLatLng(Map<String, dynamic> inc) {
    final lat = parseDouble(inc['latitude']);
    final lon = parseDouble(inc['longitude']);
    if (lat == null || lon == null) return null;
    if (lat.abs() > 90 || lon.abs() > 180) return null;
    return LatLng(lat, lon);
  }

  double? _incidentDistanceKm(Map<String, dynamic> inc) =>
      parseDouble(inc['distance_km']);

  void _scheduleMapCameraUpdate() {
    if (_incidentsView != _ActiveIncidentsView.map || !_mapReady) return;
    _mapCameraTimer?.cancel();
    _mapCameraTimer = Timer(const Duration(milliseconds: 450), _applyMapCamera);
  }

  void _applyMapCamera() {
    if (!mounted || _incidentsView != _ActiveIncidentsView.map) return;

    final points = _visibleIncidents.map(_incidentLatLng).whereType<LatLng>().toList();
    try {
      if (points.isEmpty) {
        final center = _userLocation ?? _dagupanCenter;
        _mapController.move(center, _userLocation != null ? 14 : 13);
        return;
      }
      if (points.length == 1) {
        _mapController.move(points.first, 14);
        return;
      }
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.fromLTRB(48, 48, 48, 160),
        ),
      );
    } catch (_) {}
  }

  Future<void> _centerOnUser() async {
    try {
      final pos = await GeolocationService.getCurrentPosition();
      if (!mounted) return;
      final point = LatLng(pos.latitude, pos.longitude);
      setState(() => _userLocation = point);
      _mapController.move(point, 15);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to get your location.')),
      );
    }
  }

  void _onIncidentsViewChanged(Set<_ActiveIncidentsView> selection) {
    if (selection.isEmpty) return;
    final next = selection.first;
    setState(() {
      _incidentsView = next;
      if (next == _ActiveIncidentsView.map) {
        _selectedMapIncident = null;
        _mapReady = false;
      }
    });
    if (next == _ActiveIncidentsView.map) {
      unawaited(_refreshUserLocationMarker());
    }
  }

  Future<void> _refreshUserLocationMarker() async {
    try {
      final pos = await GeolocationService.getCurrentPosition();
      if (!mounted) return;
      setState(() => _userLocation = LatLng(pos.latitude, pos.longitude));
      _scheduleMapCameraUpdate();
    } catch (_) {
      _scheduleMapCameraUpdate();
    }
  }

  String _lastUpdatedLabel() {
    final dt = _lastRefreshedAt;
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'Updated just now';
    if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes}m ago';
    if (diff.inHours < 24) return 'Updated ${diff.inHours}h ago';
    return 'Updated ${diff.inDays}d ago';
  }

  Widget _buildViewToggle(Color textPrimary) {
    return Container(
      decoration: BoxDecoration(
        color: textPrimary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          _viewToggleChip(
            label: 'List',
            icon: Icons.list_rounded,
            selected: _incidentsView == _ActiveIncidentsView.list,
            onTap: () => _onIncidentsViewChanged({_ActiveIncidentsView.list}),
          ),
          _viewToggleChip(
            label: 'Map',
            icon: Icons.map_rounded,
            selected: _incidentsView == _ActiveIncidentsView.map,
            onTap: () => _onIncidentsViewChanged({_ActiveIncidentsView.map}),
          ),
        ],
      ),
    );
  }

  Widget _viewToggleChip({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Material(
        color: selected ? const Color(0xFF2563EB) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 18, color: selected ? Colors.white : const Color(0xFF94A3B8)),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFiltersRow(Color textSec) {
    final types = _availableTypeFilters;
    return Row(
      children: [
        Expanded(
          child: _filterDropdown<String?>(
            value: _typeFilter,
            hint: 'All Types',
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('All Types')),
              ...types.map(
                (t) => DropdownMenuItem<String?>(
                  value: t,
                  child: Text(incidentTypeLabel(t)),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _typeFilter = v),
            textSec: textSec,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _filterDropdown<_IncidentSort>(
            value: _sort,
            hint: 'Sort',
            items: const [
              DropdownMenuItem(value: _IncidentSort.nearest, child: Text('Sort: Nearest')),
              DropdownMenuItem(value: _IncidentSort.newest, child: Text('Sort: Newest')),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _sort = v);
            },
            textSec: textSec,
          ),
        ),
      ],
    );
  }

  Widget _filterDropdown<T>({
    required T value,
    required String hint,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
    required Color textSec,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        border: Border.all(color: textSec.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: TextStyle(fontSize: 13, color: textSec)),
          icon: Icon(Icons.expand_more, size: 18, color: textSec),
          style: TextStyle(fontSize: 13, color: textSec),
          dropdownColor: Theme.of(context).brightness == Brightness.dark
              ? const Color(0xFF1E293B)
              : Colors.white,
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildSummaryRow(Color textPrimary, Color textSec) {
    final count = _visibleIncidents.length;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                count == 1 ? '1 incident nearby' : '$count incidents nearby',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: textPrimary,
                ),
              ),
              if (_lastRefreshedAt != null)
                Text(_lastUpdatedLabel(), style: TextStyle(fontSize: 12, color: textSec)),
            ],
          ),
        ),
        IconButton(
          icon: _loadingIncidents
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFEF4444)),
                )
              : Icon(Icons.refresh_rounded, color: textSec),
          onPressed: _loadingIncidents ? null : _loadActiveIncidents,
          tooltip: 'Refresh',
        ),
      ],
    );
  }

  Widget _buildListBody(Color textPrimary, Color textSec) {
    final incidents = _visibleIncidents;
    final assigned = _assignedIncidents;
    if (_loadingIncidents && incidents.isEmpty && assigned.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFEF4444)));
    }
    if (_error != null && incidents.isEmpty && assigned.isEmpty) {
      return Center(
        child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
      );
    }
    if (incidents.isEmpty && assigned.isEmpty) {
      return Center(
        child: Text(
          widget.online ? 'No nearby incidents' : 'Go online to see nearby incidents',
          style: TextStyle(color: textSec),
          textAlign: TextAlign.center,
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadActiveIncidents,
      color: const Color(0xFFEF4444),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          if (assigned.isNotEmpty) ...[
            Text(
              'Assigned to my team',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            ...assigned.map((inc) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ResponderIncidentCard(
                    incident: inc,
                    badgeText: (inc['my_response_status'] ?? 'Assigned').toString(),
                    onTap: () => _openAssignedIncident(inc),
                  ),
                )),
            const SizedBox(height: 8),
            Text(
              'Nearby incidents',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: textPrimary,
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (incidents.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                widget.online ? 'No nearby incidents' : 'Go online to see nearby incidents',
                style: TextStyle(color: textSec),
                textAlign: TextAlign.center,
              ),
            )
          else
            ...incidents.map((inc) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ResponderIncidentCard(
                    incident: inc,
                    onTap: () => _openIncidentPreview(inc),
                  ),
                )),
        ],
      ),
    );
  }

  Widget _buildMapBody() {
    final incidents = _visibleIncidents;
    final markers = <Marker>[];

    for (final inc in incidents) {
      final point = _incidentLatLng(inc);
      if (point == null) continue;
      final type = primaryIncidentType(inc);
      final color = incidentTypeColor(type);
      final reportId = (inc['report_id'] as num?)?.toInt();
      final selectedId = (_selectedMapIncident?['report_id'] as num?)?.toInt();
      final isSelected = reportId != null && reportId == selectedId;

      markers.add(
        Marker(
          point: point,
          width: isSelected ? 52 : 44,
          height: isSelected ? 52 : 44,
          child: GestureDetector(
            onTap: () => setState(() => _selectedMapIncident = inc),
            child: Icon(
              Icons.location_on,
              color: color,
              size: isSelected ? 44 : 36,
            ),
          ),
        ),
      );
    }

    if (_userLocation != null) {
      markers.add(
        Marker(
          point: _userLocation!,
          width: 24,
          height: 24,
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB).withValues(alpha: 0.25),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF2563EB), width: 2),
            ),
            child: Center(
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF2563EB),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: FlutterMap(
            key: const ValueKey('responder-dashboard-map'),
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _userLocation ?? _dagupanCenter,
              initialZoom: 13,
              interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
              onMapReady: () {
                _mapReady = true;
                _scheduleMapCameraUpdate();
              },
            ),
            children: [
              AppMapTileLayer(),
              MarkerLayer(markers: markers),
            ],
          ),
        ),
        if (_loadingIncidents)
          const Center(
            child: CircularProgressIndicator(color: Color(0xFFEF4444)),
          ),
        Positioned(
          right: 16,
          bottom: _selectedMapIncident != null ? 140 : 24,
          child: FloatingActionButton.small(
            heroTag: 'responder_locate',
            backgroundColor: const Color(0xFF1E293B),
            onPressed: _centerOnUser,
            child: const Icon(Icons.my_location_rounded, color: Colors.white),
          ),
        ),
        if (_selectedMapIncident != null)
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: ResponderIncidentCard(
              incident: _selectedMapIncident!,
              compact: true,
              onTap: () => _openIncidentPreview(_selectedMapIncident!),
            ),
          ),
        if (!widget.online)
          Positioned(
            top: 12,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B).withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'You are offline — go online to receive alerts',
                style: TextStyle(color: Colors.white70, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildHeader(Color textPrimary, Color textSec, bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        icon: Icon(Icons.notifications_outlined, color: textPrimary, size: 22),
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
          const SizedBox(height: 20),
          GlassCard(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (widget.online ? const Color(0xFF10B981) : const Color(0xFF6B7280))
                        .withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    widget.online ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    color: widget.online ? const Color(0xFF10B981) : const Color(0xFF6B7280),
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
                        widget.online ? 'Online' : 'Offline',
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
                        value: widget.online,
                        onChanged: (_) => _toggleOnline(),
                        activeTrackColor: const Color(0xFF10B981),
                      ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildViewToggle(textPrimary),
          const SizedBox(height: 12),
          _buildFiltersRow(textSec),
          const SizedBox(height: 12),
          _buildSummaryRow(textPrimary, textSec),
          const SizedBox(height: 8),
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
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(textPrimary, textSec, isDark),
            Expanded(
              child: _incidentsView == _ActiveIncidentsView.map
                  ? _buildMapBody()
                  : _buildListBody(textPrimary, textSec),
            ),
          ],
        ),
      ),
    );
  }
}
