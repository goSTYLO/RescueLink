import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/theme_service.dart';
import '../../widgets/glass_card.dart';

class SettingsScreen extends StatefulWidget {
  final Future<void> Function(ThemeMode mode)? onThemeChanged;
  final VoidCallback? onLogout;
  final VoidCallback? onPhoneNumberTap;
  final VoidCallback? onBarangayTap;
  final VoidCallback? onEmergencyContactsTap;
  final VoidCallback? onChangePasswordTap;
  final VoidCallback? onPrivacySecurityTap;
  final VoidCallback? onAboutTap;

  const SettingsScreen({
    super.key,
    this.onThemeChanged,
    this.onLogout,
    this.onPhoneNumberTap,
    this.onBarangayTap,
    this.onEmergencyContactsTap,
    this.onChangePasswordTap,
    this.onPrivacySecurityTap,
    this.onAboutTap,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushNotification = true;
  bool _smsAlert = true;
  bool _locationAccess = true;
  bool _microphone = true;
  bool _camera = true;
  bool _biometricLogin = false;

  ThemeMode _themeMode = ThemeMode.system;
  bool _loadingTheme = true;
  bool _loadingProfile = true;
  String? _profileError;
  Map<String, dynamic>? _profile;

  final Set<String> _expandedSections = {'account'};

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadBiometricPreference();
    ThemeService.getThemeMode().then((mode) {
      if (mounted) {
        setState(() {
          _themeMode = mode;
          _loadingTheme = false;
        });
      }
    });
  }

  Future<void> _loadBiometricPreference() async {
    final enabled = await AuthService().isBiometricLoginEnabled();
    if (mounted) setState(() => _biometricLogin = enabled);
  }

  Future<void> _onBiometricToggle(bool value) async {
    await AuthService().setBiometricLoginEnabled(value);
    if (value) {
      final token = AuthService().getToken();
      if (token != null && token.isNotEmpty) {
        await AuthService().saveTokenForBiometric(token);
      }
    }
    if (mounted) setState(() => _biometricLogin = value);
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loadingProfile = true;
      _profileError = null;
    });

    final result = await AuthService().getProfile();
    if (!mounted) return;

