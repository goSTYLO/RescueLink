import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback? onLogout;
  final VoidCallback? onPhoneNumberTap;
  final VoidCallback? onBarangayTap;
  final VoidCallback? onEmergencyContactsTap;
  final VoidCallback? onChangePasswordTap;
  final VoidCallback? onPrivacySecurityTap;

  const SettingsScreen({super.key, this.onLogout, this.onPhoneNumberTap, this.onBarangayTap, this.onEmergencyContactsTap, this.onChangePasswordTap, this.onPrivacySecurityTap});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushNotification = true;
  bool _smsAlert = true;
  bool _locationAccess = true;
  bool _microphone = true;
  bool _camera = true;

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
          // Settings banner (red)
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
                        'Settings',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Manage your account & preferences',
                        style: TextStyle(color: Colors.white.withOpacity(0.95), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.tune, color: Colors.white, size: 26),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // User Profile card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
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
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'John Doe Cruz',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF111827),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        '+63 965 254 2364',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                      SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Verified Citizen',
                            style: TextStyle(fontSize: 12, color: Color(0xFF22C55E), fontWeight: FontWeight.w500),
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
          _sectionHeading('Account Information'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            _settingsRow(icon: Icons.phone_android, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), title: 'Phone Number', subtitle: '+63 945 584 6936', showArrow: true, onTap: widget.onPhoneNumberTap),
            _settingsRow(icon: Icons.home_outlined, iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF22C55E), title: 'Barangay', subtitle: 'Poblacion Oeste Dagupan City', showArrow: true, onTap: widget.onBarangayTap),
          ]),
          const SizedBox(height: 20),
          _sectionHeading('Emergency Contacts'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            _settingsRow(icon: Icons.people_outline, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFEF4444), title: 'Barangay Emergency Contacts', subtitle: '2 Contacts Added', showArrow: true, onTap: widget.onEmergencyContactsTap),
          ]),
          const SizedBox(height: 20),
          _sectionHeading('Notification'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            _settingsRowWithSwitch(icon: Icons.notifications_outlined, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), title: 'Push Notification', subtitle: 'Emergency Updates & Alerts', value: _pushNotification, onChanged: (v) => setState(() => _pushNotification = v)),
            _settingsRowWithSwitch(icon: Icons.sms_outlined, iconBg: const Color(0xFFFEF3C7), iconColor: const Color(0xFFD97706), title: 'SMS Alert', subtitle: 'Text Message Updates', value: _smsAlert, onChanged: (v) => setState(() => _smsAlert = v)),
          ]),
          const SizedBox(height: 20),
          _sectionHeading('Security'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            _settingsRow(icon: Icons.lock_outline, iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFEF4444), title: 'Change Password', subtitle: 'Update your Password', showArrow: true, onTap: widget.onChangePasswordTap),
          ]),
          const SizedBox(height: 20),
          _sectionHeading('App Permissions'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            _settingsRowWithSwitch(icon: Icons.location_on_outlined, iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF22C55E), title: 'Location Access', subtitle: 'Enabled', value: _locationAccess, onChanged: (v) => setState(() => _locationAccess = v)),
            _settingsRowWithSwitch(icon: Icons.mic_outlined, iconBg: const Color(0xFFF3F4F6), iconColor: const Color(0xFF6B7280), title: 'Microphone', subtitle: 'Enabled', value: _microphone, onChanged: (v) => setState(() => _microphone = v)),
            _settingsRowWithSwitch(icon: Icons.camera_alt_outlined, iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), title: 'Camera', subtitle: 'Enabled', value: _camera, onChanged: (v) => setState(() => _camera = v)),
          ]),
          const SizedBox(height: 20),
          _sectionHeading('About'),
          const SizedBox(height: 8),
          _settingsCard(children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'App Version',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                  ),
                  Text(
                    '1.1.0',
                    style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
            _settingsRow(title: 'Terms of Service', subtitle: '', showArrow: true),
            _settingsRow(title: 'Privacy & Security', subtitle: '', showArrow: true, onTap: widget.onPrivacySecurityTap),
          ]),
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

  Widget _sectionHeading(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: Color(0xFF111827),
      ),
    );
  }

  Widget _settingsCard({required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827),
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                  ],
                ],
              ),
            ),
            if (showArrow) const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
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
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
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
