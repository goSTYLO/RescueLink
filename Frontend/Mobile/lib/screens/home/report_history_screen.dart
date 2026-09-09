import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../services/auth_service.dart';
import '../../services/incident_service.dart';
import '../../services/websocket_service.dart';
import '../../utils/incident_navigation.dart';
import '../../utils/report_ui.dart';
import '../../widgets/bottom_sheet_wrapper.dart';
import '../../widgets/skeleton_placeholder.dart';
import '../../widgets/empty_state_illustration.dart';
import '../../widgets/premium_card.dart';

class ReportHistoryScreen extends StatefulWidget {
  final void Function(int reportId)? onReportTap;
  final VoidCallback? onReportIncidentTap;
  final VoidCallback? onNotificationsTap;
  final int unreadNotificationCount;

  const ReportHistoryScreen({
    super.key,
    this.onReportTap,
    this.onReportIncidentTap,
    this.onNotificationsTap,
    this.unreadNotificationCount = 0,
  });

  @override
  State<ReportHistoryScreen> createState() => _ReportHistoryScreenState();
}

class _ReportHistoryScreenState extends State<ReportHistoryScreen> {
  static const int _pageSize = 20;
  static const Color _screenBg = Color(0xFF0B0E14);
  static const Color _cardBg = Color(0xFF151922);
  static const Color _inputBg = Color(0xFF151922);
  static const Color _cardBorder = Color(0xFF252D40);
  static const Color _mutedText = Color(0xFF94A3B8);
  static const Color _primaryText = Color(0xFFF9FAFB);

  List<dynamic> _incidents = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;
  String? _filterStatus;
  String? _filterType;
  String? _involvementFilter;
  bool _isResponder = false;
  bool _isPersonnel = false;
  String _searchQuery = '';
  bool _sortNewestFirst = true;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  StreamSubscription<IncidentEvent>? _wsSubscription;

  @override
  void initState() {
    super.initState();
    _isResponder = AuthService().hasResponderTab;
    _isPersonnel = AuthService().isPersonnelResponder;
    _loadIncidents();
    _wsSubscription = WebSocketService().eventStream.listen((event) {
      if (!mounted) return;
      _loadIncidents();
    });
    _searchController.addListener(() {
      if (mounted) setState(() => _searchQuery = _searchController.text.trim());
    });
  }

