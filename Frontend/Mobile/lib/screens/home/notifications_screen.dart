import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  final VoidCallback? onNotificationTap;

  const NotificationsScreen({super.key, this.onNotificationTap});

  Widget _buildLogo() {
    return Row(
      children: [
        Image.asset(
          'assets/logo/logo.png',
          width: 48,
          height: 48,
          fit: BoxFit.contain,
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                children: [
                  TextSpan(text: 'Rescue', style: TextStyle(color: Color(0xFF2563EB))),
                  TextSpan(text: 'Link', style: TextStyle(color: Color(0xFFEF4444))),
                ],
              ),
            ),
            const Text(
              'Emergency Response & Safety',
              style: TextStyle(color: Color(0xFF6B7280), fontSize: 11),
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          _buildLogo(),
          const SizedBox(height: 20),
          // Location bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: const Row(
              children: [
                Icon(Icons.location_on, color: Color(0xFF111827), size: 24),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dagupan City, Pangasinan',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Barangay Poblacion Oeste',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
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
                        style: TextStyle(color: Colors.white.withOpacity(0.95), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.notifications, color: Colors.white, size: 28),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // NEW section
          const Text(
            'NEW',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 12),
          _notificationCard(
            icon: Icons.error_outline,
            iconBg: const Color(0xFFFCE7F3),
            iconColor: const Color(0xFFEC4899),
            cardColor: const Color(0xFFFDF2F8),
            title: 'Emergency Report Submitted',
            description: 'Your fire emergency report #DGP-2026-0119 has been submitted successfully.',
            time: '2 minutes ago',
            showUnreadDot: true,
            onTap: onNotificationTap,
          ),
          const SizedBox(height: 12),
          _notificationCard(
            icon: Icons.local_shipping_outlined,
            iconBg: const Color(0xFFFFEDD5),
            iconColor: const Color(0xFFEA580C),
            cardColor: const Color(0xFFFFF7ED),
            title: 'Responder Dispatched',
            description: 'Fire Truck #3 has been dispatched to your location. ETA: 4 minutes',
            time: '5 minutes ago',
            showUnreadDot: true,
            onTap: onNotificationTap,
          ),
          const SizedBox(height: 12),
          _notificationCard(
            icon: Icons.schedule,
            iconBg: const Color(0xFFDBEAFE),
            iconColor: const Color(0xFF2563EB),
            cardColor: const Color(0xFFEFF6FF),
            title: 'Responder En Route',
            description: 'Fire Team is on the way. Current distance: 2.3 km.',
            time: '8 minutes ago',
            showUnreadDot: true,
            onTap: onNotificationTap,
          ),
          const SizedBox(height: 24),
          // EARLIER section
          const Text(
            'EARLIER',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 12),
          _notificationCard(
            icon: Icons.schedule,
            iconBg: const Color(0xFFDBEAFE),
            iconColor: const Color(0xFF2563EB),
            cardColor: const Color(0xFFF3F4F6),
            title: 'Previous Emergency Resolved',
            description: 'Your medical emergency report #DGP-2026-0118-045 has been successfully resolved.',
            time: '2 hours ago',
            showUnreadDot: false,
            onTap: onNotificationTap,
          ),
          const SizedBox(height: 24),
          // Mark all as Read button
          Center(
            child: OutlinedButton(
              onPressed: () {},
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
              color: Colors.black.withOpacity(0.03),
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
