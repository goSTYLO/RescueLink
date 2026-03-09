import 'package:flutter/material.dart';
import '../../services/incident_service.dart';

class ReportHistoryScreen extends StatefulWidget {
  final void Function(int reportId)? onReportTap;

  const ReportHistoryScreen({super.key, this.onReportTap});

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
  String? _filterStatus; // null = All; pending, verified, in_progress, resolved
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

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '—';
    try {
      final dt = DateTime.parse(dateStr);
      return '${_month(dt.month)} ${dt.day}, ${dt.year} • ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
  }

  String _month(int m) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m - 1];
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                const Icon(Icons.location_on, color: Color(0xFF6B7280), size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _locationTitle(),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _locationSubtitle(),
                        style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
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
              color: const Color(0xFFEF4444),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Report History',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Your past emergency reports',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 12),
                      ),
                    ],
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
              prefixIcon: const Icon(Icons.search, color: Color(0xFF6B7280), size: 22),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 20),
                      onPressed: () {
                        _searchController.clear();
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 12),
          // Filters: Status
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                const Text('Status: ', style: TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                _filterChip('All', _filterStatus == null, () => setState(() { _filterStatus = null; _loadIncidents(); })),
                _filterChip('Pending', _filterStatus == 'pending', () => setState(() { _filterStatus = 'pending'; _loadIncidents(); })),
                _filterChip('Verified', _filterStatus == 'verified', () => setState(() { _filterStatus = 'verified'; _loadIncidents(); })),
                _filterChip('In progress', _filterStatus == 'in_progress', () => setState(() { _filterStatus = 'in_progress'; _loadIncidents(); })),
                _filterChip('Resolved', _filterStatus == 'resolved', () => setState(() { _filterStatus = 'resolved'; _loadIncidents(); })),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Filters: Type
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                const Text('Type: ', style: TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                _filterChip('All', _filterType == null, () => setState(() { _filterType = null; _loadIncidents(); })),
                _filterChip('Fire', _filterType == 'fire', () => setState(() { _filterType = 'fire'; _loadIncidents(); })),
                _filterChip('Medical', _filterType == 'medical', () => setState(() { _filterType = 'medical'; _loadIncidents(); })),
                _filterChip('Police', _filterType == 'police', () => setState(() { _filterType = 'police'; _loadIncidents(); })),
                _filterChip('Disaster', _filterType == 'disaster', () => setState(() { _filterType = 'disaster'; _loadIncidents(); })),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_loading && _incidents.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator()),
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
                  child: _summaryCard(
                    value: '${_filteredIncidents.length}',
                    label: _searchQuery.isNotEmpty ? 'Shown' : 'Total',
                    valueColor: const Color(0xFF14B8A6),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _summaryCard(
                    value: '${_filteredIncidents.where((e) => _status(e)?.toLowerCase() == 'resolved' || _status(e)?.toLowerCase() == 'closed').length}',
                    label: 'Resolved',
                    valueColor: const Color(0xFF22C55E),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _summaryCard(
                    value: '${_filteredIncidents.where((e) => _status(e)?.toLowerCase() != 'resolved' && _status(e)?.toLowerCase() != 'closed').length}',
                    label: 'Active',
                    valueColor: const Color(0xFF2563EB),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_filteredIncidents.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    _searchQuery.isNotEmpty ? 'No reports match your search' : 'No reports yet',
                    style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                  ),
                ),
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
                    id: 'DGP-${reportId ?? '—'}',
                    department: 'Emergency',
                    dateTime: _formatDate(createdAt),
                    status: status ?? 'Pending',
                    statusColor: _statusColor(status),
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

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: const Color(0xFFEF4444).withValues(alpha: 0.25),
        checkmarkColor: const Color(0xFFEF4444),
      ),
    );
  }

  Widget _summaryCard({
    required String value,
    required String label,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
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
    required String id,
    required String department,
    required String dateTime,
    required String status,
    required Color statusColor,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    type,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'ID: $id',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    department,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    dateTime,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
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
            const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}
