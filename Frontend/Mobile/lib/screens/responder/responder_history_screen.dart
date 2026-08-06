import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/responder_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';
import 'responder_incident_detail_screen.dart';

/// Paginated list of past (Resolved) incidents the responder handled.
class ResponderHistoryScreen extends StatefulWidget {
  const ResponderHistoryScreen({super.key});

  @override
  State<ResponderHistoryScreen> createState() => _ResponderHistoryScreenState();
}

class _ResponderHistoryScreenState extends State<ResponderHistoryScreen> {
  final ResponderService _service = ResponderService();

  bool _loading = true;
  List<Map<String, dynamic>> _history = [];
  String? _error;
  int _page = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _service.close();
    super.dispose();
  }

  Future<void> _loadHistory({bool reset = false}) async {
    if (reset) {
      setState(() { _page = 1; _hasMore = true; _history = []; });
    }
    setState(() { _loading = true; _error = null; });
    try {
      final data = await _service.getIncidentHistory(page: _page);
      if (mounted) {
        setState(() {
          _history = reset ? data : [..._history, ...data];
          _hasMore = data.length == 20;
          _loading = false;
        });
      }
    } on ResponderServiceException catch (e) {
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _error = 'Failed to load history.'; _loading = false; });
    }
  }

  String _formatDate(String? raw) {
    if (raw == null) return '';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return raw;
    return DateFormat('MMM d, y h:mm a').format(dt.toLocal());
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'Resolved': return const Color(0xFF10B981);
      case 'On Scene': return const Color(0xFFEF4444);
      case 'En Route': return const Color(0xFFF59E0B);
      default: return const Color(0xFF3B82F6);
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
          onRefresh: () => _loadHistory(reset: true),
          color: const Color(0xFFEF4444),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Text('Response History', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: textPrimary)),
                const SizedBox(height: 4),
                Text('Past incidents you responded to', style: TextStyle(fontSize: 13, color: textSec)),
                const SizedBox(height: 24),
                if (_loading && _history.isEmpty)
                  const Column(children: [
                    SkeletonCard(height: 72),
                    SizedBox(height: 12),
                    SkeletonCard(height: 72),
                    SizedBox(height: 12),
                    SkeletonCard(height: 72),
                  ])
                else if (_error != null)
                  Column(children: [
                    Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
                    const SizedBox(height: 12),
                    TextButton(onPressed: () => _loadHistory(reset: true), child: const Text('Retry')),
                  ])
                else if (_history.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Text('No completed incidents yet.', style: TextStyle(color: textSec)),
                    ),
                  )
                else
                  ..._history.map((inc) {
                    final id = (inc['report_id'] as num?)?.toInt() ?? 0;
                    final type = (inc['incident_type'] as String?) ?? 'Incident';
                    final barangay = (inc['barangay'] as String?) ?? '';
                    final status = (inc['responder_status'] as String?) ?? 'Resolved';
                    final date = _formatDate(inc['accepted_at'] as String?);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: GlassCard(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => ResponderIncidentDetailScreen(reportId: id, readOnly: true),
                          ),
                        ),
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
                                  const SizedBox(height: 2),
                                  Text(barangay.isNotEmpty ? '$barangay • $date' : date,
                                      style: TextStyle(fontSize: 11, color: textSec)),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: _statusColor(status).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(status,
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(status))),
                            ),
                            const SizedBox(width: 6),
                            Icon(Icons.chevron_right, color: textSec, size: 18),
                          ],
                        ),
                      ),
                    );
                  }),
                if (_hasMore && !_loading)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Center(
                      child: TextButton(
                        onPressed: () {
                          setState(() => _page++);
                          _loadHistory();
                        },
                        child: const Text('Load more'),
                      ),
                    ),
                  ),
                if (_loading && _history.isNotEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(child: CircularProgressIndicator(color: Color(0xFFEF4444))),
                  ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
