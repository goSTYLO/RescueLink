import 'package:flutter/material.dart';
import '../../services/incident_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';
import '../../widgets/empty_state_illustration.dart';
import '../../widgets/premium_card.dart';

class ReportHistoryScreen extends StatefulWidget {
  final void Function(int reportId)? onReportTap;
  final VoidCallback? onReportIncidentTap;

  const ReportHistoryScreen({super.key, this.onReportTap, this.onReportIncidentTap});

  @override
  State<ReportHistoryScreen> createState() => _ReportHistoryScreenState();
}

class _ReportHistoryScreenState extends State<ReportHistoryScreen> {
  static const int _pageSize = 20;

  List<dynamic> _incidents = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;
  String? _filterStatus; // null = All; pending, verified, in_progress, resolved, closed
  String? _filterType;   // null = All; fire, medical, police, disaster
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _loadIncidents();
    _searchController.addListener(() {
      if (mounted) setState(() => _searchQuery = _searchController.text.trim());
    });
  }

  @override
  void dispose() {
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

  List<dynamic> get _filteredIncidents {
    if (_searchQuery.isEmpty) return _incidents;
    final q = _searchQuery.toLowerCase();
    return _incidents.where((e) {
      try {
        final map = e is Map ? e : <String, dynamic>{};
        final id = map['report_id'];
        final idStr = id != null ? 'DGP-$id' : '';
        final type = (map['incident_type'] as String? ?? '').toLowerCase();
        final desc = (map['description'] as String? ?? '').toLowerCase();
        final createdAt = (map['created_at'] as String? ?? '').toLowerCase();
        final status = (map['status'] as String? ?? '').toLowerCase();
        return idStr.toLowerCase().contains(q) ||
            type.contains(q) ||
            desc.contains(q) ||
            createdAt.contains(q) ||
            status.contains(q);
      } catch (_) {
        return false;
      }
    }).toList();
  }

  Widget _buildLogo() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/logo2.png',
          width: 64,
          height: 64,
          fit: BoxFit.contain,
        ),
        const SizedBox(width: 0),
        Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Color(0xFF2563EB))),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
            const Text(
              'Emergency Response and Safety',
              style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
            ),
          ],
        ),
      ],
    );
  }

  IconData _iconForType(String? type) {
    if (type == null) return Icons.emergency;
    final t = type.toLowerCase();
    if (t.contains('fire')) return Icons.local_fire_department;
    if (t.contains('medical') || t.contains('health')) return Icons.favorite_border;
    if (t.contains('police')) return Icons.shield_outlined;
    if (t.contains('disaster') || t.contains('flood')) return Icons.water_drop_outlined;
    return Icons.emergency;
  }

  Color _iconColorForType(String? type) {
    if (type == null) return const Color(0xFFEF4444);
    final t = type.toLowerCase();
    if (t.contains('fire')) return const Color(0xFFEA580C);
    if (t.contains('medical') || t.contains('health')) return const Color(0xFFEC4899);
    if (t.contains('police')) return const Color(0xFF2563EB);
    if (t.contains('disaster') || t.contains('flood')) return const Color(0xFF0EA5E9);
    return const Color(0xFFEF4444);
  }

  Color _statusColor(String? status) {
    if (status == null) return const Color(0xFF6B7280);
    final s = status.toLowerCase();
    if (s == 'resolved' || s == 'closed') return const Color(0xFF22C55E);
    if (s == 'pending') return const Color(0xFFF59E0B);
    if (s.contains('route') || s == 'dispatched') return const Color(0xFF2563EB);
    return const Color(0xFF6B7280);
  }

  String _locationTitle() {
    if (_incidents.isEmpty) {
      return 'Location unavailable';
    }
    return 'Latest incident location';
  }

  String _locationSubtitle() {
    if (_incidents.isEmpty) {
      return 'Submit an incident report to see location details.';
    }
    final latest = _incidents.first;
    if (latest is! Map) {
      return 'Incident location data is unavailable.';
    }

    final incident = latest.cast<String, dynamic>();
    final barangay = incident['barangay'] as String?;
    final latitude = incident['latitude'] as num?;
    final longitude = incident['longitude'] as num?;

    if (barangay != null && barangay.isNotEmpty) {
      return '$barangay, Dagupan City';
    }
    if (latitude != null && longitude != null) {
      return '${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)}';
    }
    return 'Incident location data is unavailable.';
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadIncidents,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          const SizedBox(height: 16),
          Align(alignment: Alignment.centerLeft, child: _buildLogo()),
          const SizedBox(height: 20),
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            borderRadius: 16,
            blurSigma: 12,
            child: Row(
              children: [
                Icon(Icons.location_on, color: Theme.of(context).colorScheme.onSurfaceVariant, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _locationTitle(),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _locationSubtitle(),
                        style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFEF4444).withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Report History',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _loading ? null : _loadIncidents,
                  icon: _loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.refresh, color: Colors.white, size: 26),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Search
          TextField(
            controller: _searchController,
            focusNode: _searchFocusNode,
            decoration: InputDecoration(
              hintText: 'Search by ID, type, status, date...',
              prefixIcon: Icon(Icons.search, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6), size: 22),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 20),
                      onPressed: () {
                        _searchController.clear();
                      },
                    )
                  : null,
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Theme.of(context).colorScheme.outline.withOpacity(0.5)),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 12),
          // Filters: Status and Type dropdowns with labels
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Status',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String?>(
                      value: _filterStatus,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Theme.of(context).colorScheme.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Theme.of(context).colorScheme.outline.withOpacity(0.5)),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      hint: const Text('All'),
                      items: const [
                        DropdownMenuItem<String?>(value: null, child: Text('All')),
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
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Type',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String?>(
                      value: _filterType,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Theme.of(context).colorScheme.surface,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: Theme.of(context).colorScheme.outline.withOpacity(0.5)),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      hint: const Text('All'),
                      items: const [
                        DropdownMenuItem<String?>(value: null, child: Text('All')),
                        DropdownMenuItem<String?>(value: 'fire', child: Text('Fire')),
                        DropdownMenuItem<String?>(value: 'medical', child: Text('Medical')),
                        DropdownMenuItem<String?>(value: 'police', child: Text('Police')),
                        DropdownMenuItem<String?>(value: 'disaster', child: Text('Disaster')),
                      ],
                      onChanged: (String? value) {
                        setState(() {
                          _filterType = value;
                          _loadIncidents();
                        });
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_loading && _incidents.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  SkeletonCard(height: 72),
                  SizedBox(height: 12),
                  SkeletonCard(height: 72),
                  SizedBox(height: 12),
                  SkeletonCard(height: 72),
                ],
              ),
            )
          else if (_error != null && _incidents.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Text(_error!, style: const TextStyle(color: Color(0xFFDC2626)), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _loadIncidents,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: _summaryCardCompact(
                    value: '${_filteredIncidents.length}',
                    label: _searchQuery.isNotEmpty ? 'Shown' : 'Total',
                    valueColor: const Color(0xFF14B8A6),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _summaryCardCompact(
                    value: '${_filteredIncidents.where((e) => _status(e)?.toLowerCase() == 'in_progress').length}',
                    label: 'In progress',
                    valueColor: const Color(0xFF2563EB),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _summaryCardCompact(
                    value: '${_filteredIncidents.where((e) => _status(e)?.toLowerCase() == 'closed').length}',
                    label: 'Closed',
                    valueColor: const Color(0xFF22C55E),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_filteredIncidents.isEmpty)
              EmptyStateIllustration(
                icon: Icons.assignment_outlined,
                title: _searchQuery.isNotEmpty ? 'No reports match your search' : 'No reports yet',
                subtitle: _searchQuery.isEmpty
                    ? 'Submit an incident report to see your history here.'
                    : 'Try adjusting your search or filters.',
                actionLabel: _searchQuery.isEmpty ? 'Report incident' : null,
                onAction: _searchQuery.isEmpty ? widget.onReportIncidentTap : null,
              )
            else ...[
              ..._filteredIncidents.map<Widget>((incident) {
                final reportId = incident['report_id'] as int?;
                final type = incident['incident_type'] as String? ?? 'Emergency';
                final status = _status(incident);
                final createdAt = incident['created_at'] as String?;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _reportCard(
                    icon: _iconForType(type),
                    iconBg: _iconColorForType(type).withValues(alpha: 0.2),
                    iconColor: _iconColorForType(type),
                    type: type,
                    status: status ?? 'Pending',
                    statusColor: _statusColor(status),
                    date: formatReportDateTime(createdAt),
                    onTap: reportId != null ? () => widget.onReportTap?.call(reportId) : null,
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
            const SizedBox(height: 24),
          ],
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

  Widget _summaryCardCompact({
    required String value,
    required String label,
    required Color valueColor,
  }) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      borderRadius: 16,
      blurSigma: 12,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
              overflow: TextOverflow.ellipsis,
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
    required String type,
    required String status,
    required Color statusColor,
    String? date,
    VoidCallback? onTap,
  }) {
    return PremiumCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  type,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (date != null && date.isNotEmpty && date != '—') ...[
                  const SizedBox(height: 2),
                  Text(
                    date,
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              status,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Icon(Icons.chevron_right, size: 20, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ],
      ),
    );
  }
}
