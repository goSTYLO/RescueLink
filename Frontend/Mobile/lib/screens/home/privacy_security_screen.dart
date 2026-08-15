import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';

class PrivacySecurityScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const PrivacySecurityScreen({super.key, this.onBack});

  @override
  State<PrivacySecurityScreen> createState() => _PrivacySecurityScreenState();
}

class _PrivacySecurityScreenState extends State<PrivacySecurityScreen> {
  bool _mediaAccess = true;
  bool _aiIncidentAnalysis = true;
  bool _biometricLogin = false;
  String _locationOption = 'During Emergencies Only';
  String _autoLogoutOption = '30 minutes';
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _loadBiometricPreference();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final result = await AuthService().getProfile();
    if (mounted && result['success'] == true) {
      setState(() => _profile = (result['user'] as Map?)?.cast<String, dynamic>());
    }
  }

  Future<void> _loadBiometricPreference() async {
    final enabled = await AuthService().isBiometricLoginEnabled();
    if (mounted) setState(() => _biometricLogin = enabled);
  }

  Future<void> _onBiometricToggle(bool value) async {
    if (!value) {
      await AuthService().setBiometricLoginEnabled(false);
      if (mounted) setState(() => _biometricLogin = false);
      return;
    }

    final phone = ((_profile ?? {})['phone'] ?? (_profile ?? {})['phone_number'] ?? '') as String;
    if (phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not get phone number. Please try again.')),
        );
      }
      return;
    }

    final password = await _showBiometricPasswordDialog();
    if (password == null || !mounted) return;

    await AuthService().setBiometricLoginEnabled(true);
    final result = await AuthService().login(phone: phone, password: password);
    if (!mounted) return;

    if (result['success'] == true) {
      if (mounted) setState(() => _biometricLogin = true);
    } else {
      await AuthService().setBiometricLoginEnabled(false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['error']?.toString() ?? 'Invalid password.')),
        );
      }
    }
  }

  Future<String?> _showBiometricPasswordDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Enable Biometric Login'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter your password to store it securely. It will be used to start a new session when you use biometrics after exiting the app.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => Navigator.of(ctx).pop(controller.text),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onBack?.call();
      },
      child: Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // Red header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                borderRadius: BorderRadius.only(bottomLeft: Radius.circular(20), bottomRight: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.onBack,
                    icon: const CircleAvatar(
                      backgroundColor: Colors.white,
                      child: Icon(Icons.arrow_back, color: Color(0xFF111827), size: 22),
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Privacy & Security',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Image.asset(
                    'assets/logo/icon.png',
                    width: 64,
                    height: 64,
                    fit: BoxFit.contain,
                    color: Colors.white,
                    colorBlendMode: BlendMode.srcIn,
                    errorBuilder: (_, __, ___) => const Icon(Icons.shield, color: Colors.white, size: 28),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Illustration
                    Center(
                      child: Image.asset(
                        'assets/images/privacy&policy_illustration.png',
                        height: 160,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(Icons.security, size: 80, color: Color(0xFF9CA3AF)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // PRIVACY CONTROLS
                    _sectionLabel('PRIVACY CONTROLS'),
                    const SizedBox(height: 10),
                    _privacyCard(
                      icon: Icons.location_on_outlined,
                      iconBg: const Color(0xFF2563EB),
                      title: 'Location',
                      subtitle: 'Control when RescueLink can access your location',
                      value: _locationOption,
                      isDropdown: true,
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          builder: (ctx) => _locationSheet(
                            onSelect: (v) {
                              setState(() => _locationOption = v);
                              Navigator.pop(ctx);
                            },
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 10),
                    _privacyCard(
                      icon: Icons.camera_alt_outlined,
                      iconBg: const Color(0xFF2563EB),
                      title: 'Media Access Permissions',
                      subtitle: 'Allow camera, microphone, and storage for evidence capture',
                      value: null,
                      toggleValue: _mediaAccess,
                      onToggle: (v) => setState(() => _mediaAccess = v),
                    ),
                    const SizedBox(height: 10),
                    _privacyCard(
                      icon: Icons.share_outlined,
                      iconBg: const Color(0xFF2563EB),
                      title: 'AI Incident Analysis',
                      subtitle: 'Share anonymized data to improve emergency response AI',
                      value: null,
                      toggleValue: _aiIncidentAnalysis,
                      onToggle: (v) => setState(() => _aiIncidentAnalysis = v),
                    ),
                    const SizedBox(height: 24),
                    // SECURITY CONTROLS
                    _sectionLabel('SECURITY CONTROLS'),
                    const SizedBox(height: 10),
                    _privacyCard(
                      icon: Icons.fingerprint,
                      iconBg: const Color(0xFF2563EB),
                      title: 'Biometric Login',
                      subtitle: 'Use biometrics for quick, secure access',
                      value: null,
                      toggleValue: _biometricLogin,
                      onToggle: _onBiometricToggle,
                    ),
                    const SizedBox(height: 10),
                    _privacyCard(
                      icon: Icons.schedule,
                      iconBg: const Color(0xFFF59E0B),
                      title: 'Auto-Logout Timer',
                      subtitle: 'Automatically log out after inactivity',
                      value: _autoLogoutOption,
                      isDropdown: true,
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          builder: (ctx) => _autoLogoutSheet(
                            onSelect: (v) {
                              setState(() => _autoLogoutOption = v);
                              Navigator.pop(ctx);
                            },
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    // DEVICE SESSION MANAGEMENT
                    _sectionLabel('DEVICE SESSION MANAGEMENT'),
                    const SizedBox(height: 4),
                    const Text(
                      'View and manage active sessions on your devices',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 10),
                    _sessionCard(
                      device: 'iPhone 12 pro',
                      status: 'Active',
                      location: 'Dagupan City',
                      time: 'Active now',
                      isActive: true,
                    ),
                    const SizedBox(height: 10),
                    _sessionCard(
                      device: 'Chrome Browser',
                      location: 'Dagupan City',
                      time: '2 hours ago',
                      onEnd: () {},
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEF4444),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('End All Other Sessions', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Privacy notice
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF93C5FD)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Your Privacy Matters',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E40AF),
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'RescueLink is committed to protecting your privacy. We only collect data necessary for emergency response and never share your personal information with third parties without your consent. All data is encrypted and stored securely following government standards.',
                            style: TextStyle(fontSize: 13, color: Color(0xFF1E3A8A), height: 1.4),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        color: Color(0xFF6B7280),
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _privacyCard({
    required IconData icon,
    required Color iconBg,
    required String title,
    required String subtitle,
    String? value,
    bool isDropdown = false,
    bool? toggleValue,
    VoidCallback? onTap,
    ValueChanged<bool>? onToggle,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
                if (value != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                  ),
                ],
              ],
            ),
          ),
          if (isDropdown && onTap != null)
            InkWell(
              onTap: onTap,
              child: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF6B7280), size: 24),
            ),
          if (toggleValue != null && onToggle != null) ...[
            const SizedBox(width: 8),
            Switch(
              value: toggleValue,
              onChanged: onToggle,
              activeThumbColor: const Color(0xFF2563EB),
            ),
          ],
        ],
      ),
    );
  }

  Widget _locationSheet({required ValueChanged<String> onSelect}) {
    const options = ['Always', 'During Emergencies Only', 'Never'];
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: options.map((o) => ListTile(title: Text(o), onTap: () => onSelect(o))).toList(),
      ),
    );
  }

  Widget _autoLogoutSheet({required ValueChanged<String> onSelect}) {
    const options = ['5 minutes', '15 minutes', '30 minutes', '1 hour'];
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: options.map((o) => ListTile(title: Text(o), onTap: () => onSelect(o))).toList(),
      ),
    );
  }

  Widget _sessionCard({
    required String device,
    required String location,
    required String time,
    String? status,
    bool isActive = false,
    VoidCallback? onEnd,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      device,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                    ),
                    if (status != null) ...[
                      const SizedBox(width: 8),
                      Icon(Icons.check_circle, size: 16, color: isActive ? const Color(0xFF22C55E) : null),
                      const SizedBox(width: 4),
                      Text(
                        status,
                        style: TextStyle(fontSize: 12, color: isActive ? const Color(0xFF22C55E) : const Color(0xFF6B7280), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  location,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
                Text(
                  time,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
          if (onEnd != null)
            TextButton(
              onPressed: onEnd,
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFFFEE2E2),
                foregroundColor: const Color(0xFFEF4444),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('End', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}
