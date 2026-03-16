import 'package:flutter/material.dart';

import '../../services/notification_service.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';

class NotificationsScreen extends StatefulWidget {
  final VoidCallback? onNotificationTap;

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

  String _timeAgo(Map<String, dynamic> notification) {
    final sentAt = _sentAt(notification);
    if (sentAt == null) {
      return 'Unknown time';
    }

    final diff = DateTime.now().difference(sentAt.toLocal());
    if (diff.inMinutes < 1) {
      return 'Just now';
    }
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} minutes ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours} hours ago';
    }
    return '${sentAt.month}/${sentAt.day}/${sentAt.year}';
  }

  bool _isNew(Map<String, dynamic> notification) {
    final sentAt = _sentAt(notification);
    if (sentAt == null) {
      return false;
    }
    return DateTime.now().difference(sentAt.toLocal()).inHours < 1;
  }

  void _showUnavailableMarkReadMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Mark-as-read is not yet available in the current backend contract.'),
      ),
    );
  }

  ({IconData icon, Color iconBg, Color iconColor}) _notificationStyle(
      Map<String, dynamic> notification) {
    final sentVia = (notification['sent_via'] as String?)?.toLowerCase() ?? '';
    if (sentVia.contains('sms')) {
      return (
        icon: Icons.sms_outlined,
        iconBg: const Color(0xFFFEF3C7),
        iconColor: const Color(0xFFD97706),
      );
    }
    if (sentVia.contains('email')) {
      return (
        icon: Icons.mail_outline,
        iconBg: const Color(0xFFEDE9FE),
        iconColor: const Color(0xFF6D28D9),
      );
    }
    if (sentVia.contains('push')) {
      return (
        icon: Icons.notifications_active_outlined,
        iconBg: const Color(0xFFDBEAFE),
        iconColor: const Color(0xFF2563EB),
      );
    }
    return (
      icon: Icons.info_outline,
      iconBg: const Color(0xFFFCE7F3),
      iconColor: const Color(0xFFEC4899),
    );
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
          // Notifications banner (no logo, no subtitle)
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
                final key = 'new_${reportId}_${item['sent_at']}';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    expandKey: key,
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    title: reportId is num
                        ? 'Incident Update #DGP-${reportId.toInt()}'
                        : 'Incident Update',
                    description: message,
                    time: _timeAgo(item),
                    showUnreadDot: true,
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
                final key = 'earlier_${reportId}_${item['sent_at']}';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    expandKey: key,
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    title: reportId is num
                        ? 'Incident Update #DGP-${reportId.toInt()}'
                        : 'Incident Update',
                    description: message,
                    time: _timeAgo(item),
                    showUnreadDot: false,
                    onTap: widget.onNotificationTap,
                  ),
                );
              }),
            ],
          ],
          const SizedBox(height: 24),
          // Mark all as Read button
          Center(
            child: OutlinedButton(
              onPressed: _showUnavailableMarkReadMessage,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                side: const BorderSide(color: Color(0xFFE5E7EB)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                'Mark all as Read',
                style: TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w500),
              ),
            ),
          ),
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
    required bool showUnreadDot,
    VoidCallback? onTap,
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
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (isExpanded) ...[
                  const SizedBox(height: 6),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      height: 1.3,
                    ),
                  ),
                ],
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
          Icon(
            isExpanded ? Icons.expand_less : Icons.expand_more,
            size: 20,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}
