import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/notification_service.dart';
import '../../utils/report_ui.dart';
import '../../widgets/animated_collapse.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';

class NotificationsScreen extends StatefulWidget {
  /// Called when a notification is tapped. Passes reportId if the notification has one.
  final void Function(int? reportId)? onNotificationTap;

  const NotificationsScreen({super.key, this.onNotificationTap});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationService _notificationService = NotificationService();
  List<Map<String, dynamic>> _notifications = const [];
  bool _loading = true;
  String? _error;
  final Set<String> _expandedKeys = {};

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final notifications = await _notificationService.getNotifications(limit: 50);
      if (!mounted) {
        return;
      }
      setState(() {
        _notifications = notifications;
        _loading = false;
      });
    } on NotificationServiceException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = 'Unable to load notifications right now.';
      });
    }
  }

  @override
  void dispose() {
    _notificationService.close();
    super.dispose();
  }

  DateTime? _sentAt(Map<String, dynamic> notification) {
    final raw = notification['sent_at'];
    if (raw is! String || raw.isEmpty) {
      return null;
    }
    return DateTime.tryParse(raw);
  }

  String _formatTimestamp(Map<String, dynamic> notification) {
    final sentAt = _sentAt(notification);
    if (sentAt == null) {
      return 'Unknown time';
    }
    final local = sentAt.toLocal();
    return DateFormat('MMM d, y h:mm a').format(local);
  }

  String _eventTypeLabel(String? eventType) {
    if (eventType == null || eventType.isEmpty) return 'Update';
    switch (eventType) {
      case 'created': return 'Created';
      case 'dispatched': return 'Dispatched';
      case 'status_updated': return 'Status Updated';
      case 'verified': return 'Verified';
      case 'resolution_confirmed': return 'Resolved';
      case 'note_added': return 'Note Added';
      case 'reclassified': return 'Reclassified';
      case 'duplicate_changed': return 'Duplicate Updated';
      // Phase 3 categories
      case 'application_approved': return 'Approved';
      case 'application_rejected': return 'Rejected';
      case 'application_revoked': return 'Revoked';
      case 'responder_assigned': return 'Responder Assigned';
      case 'responder_status_updated': return 'Responder Update';
      case 'backup_requested': return 'Backup Requested';
      default:
        return eventType.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.length > 1 ? w.substring(1).toLowerCase() : ''}').join(' ');
    }
  }

  String _incidentTypeLabel(String? type) {
    if (type == null || type.isEmpty) return 'Incident';
    final t = type.toString().toLowerCase();
    switch (t) {
      case 'fire': return 'Fire';
      case 'medical': return 'Medical';
      case 'police': return 'Police';
      case 'disaster': return 'Disaster';
      case 'sos': return 'SOS';
      case 'other': return 'Other';
      default: return type[0].toUpperCase() + type.substring(1).toLowerCase();
    }
  }

  String _statusLabel(String? status) {
    if (status == null || status.isEmpty) return '';
    final s = status.toString().toLowerCase().replaceAll('-', '_');
    switch (s) {
      case 'pending': return 'Pending';
      case 'verified': return 'Verified';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status[0].toUpperCase() + status.substring(1).toLowerCase().replaceAll('_', ' ');
    }
  }

  /// Build a short collapsed preview: "Fire • Status updated to In Progress"
  String _collapsedPreview(Map<String, dynamic> item, String? eventType, String? incidentType) {
    final incidentLabel = incidentTypesLabel(item, fallback: _incidentTypeLabel(incidentType));
    final eventLabel = _eventTypeLabel(eventType);
    // Phase 3 application events (no incident)
    if (eventType == 'application_approved') return 'Your responder application was approved ✓';
    if (eventType == 'application_rejected') return 'Your responder application was not approved';
    if (eventType == 'application_revoked') return 'Your volunteer responder status was revoked';
    if (eventType == 'responder_assigned') return '$incidentLabel • A responder is on the way';
    if (eventType == 'responder_status_updated') {
      final msg = (item['message'] as String?) ?? '';
      return msg.isNotEmpty ? msg : '$incidentLabel • Responder status updated';
    }
    if (eventType == 'backup_requested') return '$incidentLabel • Backup has been requested';
    // Existing
    if (eventType == 'status_updated') {
      final status = item['incident_status'] as String?;
      if (status != null && status.isNotEmpty) {
        return '$incidentLabel • Status updated to ${_statusLabel(status)}';
      }
    }
    if (eventType == 'dispatched') return '$incidentLabel • Assigned to department';
    if (eventType == 'verified') return '$incidentLabel • Verified';
    if (eventType == 'resolution_confirmed') return '$incidentLabel • Resolved';
    if (eventType == 'created') return '$incidentLabel • New report';
    return '$incidentLabel • $eventLabel';
  }

  bool _isNew(Map<String, dynamic> notification) {
    final sentAt = _sentAt(notification);
    if (sentAt == null) {
      return false;
    }
    return DateTime.now().difference(sentAt.toLocal()).inHours < 1;
  }

  Future<void> _markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      if (!mounted) return;
      await _loadNotifications();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All notifications marked as read.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on NotificationServiceException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to mark as read.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  ({IconData icon, Color iconBg, Color iconColor}) _notificationStyle(
      Map<String, dynamic> notification) {
    final eventType = (notification['event_type'] as String?)?.toLowerCase() ?? '';
    // Phase 3 — category-based styles (override channel-based for these types)
    if (eventType == 'application_approved') {
      return (icon: Icons.verified_rounded, iconBg: const Color(0xFFD1FAE5), iconColor: const Color(0xFF059669));
    }
    if (eventType == 'application_rejected') {
      return (icon: Icons.cancel_rounded, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFDC2626));
    }
    if (eventType == 'application_revoked') {
      return (icon: Icons.shield_outlined, iconBg: const Color(0xFFFFEDD5), iconColor: const Color(0xFFEA580C));
    }
    if (eventType == 'responder_assigned' || eventType == 'responder_status_updated') {
      return (icon: Icons.shield_rounded, iconBg: const Color(0xFFFFF7ED), iconColor: const Color(0xFFF59E0B));
    }
    if (eventType == 'backup_requested') {
      return (icon: Icons.campaign_rounded, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFEF4444));
    }
    // Channel-based fallback
    final sentVia = (notification['sent_via'] as String?)?.toLowerCase() ?? '';
    if (sentVia.contains('sms')) {
      return (icon: Icons.sms_outlined, iconBg: const Color(0xFFFEF3C7), iconColor: const Color(0xFFD97706));
    }
    if (sentVia.contains('email')) {
      return (icon: Icons.mail_outline, iconBg: const Color(0xFFEDE9FE), iconColor: const Color(0xFF6D28D9));
    }
    if (sentVia.contains('push')) {
      return (icon: Icons.notifications_active_outlined, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB));
    }
    return (icon: Icons.info_outline, iconBg: const Color(0xFFFCE7F3), iconColor: const Color(0xFFEC4899));
  }

  @override
  Widget build(BuildContext context) {
    final newItems = _notifications.where(_isNew).toList();
    final earlierItems = _notifications.where((item) => !_isNew(item)).toList();

    return RefreshIndicator(
      onRefresh: _loadNotifications,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          const SizedBox(height: 16),
          // Notifications banner with Mark all as read
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Notifications',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _loading ? null : _markAllAsRead,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                  child: const Text('Mark all as Read'),
                ),
                const Icon(Icons.notifications, color: Colors.white, size: 28),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (_loading)
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
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Column(
                children: [
                  Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFDC2626)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  TextButton(onPressed: _loadNotifications, child: const Text('Retry')),
                ],
              ),
            )
          else if (_notifications.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(
                child: Text(
                  'No notifications yet.',
                  style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                ),
              ),
            )
          else ...[
            if (newItems.isNotEmpty) ...[
              const Text(
                'NEW',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF374151),
                ),
              ),
              const SizedBox(height: 12),
              ...newItems.map((item) {
                final style = _notificationStyle(item);
                final message = (item['message'] as String?) ?? 'Notification update';
                final reportId = item['report_id'];
                final reportIdInt = reportId is num ? reportId.toInt() : null;
                final eventType = item['event_type'] as String?;
                final incidentType = item['incident_type'] as String?;
                final key = 'new_${reportId}_${item['sent_at']}';
                final isAppEvent = eventType?.startsWith('application_') == true;
                final cardTitle = isAppEvent
                    ? 'Responder Application'
                    : (reportIdInt != null ? 'Incident #DGP-$reportIdInt' : 'Incident Update');
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    expandKey: key,
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    title: cardTitle,
                    description: message,
                    time: _formatTimestamp(item),
                    eventType: eventType,
                    incidentType: incidentType,
                    incidentTypeChips: incidentTypeChips(incident: item),
                    incidentStatus: item['incident_status'] as String?,
                    collapsedPreview: _collapsedPreview(item, eventType, incidentType),
                    showUnreadDot: true,
                    reportId: reportIdInt,
                    onTap: widget.onNotificationTap,
                  ),
                );
              }),
              const SizedBox(height: 20),
            ],
            if (earlierItems.isNotEmpty) ...[
              const Text(
                'EARLIER',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF374151),
                ),
              ),
              const SizedBox(height: 12),
              ...earlierItems.map((item) {
                final style = _notificationStyle(item);
                final message = (item['message'] as String?) ?? 'Notification update';
                final reportId = item['report_id'];
                final reportIdInt = reportId is num ? reportId.toInt() : null;
                final eventType = item['event_type'] as String?;
                final incidentType = item['incident_type'] as String?;
                final key = 'earlier_${reportId}_${item['sent_at']}';
                final isAppEvent = eventType?.startsWith('application_') == true;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    expandKey: key,
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    title: isAppEvent
                        ? 'Responder Application'
                        : (reportIdInt != null
                            ? 'Incident #DGP-$reportIdInt'
                            : 'Incident Update'),
                    description: message,
                    time: _formatTimestamp(item),
                    eventType: eventType,
                    incidentType: incidentType,
                    incidentTypeChips: incidentTypeChips(incident: item),
                    incidentStatus: item['incident_status'] as String?,
                    collapsedPreview: _collapsedPreview(item, eventType, incidentType),
                    showUnreadDot: false,
                    reportId: reportIdInt,
                    onTap: widget.onNotificationTap,
                  ),
                );
              }),
            ],
          ],
          const SizedBox(height: 24),
        ],
        ),
      ),
    );
  }

  Widget _notificationCard({
    required String expandKey,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String description,
    required String time,
    String? eventType,
    String? incidentType,
    Widget? incidentTypeChips,
    String? incidentStatus,
    required String collapsedPreview,
    required bool showUnreadDot,
    int? reportId,
    void Function(int? reportId)? onTap,
  }) {
    final isExpanded = _expandedKeys.contains(expandKey);
    return GlassCard(
      onTap: () {
        setState(() {
          if (isExpanded) {
            _expandedKeys.remove(expandKey);
          } else {
            _expandedKeys.add(expandKey);
          }
        });
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    if (eventType != null && eventType.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .primaryContainer
                              .withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _eventTypeLabel(eventType),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  collapsedPreview,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    height: 1.25,
                  ),
                ),
                AnimatedCollapse(
                  expanded: isExpanded,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 10),
                      if (incidentTypeChips != null ||
                          (incidentType != null && incidentType.isNotEmpty))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Incident type: ',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                                ),
                              ),
                              Expanded(
                                child: incidentTypeChips ??
                                    Text(
                                      _incidentTypeLabel(incidentType),
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Theme.of(context).colorScheme.onSurface,
                                      ),
                                    ),
                              ),
                            ],
                          ),
                        ),
                      if (eventType == 'status_updated' && incidentStatus != null && incidentStatus.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            'Status updated to ${_statusLabel(incidentStatus)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 13,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          height: 1.3,
                        ),
                      ),
                      if (reportId != null && onTap != null) ...[
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: () => onTap(reportId),
                            icon: const Icon(Icons.visibility, size: 16),
                            label: const Text('View'),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  time,
                  style: TextStyle(
                    fontSize: 11,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
          if (showUnreadDot)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6),
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                shape: BoxShape.circle,
              ),
            ),
          const SizedBox(width: 4),
          AnimatedExpandIcon(
            expanded: isExpanded,
            size: 20,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}
