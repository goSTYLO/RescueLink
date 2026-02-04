import 'package:flutter/material.dart';
import 'report_history_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';

class HomePlaceholderScreen extends StatefulWidget {
  final int? initialTabIndex;
  final VoidCallback? onInitialTabApplied;
  final VoidCallback onLogout;
  final VoidCallback? onSosPressed;
  final VoidCallback? onEmergencyNoAiPressed;
  final void Function(int reportId)? onReportTap;
  final VoidCallback? onPhoneNumberTap;
  final VoidCallback? onBarangayTap;
  final VoidCallback? onEmergencyContactsTap;
  final VoidCallback? onChangePasswordTap;
  final VoidCallback? onPrivacySecurityTap;

  const HomePlaceholderScreen({
    super.key,
    this.initialTabIndex,
    this.onInitialTabApplied,
    required this.onLogout,
    this.onSosPressed,
    this.onEmergencyNoAiPressed,
    this.onReportTap,
    this.onPhoneNumberTap,
    this.onBarangayTap,
    this.onEmergencyContactsTap,
    this.onChangePasswordTap,
    this.onPrivacySecurityTap,
  });

  @override
  State<HomePlaceholderScreen> createState() => _HomePlaceholderScreenState();
}

class _HomePlaceholderScreenState extends State<HomePlaceholderScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.initialTabIndex != null) {
      _currentIndex = widget.initialTabIndex!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onInitialTabApplied?.call();
      });
    }
  }

  int _currentIndex = 0;

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

  Widget _buildHomeContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          _buildLogo(),
          const SizedBox(height: 20),
          // Location Display Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                const Icon(Icons.location_on, color: Color(0xFF374151), size: 26),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Dagupan City, Pangasinan',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Barangay Poblacion Oeste',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // System Status Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield, color: Color(0xFF22C55E), size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'All Systems Active',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF22C55E),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Emergency services ready',
                        style: TextStyle(fontSize: 13, color: Color(0xFF16A34A), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          // Report Emergency: primary AI CTA, then panic (location-only) secondary
          Row(
            children: [
              const Icon(Icons.emergency, color: Color(0xFFEF4444), size: 22),
              const SizedBox(width: 6),
              const Text(
                'Report Emergency',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _primaryEmergencyCircularButton(
            icon: Icons.mic,
            label: 'Report emergency',
            subtitle: 'Describe with voice — AI classifies and routes',
            color: const Color(0xFFEF4444),
            onTap: widget.onSosPressed,
          ),
          const SizedBox(height: 10),
          _panicActionCard(
            label: 'Life in danger?',
            subtitle: 'Send location only — immediate alert',
            onTap: widget.onEmergencyNoAiPressed,
          ),
          const SizedBox(height: 28),
          // Emergency Tips
          Row(
            children: [
              const Icon(Icons.lightbulb_outline, color: Color(0xFFF97316), size: 22),
              const SizedBox(width: 6),
              const Text(
                'Emergency Tips',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _tipCard(
            title: 'Fire Safety',
            subtitle: 'Keep fire extinguishers accessible',
          ),
          const SizedBox(height: 10),
          _tipCard(
            title: 'Fire Safety',
            subtitle: 'Keep fire extinguishers accessible',
          ),
          const SizedBox(height: 10),
          _tipCard(
            title: 'Fire Safety',
            subtitle: 'Keep fire extinguishers accessible',
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  /// Primary CTA: circular button for "Report with AI".
  Widget _primaryEmergencyCircularButton({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    VoidCallback? onTap,
  }) {
    const size = 88.0;
    final enabled = onTap != null;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: enabled ? onTap : null,
              customBorder: const CircleBorder(),
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withOpacity(0.12),
                  border: Border.all(color: color.withOpacity(0.8), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: color.withOpacity(0.25),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(icon, color: enabled ? color : const Color(0xFF9CA3AF), size: 40),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            label,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: enabled ? const Color(0xFF111827) : const Color(0xFF9CA3AF),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 13,
              color: enabled ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// Secondary: subdued "panic / life in danger" — location-only immediate alert.
  Widget _panicActionCard({
    required String label,
    required String subtitle,
    VoidCallback? onTap,
  }) {
    final enabled = onTap != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
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
            children: [
              Icon(Icons.warning_amber_rounded, color: enabled ? const Color(0xFFDC2626) : const Color(0xFF9CA3AF), size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: enabled ? const Color(0xFF374151) : const Color(0xFF9CA3AF),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: enabled ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tipCard({required String title, required String subtitle}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
          child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.shield_outlined, color: Color(0xFF2563EB), size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReportHistoryContent() {
    return ReportHistoryScreen(onReportTap: widget.onReportTap);
  }

  Widget _buildNotificationsContent() {
    return const NotificationsScreen();
  }

  Widget _buildSettingsContent() {
    return SettingsScreen(onLogout: widget.onLogout, onPhoneNumberTap: widget.onPhoneNumberTap, onBarangayTap: widget.onBarangayTap, onEmergencyContactsTap: widget.onEmergencyContactsTap, onChangePasswordTap: widget.onChangePasswordTap, onPrivacySecurityTap: widget.onPrivacySecurityTap);
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      _buildHomeContent(),
      _buildReportHistoryContent(),
      _buildNotificationsContent(),
      _buildSettingsContent(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: pages,
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 12,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(0, Icons.home, 'Home'),
                _navItem(1, Icons.bar_chart, 'Reports'),
                _navItem(2, Icons.notifications_none, 'Notifications'),
                _navItem(3, Icons.settings, 'Settings'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index;
    return InkWell(
      onTap: () => setState(() => _currentIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 24,
              color: isSelected ? const Color(0xFFEF4444) : const Color(0xFF6B7280),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? const Color(0xFFEF4444) : const Color(0xFF6B7280),
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 4),
              Container(
                height: 2,
                width: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444),
                  borderRadius: BorderRadius.circular(1),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
