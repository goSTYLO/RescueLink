import 'dart:async';
import 'package:flutter/material.dart';
import 'report_history_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';
import '../../utils/responsive.dart';

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
  Timer? _sosTimer;
  int _sosCountdown = 0;

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

  @override
  void dispose() {
    _sosTimer?.cancel();
    super.dispose();
  }

  void _startSosCountdown() {
    _sosTimer?.cancel();
    setState(() => _sosCountdown = 5);
    _sosTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _sosCountdown--;
        if (_sosCountdown <= 0) {
          t.cancel();
          _sosTimer = null;
          widget.onEmergencyNoAiPressed?.call();
        }
      });
    });
  }

  void _cancelSosCountdown() {
    _sosTimer?.cancel();
    _sosTimer = null;
    setState(() => _sosCountdown = 0);
  }

  int _currentIndex = 0;

  Widget _buildSosCountdownOverlay() {
    return Material(
      color: Colors.black54,
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 32),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Color(0xFFEF4444), size: 56),
              const SizedBox(height: 16),
              Text(
                'SOS in $_sosCountdown',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Tap Cancel to abort',
                style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _cancelSosCountdown,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogo(double width) {
    final logoSize = Responsive.logoSize(width);
    final titleSize = Responsive.brandTitleSize(width);
    final subtitleSize = Responsive.brandSubtitleSize(width);
    final compact = Responsive.isCompact(width);

    return Row(
      mainAxisSize: MainAxisSize.max,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/logo/logo2.png',
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
        ),
        SizedBox(width: compact ? 6 : 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text.rich(
                TextSpan(
                  style: TextStyle(
                      fontSize: titleSize, fontWeight: FontWeight.bold),
                  children: const [
                    TextSpan(
                        text: 'Rescue',
                        style: TextStyle(color: Color(0xFF2563EB))),
                    TextSpan(
                        text: 'Link',
                        style: TextStyle(color: Color(0xFFEF4444))),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                'Emergency Response and Safety',
                style: TextStyle(
                    color: const Color(0xFF6B7280), fontSize: subtitleSize),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _openNotifications(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          backgroundColor: const Color(0xFFF9FAFB),
          appBar: AppBar(
            backgroundColor: const Color(0xFFF9FAFB),
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Color(0xFF374151)),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: const Text(
              'Notifications',
              style: TextStyle(
                  color: Color(0xFF111827), fontWeight: FontWeight.w600),
            ),
          ),
          body: const SafeArea(child: NotificationsScreen()),
        ),
      ),
    );
  }

  /// Outlined red circle with glow — matches second image style.
  Widget _buildOutlinedRedCircleButton({
    required IconData icon,
    required String label,
    required String subtitle,
    required double size,
    required double iconSize,
    int subtitleMaxLines = 2,
    VoidCallback? onTap,
    VoidCallback? onLongPress,
  }) {
    const color = Color(0xFFEF4444);
    final hasAction = onTap != null || onLongPress != null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            onLongPress: onLongPress,
            customBorder: const CircleBorder(),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: 0.35),
                border: Border.all(color: color, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.25),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(icon, color: Colors.white, size: iconSize),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          label,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color:
                hasAction ? const Color(0xFF111827) : const Color(0xFF9CA3AF),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 13,
            color:
                hasAction ? const Color(0xFF6B7280) : const Color(0xFF9CA3AF),
          ),
          textAlign: TextAlign.center,
          maxLines: subtitleMaxLines,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildHomeContent() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final horizontalPadding = Responsive.horizontalPadding(width);
        final spacingScale = Responsive.spacingScale(width);
        final compact = Responsive.isCompact(width);
        final contentWidth =
            (width - (horizontalPadding * 2)).clamp(0.0, width);
        final sosCircleSize = Responsive.sosCircleSize(width);
        final sosIconSize = Responsive.sosIconSize(width);
        final sosItemWidth = compact ? contentWidth : ((contentWidth - 16) / 2);

        return SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: 16 * spacingScale),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _buildLogo(width)),
                  IconButton(
                    icon: const Icon(Icons.notifications_none,
                        color: Color(0xFF374151), size: 28),
                    onPressed: () => _openNotifications(context),
                    visualDensity: compact
                        ? VisualDensity.compact
                        : VisualDensity.standard,
                  ),
                ],
              ),
              SizedBox(height: 20 * spacingScale),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.location_on, color: Color(0xFF374151), size: 26),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Dagupan City, Pangasinan',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF111827),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Barangay Poblacion Oeste',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF374151),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 16 * spacingScale),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF86EFAC)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.shield, color: Color(0xFF22C55E), size: 28),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'All Systems Active',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF16A34A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Emergency services ready',
                            style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF16A34A),
                                fontWeight: FontWeight.w500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 28 * spacingScale),
              Wrap(
                spacing: compact ? 0 : 16,
                runSpacing: 16,
                children: [
                  SizedBox(
                    width: sosItemWidth,
                    child: _buildOutlinedRedCircleButton(
                      icon: Icons.report_problem,
                      label: 'SOS',
                      subtitle: _sosCountdown > 0
                          ? 'Cancelling in $_sosCountdown...'
                          : 'Long press to report. 1 tap: 5 sec to cancel.',
                      size: sosCircleSize,
                      iconSize: sosIconSize,
                      subtitleMaxLines: compact ? 3 : 2,
                      onTap: _sosCountdown > 0 ? null : _startSosCountdown,
                      onLongPress: () {
                        _cancelSosCountdown();
                        widget.onEmergencyNoAiPressed?.call();
                      },
                    ),
                  ),
                  SizedBox(
                    width: sosItemWidth,
                    child: _buildOutlinedRedCircleButton(
                      icon: Icons.bar_chart,
                      label: 'Report Incident',
                      subtitle: 'Press to report incident',
                      size: sosCircleSize,
                      iconSize: sosIconSize,
                      onTap: widget.onSosPressed,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 28 * spacingScale),
              const Row(
                children: [
                  Icon(Icons.lightbulb_outline,
                      color: Color(0xFFF97316), size: 22),
                  SizedBox(width: 6),
                  Text(
                    'Emergency Tips',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12 * spacingScale),
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
              SizedBox(height: 24 * spacingScale),
            ],
          ),
        );
      },
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
            color: Colors.black.withValues(alpha: 0.04),
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
            child: const Icon(Icons.shield_outlined,
                color: Color(0xFF2563EB), size: 24),
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
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

  Widget _buildSettingsContent() {
    return SettingsScreen(
        onLogout: widget.onLogout,
        onPhoneNumberTap: widget.onPhoneNumberTap,
        onBarangayTap: widget.onBarangayTap,
        onEmergencyContactsTap: widget.onEmergencyContactsTap,
        onChangePasswordTap: widget.onChangePasswordTap,
        onPrivacySecurityTap: widget.onPrivacySecurityTap);
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final List<Widget> pages = [
      _buildHomeContent(),
      _buildReportHistoryContent(),
      _buildSettingsContent(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: Stack(
        children: [
          SafeArea(
            child: IndexedStack(
              index: _currentIndex,
              children: pages,
            ),
          ),
          if (_sosCountdown > 0) _buildSosCountdownOverlay(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
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
                _navItem(0, Icons.home, 'Home', screenWidth),
                _navItem(1, Icons.bar_chart, 'Reports', screenWidth),
                _navItem(2, Icons.settings, 'Settings', screenWidth),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label, double screenWidth) {
    final isSelected = _currentIndex == index;
    final horizontalPadding = Responsive.navItemHorizontalPadding(screenWidth);
    final labelSize = Responsive.navLabelSize(screenWidth);
    return InkWell(
      onTap: () => setState(() => _currentIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding:
            EdgeInsets.symmetric(horizontal: horizontalPadding, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 24,
              color: isSelected
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF6B7280),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: labelSize,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF6B7280),
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