    if (result['success'] == true) {
      setState(() {
        _profile = (result['user'] as Map?)?.cast<String, dynamic>();
        _loadingProfile = false;
      });
    } else {
      setState(() {
        _profileError = result['error']?.toString() ?? 'Failed to load profile';
        _loadingProfile = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile ?? {};
    final firstName = ((profile['firstName'] ?? profile['first_name']) ?? '') as String;
    final lastName = ((profile['lastName'] ?? profile['last_name']) ?? '') as String;
    final fullName = (firstName.isNotEmpty || lastName.isNotEmpty)
        ? '${firstName.trim()} ${lastName.trim()}'.trim()
        : 'User';
    final phone = ((profile['phone'] ?? profile['phone_number']) ?? '') as String;
    final address = (profile['address'] ?? '') as String;
    final phoneVerified = profile['phone_verified'] == true || profile['phoneVerified'] == true;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          if (_loadingProfile)
            const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: LinearProgressIndicator(minHeight: 3),
            )
          else if (_profileError != null)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Text(
                _profileError!,
                style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12),
              ),
            ),
          // Location bar
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            borderRadius: 16,
            blurSigma: 12,
            child: Row(
              children: [
                Icon(Icons.location_on, color: Theme.of(context).colorScheme.onSurface, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dagupan City, Pangasinan',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        address.isNotEmpty ? address : 'Address not set',
                        style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Settings banner with gradient
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
                    'Settings',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Icon(Icons.tune, color: Colors.white, size: 26),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // User Profile card
          GlassCard(
            padding: const EdgeInsets.all(16),
            borderRadius: 20,
            blurSigma: 12,
            child: Row(
              children: [
                ClipOval(
                  child: Image.asset(
                    'assets/images/profilepicture_illustration.png',
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 64,
                      height: 64,
                      color: const Color(0xFFE5E7EB),
                      child: const Icon(Icons.person, size: 36, color: Color(0xFF6B7280)),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fullName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        phone.isNotEmpty ? phone : 'Phone not set',
                        style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(
                            phoneVerified ? Icons.check_circle : Icons.error_outline,
                            color: phoneVerified ? const Color(0xFF22C55E) : const Color(0xFFF59E0B),
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            phoneVerified ? 'Verified Citizen' : 'Unverified',
                            style: TextStyle(
                              fontSize: 12,
                              color: phoneVerified ? const Color(0xFF22C55E) : const Color(0xFFF59E0B),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _collapsibleSection(
            key: 'account',
            title: 'Account Information',
            icon: Icons.person_outline,
            children: [
              _settingsRow(
                icon: Icons.phone_android,
                iconBg: const Color(0xFFDBEAFE),
                iconColor: const Color(0xFF2563EB),
                title: 'Phone Number',
                subtitle: phone.isNotEmpty ? phone : 'Not set',
                showArrow: true,
                onTap: widget.onPhoneNumberTap,
              ),
              _settingsRow(
                icon: Icons.home_outlined,
                iconBg: const Color(0xFFDCFCE7),
                iconColor: const Color(0xFF22C55E),
                title: 'Barangay',
                subtitle: address.isNotEmpty ? address : 'Not set',
                showArrow: true,
                onTap: widget.onBarangayTap,
              ),
            ],
          ),
          const SizedBox(height: 12),
          _collapsibleSection(
            key: 'emergency',
            title: 'Emergency Contacts',
            icon: Icons.people_outline,
            children: [
              _settingsRow(icon: Icons.people_outline, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFEF4444), title: 'Barangay Emergency Contacts', subtitle: '2 Contacts Added', showArrow: true, onTap: widget.onEmergencyContactsTap),
            ],
          ),
          const SizedBox(height: 12),
          _collapsibleSection(
            key: 'notification',
            title: 'Notification',
            icon: Icons.notifications_outlined,
            children: [
              _settingsRowWithSwitch(icon: Icons.notifications_outlined, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), title: 'Push Notification', subtitle: 'Emergency Updates & Alerts', value: _pushNotification, onChanged: (v) => setState(() => _pushNotification = v)),
              _settingsRowWithSwitch(icon: Icons.sms_outlined, iconBg: const Color(0xFFFEF3C7), iconColor: const Color(0xFFD97706), title: 'SMS Alert', subtitle: 'Text Message Updates', value: _smsAlert, onChanged: (v) => setState(() => _smsAlert = v)),
            ],
          ),
          const SizedBox(height: 12),
          _collapsibleSection(
            key: 'security',
            title: 'Security',
            icon: Icons.lock_outline,
            children: [
              _settingsRow(icon: Icons.lock_outline, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFEF4444), title: 'Change Password', subtitle: 'Update your Password', showArrow: true, onTap: widget.onChangePasswordTap),
            ],
          ),
          const SizedBox(height: 12),
          _collapsibleSection(
            key: 'permissions',
            title: 'App Permissions',
            icon: Icons.security_outlined,
            children: [
              _settingsRowWithSwitch(icon: Icons.location_on_outlined, iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF22C55E), title: 'Location Access', subtitle: 'Enabled', value: _locationAccess, onChanged: (v) => setState(() => _locationAccess = v)),
              _settingsRowWithSwitch(icon: Icons.mic_outlined, iconBg: const Color(0xFFF3F4F6), iconColor: const Color(0xFF6B7280), title: 'Microphone', subtitle: 'Enabled', value: _microphone, onChanged: (v) => setState(() => _microphone = v)),
              _settingsRowWithSwitch(icon: Icons.camera_alt_outlined, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), title: 'Camera', subtitle: 'Enabled', value: _camera, onChanged: (v) => setState(() => _camera = v)),
              _settingsRowWithSwitch(icon: Icons.fingerprint, iconBg: const Color(0xFFEFF6FF), iconColor: const Color(0xFF2563EB), title: 'Biometrics', subtitle: 'Use fingerprint or face for quick login', value: _biometricLogin, onChanged: (v) => _onBiometricToggle(v)),
            ],
          ),
          const SizedBox(height: 12),
          _settingsCard(children: [
            _settingsRow(icon: Icons.info_outline, iconBg: const Color(0xFFF3F4F6), iconColor: const Color(0xFF6B7280), title: 'About', subtitle: 'App version, Terms, Privacy', showArrow: true, onTap: widget.onAboutTap),
          ]),
          const SizedBox(height: 12),
          _collapsibleSection(
            key: 'appearance',
            title: 'Appearance',
            icon: Icons.palette_outlined,
            children: [
              if (_loadingTheme)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))),
                )
              else
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode), label: Text('Light')),
                      ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode), label: Text('Dark')),
                      ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto), label: Text('System')),
                    ],
                    selected: {_themeMode},
                    onSelectionChanged: (Set<ThemeMode> selected) {
                      final mode = selected.first;
                      setState(() => _themeMode = mode);
                      widget.onThemeChanged?.call(mode);
                    },
                  ),
                ),
            ],
          ),
          const SizedBox(height: 24),
          // Log Out button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: widget.onLogout,
              icon: const Icon(Icons.logout, size: 22, color: Colors.white),
              label: const Text(
                'Log Out',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _collapsibleSection({
    required String key,
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    final isExpanded = _expandedSections.contains(key);
    final theme = Theme.of(context);
    return GlassCard(
      padding: EdgeInsets.zero,
      borderRadius: 16,
      blurSigma: 12,
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedSections.remove(key);
                } else {
                  _expandedSections.add(key);
                }
              });
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                children: [
                  Icon(icon, color: Theme.of(context).colorScheme.primary, size: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            const Divider(height: 1),
            ...children,
          ],
        ],
      ),
    );
  }

  Widget _settingsCard({required List<Widget> children}) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      borderRadius: 16,
      blurSigma: 12,
      child: Column(children: children),
    );
  }

  Widget _settingsRow({
    IconData? icon,
    Color? iconBg,
    Color? iconColor,
    required String title,
    required String subtitle,
    required bool showArrow,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap ?? () {},
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            if (icon != null && iconBg != null && iconColor != null) ...[
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                  ],
                ],
              ),
            ),
            if (showArrow) Icon(Icons.arrow_forward_ios, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }

  Widget _settingsRowWithSwitch({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
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
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: const Color(0xFF22C55E),
          ),
        ],
      ),
    );
  }
}