  @override
  void dispose() {
    _wsSubscription?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadIncidents() async {
    setState(() {
      _loading = true;
      _error = null;
      _incidents = [];
      _hasMore = true;
    });
    try {
      final list = await IncidentService().getMyIncidents(
        limit: _pageSize,
        offset: 0,
        status: _filterStatus,
        incidentType: _filterType,
        involvement: _isResponder
            ? (_involvementFilter ?? (_isPersonnel ? 'assigned' : 'all'))
            : null,
      );
      if (!mounted) return;
      setState(() {
        _incidents = list;
        _loading = false;
        _error = null;
        _hasMore = list.length == _pageSize;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is IncidentServiceException ? e.message : e.toString();
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _loading) return;
    setState(() => _loadingMore = true);
    try {
      final list = await IncidentService().getMyIncidents(
        limit: _pageSize,
        offset: _incidents.length,
        status: _filterStatus,
        incidentType: _filterType,
        involvement: _isResponder
            ? (_involvementFilter ?? (_isPersonnel ? 'assigned' : 'all'))
            : null,
      );
      if (!mounted) return;
      setState(() {
        _incidents = [..._incidents, ...list];
        _loadingMore = false;
        _hasMore = list.length == _pageSize;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  Map<String, dynamic>? get _latestIncident {
    if (_incidents.isEmpty) return null;
    final latest = _incidents.first;
    if (latest is Map<String, dynamic>) return latest;
    if (latest is Map) return latest.cast<String, dynamic>();
    return null;
  }

  DateTime? _parseCreatedAt(dynamic incident) {
    try {
      final map = incident is Map ? incident : <String, dynamic>{};
      final createdAt = map['created_at'] as String?;
      if (createdAt == null || createdAt.isEmpty) return null;
      return DateTime.parse(createdAt).toLocal();
    } catch (_) {
      return null;
    }
  }

  List<dynamic> get _filteredIncidents {
    Iterable<dynamic> results = _incidents;

    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      results = results.where((e) {
        try {
          final map = e is Map ? e : <String, dynamic>{};
          final id = map['report_id'];
          final idStr = id != null ? 'DGP-$id' : '';
          final type = (map['incident_type'] as String? ?? '').toLowerCase();
          final desc = (map['description'] as String? ?? '').toLowerCase();
          final createdAt = (map['created_at'] as String? ?? '').toLowerCase();
          final status = (map['status'] as String? ?? '').toLowerCase();
          final location = incidentLocationLabel(
            map is Map<String, dynamic> ? map : map.cast<String, dynamic>(),
          ).toLowerCase();
          return idStr.toLowerCase().contains(q) ||
              type.contains(q) ||
              desc.contains(q) ||
              createdAt.contains(q) ||
              status.contains(q) ||
              location.contains(q);
        } catch (_) {
          return false;
        }
      });
    }

    if (_dateFrom != null || _dateTo != null) {
      results = results.where((e) {
        final created = _parseCreatedAt(e);
        if (created == null) return false;
        final day = DateTime(created.year, created.month, created.day);
        if (_dateFrom != null) {
          final from = DateTime(_dateFrom!.year, _dateFrom!.month, _dateFrom!.day);
          if (day.isBefore(from)) return false;
        }
        if (_dateTo != null) {
          final to = DateTime(_dateTo!.year, _dateTo!.month, _dateTo!.day);
          if (day.isAfter(to)) return false;
        }
        return true;
      });
    }

    final list = results.toList();
    list.sort((a, b) {
      final aDate = _parseCreatedAt(a);
      final bDate = _parseCreatedAt(b);
      if (aDate == null && bDate == null) return 0;
      if (aDate == null) return 1;
      if (bDate == null) return -1;
      return _sortNewestFirst ? bDate.compareTo(aDate) : aDate.compareTo(bDate);
    });
    return list;
  }

  void _openLatestLocationMap() {
    final incident = _latestIncident;
    if (incident == null) return;

    final lat = parseDouble(incident['latitude']);
    final lng = parseDouble(incident['longitude']);
    if (lat == null || lng == null || lat.isNaN || lng.isNaN) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location not available')),
      );
      return;
    }

    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _ReportLocationMapScreen(
          latitude: lat,
          longitude: lng,
          title: incidentLocationLabel(incident),
        ),
      ),
    );
  }

  Future<void> _openFilterSheet() async {
    var sortNewestFirst = _sortNewestFirst;
    DateTime? dateFrom = _dateFrom;
    DateTime? dateTo = _dateTo;

    await BottomSheetWrapper.show<void>(
      context: context,
      title: 'Sort & filter',
      child: StatefulBuilder(
        builder: (context, setSheetState) {
          Future<void> pickDate({
            required bool isFrom,
          }) async {
            final initial = isFrom
                ? (dateFrom ?? DateTime.now())
                : (dateTo ?? dateFrom ?? DateTime.now());
            final picked = await showDatePicker(
              context: context,
              initialDate: initial,
              firstDate: DateTime(2020),
              lastDate: DateTime.now().add(const Duration(days: 1)),
            );
            if (picked == null) return;
            setSheetState(() {
              if (isFrom) {
                dateFrom = picked;
                if (dateTo != null && picked.isAfter(dateTo!)) {
                  dateTo = picked;
                }
              } else {
                dateTo = picked;
                if (dateFrom != null && picked.isBefore(dateFrom!)) {
                  dateFrom = picked;
                }
              }
            });
          }

          String formatDate(DateTime? value) {
            if (value == null) return 'Any';
            return '${_monthShort(value.month)} ${value.day}, ${value.year}';
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Sort',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment<bool>(
                    value: true,
                    label: Text('Newest first'),
                  ),
                  ButtonSegment<bool>(
                    value: false,
                    label: Text('Oldest first'),
                  ),
                ],
                selected: {sortNewestFirst},
                onSelectionChanged: (selection) {
                  setSheetState(() => sortNewestFirst = selection.first);
                },
              ),
              const SizedBox(height: 20),
              Text(
                'Date range',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Applies to reports already loaded on this screen.',
                style: TextStyle(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('From'),
                subtitle: Text(formatDate(dateFrom)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 20),
                onTap: () => pickDate(isFrom: true),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('To'),
                subtitle: Text(formatDate(dateTo)),
                trailing: const Icon(Icons.calendar_today_outlined, size: 20),
                onTap: () => pickDate(isFrom: false),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setSheetState(() {
                          sortNewestFirst = true;
                          dateFrom = null;
                          dateTo = null;
                        });
                      },
                      child: const Text('Reset'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        HapticFeedback.mediumImpact();
                        setState(() {
                          _sortNewestFirst = sortNewestFirst;
                          _dateFrom = dateFrom;
                          _dateTo = dateTo;
                        });
                        Navigator.of(context).pop();
                      },
                      child: const Text('Apply'),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  InputDecoration _fieldDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: _mutedText, fontSize: 12),
      filled: true,
      fillColor: _inputBg,
      prefixIcon: hint == 'Search reports...'
          ? const Icon(Icons.search, color: _mutedText, size: 18)
          : null,
      isDense: true,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _cardBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _cardBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    );
  }

  Widget _locationCard() {
    return Material(
      color: _cardBg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: _incidents.isEmpty ? null : _openLatestLocationMap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _cardBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.location_on,
                  color: Color(0xFF111827),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _locationTitle(),
                      style: const TextStyle(
                        fontSize: 10,
                        color: _mutedText,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _locationSubtitle(),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _primaryText,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: _mutedText, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  Widget _reportsTitleRow() {
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Reports',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _primaryText,
              height: 1.1,
            ),
          ),
        ),
        SizedBox(
          width: 34,
          height: 34,
          child: Material(
            color: const Color(0xFFEF4444).withValues(alpha: 0.12),
            shape: const CircleBorder(),
            child: IconButton(
              padding: EdgeInsets.zero,
              onPressed: _loading ? null : _loadIncidents,
              icon: _loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(0xFFEF4444),
                      ),
                    )
                  : const Icon(
                      Icons.refresh,
                      color: Color(0xFFEF4444),
                      size: 18,
                    ),
            ),
          ),
        ),
      ],
    );
  }

  String _monthShort(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month - 1];
  }

  Widget _buildLogo() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/icon.png',
          width: 72,
          height: 72,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Icon(
            Icons.health_and_safety,
            color: Colors.white,
            size: 72,
          ),
        ),
        const SizedBox(width: 12),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, height: 1.1),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Colors.white)),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFFF6B6B))),
                ],
              ),
            ),
            SizedBox(height: 2),
            Text(
              "Dagupan's Emergency App",
              style: TextStyle(
                fontSize: 12,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ],
    );
  }

  IconData _iconForType(String? type) {
    if (type == null) return Icons.emergency;
    final t = type.toLowerCase();
    if (t == 'sos') return Icons.emergency;
    if (t.contains('fire')) return Icons.local_fire_department;
    if (t.contains('medical') || t.contains('health') || t.contains('accident')) {
      return Icons.monitor_heart_outlined;
    }
    if (t.contains('police')) return Icons.shield_outlined;
    if (t.contains('disaster') || t.contains('flood')) return Icons.water_drop_outlined;
    return Icons.emergency;
  }

  Color _iconColorForType(String? type) {
    if (type == null) return const Color(0xFFEF4444);
    final t = type.toLowerCase();
    if (t == 'sos') return const Color(0xFFEF4444);
    if (t.contains('fire')) return const Color(0xFFEA580C);
    if (t.contains('medical') || t.contains('health') || t.contains('accident')) {
      return const Color(0xFFEC4899);
    }
    if (t.contains('police')) return const Color(0xFF2563EB);
    if (t.contains('disaster') || t.contains('flood')) return const Color(0xFF0EA5E9);
    return const Color(0xFFEF4444);
  }

  Color _statusSolidColor(String? status) {
    switch (ReportStatusUi.normalize(status)) {
      case 'closed':
      case 'resolved':
        return const Color(0xFF22C55E);
      case 'verified':
        return const Color(0xFF9333EA);
      case 'in_progress':
        return const Color(0xFF2563EB);
      case 'pending':
      default:
        return const Color(0xFFF59E0B);
    }
  }

  String _locationTitle() {
    if (_incidents.isEmpty) return 'No location yet';
    return 'Last report location';
  }

  String _locationSubtitle() {
    if (_incidents.isEmpty) return 'Report an incident';
    return incidentLocationLabel(_latestIncident);
  }

  int _countActive(Iterable<dynamic> incidents) {
    return incidents.where((e) => ReportStatusUi.normalize(_status(e)) == 'in_progress').length;
  }

  int _countClosed(Iterable<dynamic> incidents) {
    return incidents.where((e) => ReportStatusUi.isResolvedOrClosed(_status(e))).length;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredIncidents;

    return RefreshIndicator(
      onRefresh: _loadIncidents,
      color: const Color(0xFFEF4444),
      child: ColoredBox(
        color: _screenBg,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xFF111827)
                      : const Color(0xFF0F172A),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: Row(
                      children: [
                        Expanded(child: _buildLogo()),
                        if (widget.onNotificationsTap != null)
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              SizedBox(
                                width: 48,
                                height: 48,
                                child: Material(
                                  color: Colors.white.withValues(alpha: 0.1),
                                  shape: const CircleBorder(),
                                  child: IconButton(
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(
                                      Icons.notifications_outlined,
                                      color: Colors.white,
                                      size: 22,
                                    ),
                                    onPressed: widget.onNotificationsTap,
                                  ),
                                ),
                              ),
                              if (widget.unreadNotificationCount > 0)
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
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
                                          fontSize: 9,
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
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _locationCard(),
                    const SizedBox(height: 16),
                    _reportsTitleRow(),
                    const SizedBox(height: 12),
                  if (_loading && _incidents.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: Column(
                        children: [
                          SkeletonCard(height: 72),
                          SizedBox(height: 10),
                          SkeletonCard(height: 72),
                          SizedBox(height: 10),
                          SkeletonCard(height: 72),
                        ],
                      ),
                    )
                  else if (_error != null && _incidents.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Column(
                        children: [
                          Text(
                            _error!,
                            style: const TextStyle(color: Color(0xFFDC2626)),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: _loadIncidents,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    _statsRow(filtered),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      style: const TextStyle(color: _primaryText, fontSize: 13),
                      decoration: _fieldDecoration(hint: 'Search reports...').copyWith(
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18, color: _mutedText),
                                onPressed: _searchController.clear,
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (_isResponder) ...[
                      _involvementFilterChips(),
                      const SizedBox(height: 10),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: Theme(
                            data: Theme.of(context).copyWith(
                              canvasColor: _inputBg,
                            ),
                            child: DropdownButtonFormField<String?>(
                              initialValue: _filterStatus,
                              dropdownColor: _inputBg,
                              style: const TextStyle(color: _primaryText, fontSize: 12),
                              icon: const Icon(Icons.keyboard_arrow_down, color: _mutedText, size: 18),
                              decoration: _fieldDecoration(),
                              hint: const Text('All Status', style: TextStyle(color: _mutedText)),
                              items: const [
                                DropdownMenuItem<String?>(value: null, child: Text('All Status')),
                                DropdownMenuItem<String?>(value: 'pending', child: Text('Pending')),
                                DropdownMenuItem<String?>(value: 'verified', child: Text('Verified')),
                                DropdownMenuItem<String?>(value: 'in_progress', child: Text('In progress')),
                                DropdownMenuItem<String?>(value: 'resolved', child: Text('Resolved')),
                                DropdownMenuItem<String?>(value: 'closed', child: Text('Closed')),
                              ],
                              onChanged: (String? value) {
                                setState(() {
                                  _filterStatus = value;
                                  _loadIncidents();
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Theme(
                            data: Theme.of(context).copyWith(
                              canvasColor: _inputBg,
                            ),
                            child: DropdownButtonFormField<String?>(
                              initialValue: _filterType,
                              dropdownColor: _inputBg,
                              style: const TextStyle(color: _primaryText, fontSize: 12),
                              icon: const Icon(Icons.keyboard_arrow_down, color: _mutedText, size: 18),
                              decoration: _fieldDecoration(),
                              hint: const Text('All Types', style: TextStyle(color: _mutedText)),
                              items: const [
                                DropdownMenuItem<String?>(value: null, child: Text('All Types')),
                                DropdownMenuItem<String?>(value: 'fire', child: Text('Fire')),
                                DropdownMenuItem<String?>(value: 'medical', child: Text('Medical')),
                                DropdownMenuItem<String?>(value: 'police', child: Text('Police')),
                                DropdownMenuItem<String?>(value: 'disaster', child: Text('Disaster')),
                                DropdownMenuItem<String?>(value: 'sos', child: Text('SOS')),
                                DropdownMenuItem<String?>(value: 'accident', child: Text('Accident')),
                                DropdownMenuItem<String?>(value: 'other', child: Text('Other')),
                              ],
                              onChanged: (String? value) {
                                setState(() {
                                  _filterType = value;
                                  _loadIncidents();
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 40,
                          height: 40,
                          child: Material(
                            color: _inputBg,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: const BorderSide(color: _cardBorder),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.tune, color: _mutedText, size: 18),
                              onPressed: _openFilterSheet,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    if (filtered.isEmpty)
                      EmptyStateIllustration(
                        icon: Icons.assignment_outlined,
                        title: _searchQuery.isNotEmpty ||
                                _dateFrom != null ||
                                _dateTo != null
                            ? 'No reports match your search'
                            : 'No reports yet',
                        subtitle: _searchQuery.isEmpty && _dateFrom == null && _dateTo == null
                            ? 'Tap Report on Home'
                            : 'Try adjusting your search or filters.',
                        actionLabel: _searchQuery.isEmpty && _dateFrom == null && _dateTo == null
                            ? 'Report incident'
                            : null,
                        onAction: _searchQuery.isEmpty && _dateFrom == null && _dateTo == null
                            ? widget.onReportIncidentTap
                            : null,
                      )
                    else ...[
                      const Text(
                        'Recent Reports',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: _mutedText,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ...filtered.map<Widget>((incident) {
                        final map = incident is Map<String, dynamic>
                            ? incident
                            : (incident as Map).cast<String, dynamic>();
                        final reportId = map['report_id'] as int?;
                        final type = map['incident_type'] as String?;
                        final status = _status(incident);
                        final createdAt = map['created_at'] as String?;
                        final involvement = map['involvement']?.toString();
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _reportCard(
                            icon: _iconForType(type),
                            iconBg: _iconColorForType(type).withValues(alpha: 0.2),
                            iconColor: _iconColorForType(type),
                            incident: map,
                            statusLabel: ReportStatusUi.label(status).toUpperCase(),
                            statusColor: _statusSolidColor(status),
                            date: formatReportDateTime(createdAt),
                            location: incidentLocationLabel(map),
                            involvement: involvement,
                            onTap: reportId != null
                                ? () => _handleIncidentTap(map)
                                : null,
                          ),
                        );
                      }),
                      if (_hasMore || _loadingMore) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: _loadingMore
                              ? const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 16),
                                  child: Center(child: CircularProgressIndicator()),
                                )
                              : TextButton.icon(
                                  onPressed: _loadMore,
                                  icon: const Icon(Icons.add_circle_outline, size: 20),
                                  label: const Text('Load more'),
                                ),
                        ),
                      ],
                    ],
                  ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _status(dynamic incident) {
    try {
      return incident['status'] as String?;
    } catch (_) {
      return null;
    }
  }

  Widget _statsRow(List<dynamic> filtered) {
    final totalLabel = _searchQuery.isNotEmpty || _dateFrom != null || _dateTo != null
        ? 'Shown'
        : 'Total';

    return Row(
      children: [
        Expanded(
          child: _statItem(
            icon: Icons.local_fire_department,
            iconColor: const Color(0xFFEF4444),
            value: '${filtered.length}',
            label: totalLabel,
          ),
        ),
        Expanded(
          child: _statItem(
            icon: Icons.circle,
            iconColor: const Color(0xFF2563EB),
            iconSize: 10,
            value: '${_countActive(filtered)}',
            label: 'Active',
          ),
        ),
        Expanded(
          child: _statItem(
            icon: Icons.circle,
            iconColor: const Color(0xFF22C55E),
            iconSize: 10,
            value: '${_countClosed(filtered)}',
            label: 'Closed',
          ),
        ),
      ],
    );
  }

  Widget _statItem({
    required IconData icon,
    required Color iconColor,
    required String value,
    required String label,
    double iconSize = 18,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: iconColor, size: iconSize),
        const SizedBox(width: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: _primaryText,
          ),
        ),
        const SizedBox(width: 3),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: _mutedText,
          ),
        ),
      ],
    );
  }

  void _handleIncidentTap(Map<String, dynamic> incident) {
    final onCitizenTap = widget.onReportTap;
    if (onCitizenTap == null) return;
    unawaited(
      openIncidentByInvolvement(
        context,
        incident: incident,
        involvementFilter: _involvementFilter ?? 'all',
        onCitizenTap: onCitizenTap,
      ),
    );
  }

  Widget _involvementFilterChips() {
    final options = _isPersonnel
        ? [('reported', 'Reported'), ('assigned', 'Assigned')]
        : [('reported', 'Reported'), ('accepted', 'Accepted')];

    return Row(
      children: options.map((option) {
        final value = option.$1;
        final label = option.$2;
        final selected = _involvementFilter == value;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: value == 'reported' ? 8 : 0),
            child: FilterChip(
              label: Text(label),
              selected: selected,
              showCheckmark: true,
              labelStyle: TextStyle(
                fontSize: 12,
                color: selected ? Colors.white : _mutedText,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              labelPadding: const EdgeInsets.symmetric(horizontal: 4),
              selectedColor: const Color(0xFF2563EB),
              backgroundColor: _inputBg,
              side: BorderSide(
                color: selected ? const Color(0xFF2563EB) : _cardBorder,
              ),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              onSelected: (_) {
                setState(() {
                  _involvementFilter = selected ? null : value;
                });
                _loadIncidents();
              },
            ),
          ),
        );
      }).toList(),
    );
  }

  List<Widget> _involvementChipWidgets(String? involvement) {
    if (involvement == null || involvement.isEmpty) return const [];

    final isReported = involvement == 'reported' || involvement == 'both';
    final isAssigned = involvement == 'assigned' || involvement == 'both';
    final isAccepted = involvement == 'accepted' || (involvement == 'both' && !_isPersonnel);
    final widgets = <Widget>[];

    if (isReported) {
      widgets.add(_involvementBadge(
        label: 'Reported',
        icon: Icons.record_voice_over_outlined,
        color: const Color(0xFF2563EB),
      ));
    }
    if (isAssigned) {
      if (widgets.isNotEmpty) widgets.add(const SizedBox(width: 4));
      widgets.add(_involvementBadge(
        label: 'Assigned',
        icon: Icons.emergency_outlined,
        color: const Color(0xFF10B981),
      ));
    } else if (isAccepted) {
      if (widgets.isNotEmpty) widgets.add(const SizedBox(width: 4));
      widgets.add(_involvementBadge(
        label: 'Accepted',
        icon: Icons.emergency_outlined,
        color: const Color(0xFF10B981),
      ));
    }
    return widgets;
  }

  Widget _inlineClassificationRow({
    required Map<String, dynamic> incident,
    String? involvement,
  }) {
    final typeChips = incidentTypeChipWidgets(incident: incident);
    final involvementChips = _isResponder ? _involvementChipWidgets(involvement) : const <Widget>[];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ...typeChips,
          if (typeChips.isNotEmpty && involvementChips.isNotEmpty) const SizedBox(width: 4),
          ...involvementChips,
        ],
      ),
    );
  }

  Widget _involvementBadge({
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _reportCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Map<String, dynamic> incident,
    required String statusLabel,
    required Color statusColor,
    String? date,
    required String location,
    String? involvement,
    VoidCallback? onTap,
  }) {
    const metaStyle = TextStyle(
      fontSize: 10,
      color: _mutedText,
    );

    return PremiumCard(
      onTap: onTap,
      useGlass: false,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      borderRadius: 12,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: iconColor.withValues(alpha: 0.3),
                  blurRadius: 8,
                  spreadRadius: -2,
                ),
              ],
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _inlineClassificationRow(
                  incident: incident,
                  involvement: involvement,
                ),
                if (date != null && date.isNotEmpty && date != '—') ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined, size: 11, color: _mutedText),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          date,
                          style: metaStyle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 11, color: _mutedText),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        location,
                        style: metaStyle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  statusLabel,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              const Icon(Icons.chevron_right, size: 16, color: _mutedText),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportLocationMapScreen extends StatelessWidget {
  final double latitude;
  final double longitude;
  final String title;

  const _ReportLocationMapScreen({
    required this.latitude,
    required this.longitude,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    final point = LatLng(latitude, longitude);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: FlutterMap(
        options: MapOptions(
          initialCenter: point,
          initialZoom: 14,
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
                point: point,
                width: 40,
                height: 40,
                child: const Icon(
                  Icons.location_on,
                  color: Color(0xFFEF4444),
                  size: 40,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
