import 'dart:async';
import 'package:flutter/material.dart';
import 'report_history_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';
import '../../services/auth_service.dart';
import '../../utils/responsive.dart';
import '../../widgets/animated_fab.dart';
import '../../widgets/glass_card.dart';

class HomePlaceholderScreen extends StatefulWidget {
  final Future<void> Function(ThemeMode mode)? onThemeChanged;
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
  final VoidCallback? onAboutTap;

  const HomePlaceholderScreen({
    super.key,
    this.onThemeChanged,
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
    this.onAboutTap,
  });

  @override
  State<HomePlaceholderScreen> createState() => _HomePlaceholderScreenState();
}

class _HomePlaceholderScreenState extends State<HomePlaceholderScreen> {
  Timer? _sosTimer;
  int _sosCountdown = 0;
  bool _loadingLocation = true;
  bool _safetyTipsExpanded = false;
  String? _locationError;
  String _locationTitle = 'Dagupan City, Pangasinan';
  String _locationSubtitle = 'Loading location...';

  @override
  void initState() {
    super.initState();
    _loadHomeLocation();
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

  Future<void> _loadHomeLocation() async {
    setState(() {
      _loadingLocation = true;
      _locationError = null;
    });

    final result = await AuthService().getProfile();
    if (!mounted) {
      return;
    }

    if (result['success'] == true) {
      final profile = (result['user'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};
      final addressRaw = profile['address'];
      final address = addressRaw is String ? addressRaw.trim() : '';

      setState(() {
        _loadingLocation = false;
        _locationTitle = 'Dagupan City, Pangasinan';
        _locationSubtitle =
            address.isNotEmpty ? address : 'Address not set in profile';
      });
      return;
    }

    setState(() {
      _loadingLocation = false;
      _locationError = result['error']?.toString() ?? 'Failed to load location';
      _locationTitle = 'Dagupan City, Pangasinan';
      _locationSubtitle = 'Unable to load profile location';
    });
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
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            elevation: 0,
            leading: IconButton(
              icon: Icon(Icons.arrow_back, color: Theme.of(context).colorScheme.onSurface),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: Text(
              'Notifications',
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600),
            ),
          ),
          body: const SafeArea(child: NotificationsScreen()),
        ),
      ),
    );
  }

  Widget _buildHomeContent() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final theme = Theme.of(context);
        final width = constraints.maxWidth;
        final horizontalPadding = Responsive.horizontalPadding(width);
        final spacingScale = Responsive.spacingScale(width);
        final compact = Responsive.isCompact(width);
        return RefreshIndicator(
          onRefresh: _loadHomeLocation,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
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
                    icon: Icon(Icons.notifications_none,
                        color: Theme.of(context).colorScheme.onSurface, size: 28),
                    onPressed: () => _openNotifications(context),
                    visualDensity: compact
                        ? VisualDensity.compact
                        : VisualDensity.standard,
                  ),
                ],
              ),
              SizedBox(height: 20 * spacingScale),
              GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                borderRadius: 16,
                blurSigma: 12,
                child: Row(
                  children: [
                    Icon(Icons.location_on,
                        color: Theme.of(context).colorScheme.onSurface, size: 26),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _loadingLocation
                            ? 'Loading...'
                            : _locationTitle,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh, size: 20),
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      tooltip: 'Refresh location',
                      onPressed: _loadingLocation ? null : _loadHomeLocation,
                    ),
                  ],
                ),
              ),
              SizedBox(height: 16 * spacingScale),
              GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                borderRadius: 16,
                blurSigma: 12,
                child: Row(
                  children: [
                    const Icon(Icons.shield, color: Color(0xFF22C55E), size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'All Systems Active',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 28 * spacingScale),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  AnimatedFab(
                    icon: Icons.report_problem,
                    hintLabel: 'SOS',
                    onPressed: _sosCountdown > 0 ? null : _startSosCountdown,
                    onLongPress: _sosCountdown > 0 ? null : _startSosCountdown,
                  ),
                  AnimatedFab(
                    icon: Icons.bar_chart,
                    hintLabel: 'Report',
                    onPressed: widget.onSosPressed,
                  ),
                ],
              ),
              SizedBox(height: 28 * spacingScale),
              _safetyTipsAccordion(spacingScale),
              SizedBox(height: 24 * spacingScale),
              ],
            ),
          ),
        );
      },
    );
  }

  static const List<({String title, String content})> _safetyTips = [
    (title: 'Fire Safety', content: 'Keep fire extinguishers accessible. Know your escape routes. Never use elevators during a fire. Stay low to avoid smoke.'),
    (title: 'Medical Emergency', content: 'Call for help first. Do not move an injured person unless necessary. Apply pressure to stop bleeding. Know your blood type and allergies.'),
    (title: 'Earthquake', content: 'Drop, Cover, and Hold On. Stay away from windows. If outdoors, move to open area. After shaking stops, check for hazards.'),
    (title: 'Flood Safety', content: 'Never walk or drive through floodwaters. Move to higher ground. Avoid downed power lines. Have an emergency kit ready.'),
    (title: 'Typhoon Preparedness', content: 'Stock food, water, and medicine. Secure loose objects. Stay indoors. Monitor official advisories.'),
  ];

  Widget _safetyTipsAccordion(double spacingScale) {
    final theme = Theme.of(context);
    return GlassCard(
      padding: EdgeInsets.zero,
      borderRadius: 20,
      blurSigma: 12,
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _safetyTipsExpanded = !_safetyTipsExpanded),
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.lightbulb_outline,
                      color: theme.colorScheme.primary, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Emergency Tips',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    _safetyTipsExpanded ? Icons.expand_less : Icons.expand_more,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
          if (_safetyTipsExpanded) ...[
            Divider(height: 1, color: theme.colorScheme.outline.withValues(alpha: 0.3)),
            ..._safetyTips.map((tip) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tip.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tip.content,
                    style: TextStyle(
                      fontSize: 13,
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildReportHistoryContent() {
    return ReportHistoryScreen(
      onReportTap: widget.onReportTap,
      onReportIncidentTap: widget.onSosPressed,
    );
  }

  Widget _buildSettingsContent() {
    return SettingsScreen(
        onThemeChanged: widget.onThemeChanged,
        onLogout: widget.onLogout,
        onPhoneNumberTap: widget.onPhoneNumberTap,
        onBarangayTap: widget.onBarangayTap,
        onEmergencyContactsTap: widget.onEmergencyContactsTap,
        onChangePasswordTap: widget.onChangePasswordTap,
        onPrivacySecurityTap: widget.onPrivacySecurityTap,
        onAboutTap: widget.onAboutTap);
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
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
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, -4),
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
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: labelSize,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected
                    ? const Color(0xFFEF4444)
                    : Theme.of(context).colorScheme.onSurfaceVariant,
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
