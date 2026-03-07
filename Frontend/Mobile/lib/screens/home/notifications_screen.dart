import 'package:flutter/material.dart';

import '../../services/notification_service.dart';

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

  ({IconData icon, Color iconBg, Color iconColor, Color cardColor})
      _notificationStyle(Map<String, dynamic> notification) {
    final sentVia = (notification['sent_via'] as String?)?.toLowerCase() ?? '';
    if (sentVia.contains('sms')) {
      return (
        icon: Icons.sms_outlined,
        iconBg: const Color(0xFFFEF3C7),
        iconColor: const Color(0xFFD97706),
        cardColor: const Color(0xFFFFFBEB),
      );
    }
    if (sentVia.contains('email')) {
      return (
        icon: Icons.mail_outline,
        iconBg: const Color(0xFFEDE9FE),
        iconColor: const Color(0xFF6D28D9),
        cardColor: const Color(0xFFF5F3FF),
      );
    }
    if (sentVia.contains('push')) {
      return (
        icon: Icons.notifications_active_outlined,
        iconBg: const Color(0xFFDBEAFE),
        iconColor: const Color(0xFF2563EB),
        cardColor: const Color(0xFFEFF6FF),
      );
    }
    return (
      icon: Icons.info_outline,
      iconBg: const Color(0xFFFCE7F3),
      iconColor: const Color(0xFFEC4899),
      cardColor: const Color(0xFFFDF2F8),
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
          Align(alignment: Alignment.centerLeft, child: _buildLogo()),
          const SizedBox(height: 20),
          // Notifications banner (red)
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
                        'Notifications',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Emergency updates & alerts',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.notifications, color: Colors.white, size: 28),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
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
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    cardColor: style.cardColor,
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
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _notificationCard(
                    icon: style.icon,
                    iconBg: style.iconBg,
                    iconColor: style.iconColor,
                    cardColor: style.cardColor,
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
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Color cardColor,
    required String title,
    required String description,
    required String time,
    required bool showUnreadDot,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280), height: 1.3),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    time,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                  ),
                ],
              ),
            ),
            if (showUnreadDot)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6, right: 6),
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
              ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}
