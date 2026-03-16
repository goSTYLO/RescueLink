import 'package:flutter/material.dart';
import '../../widgets/glass_card.dart';

class AboutScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onPrivacySecurityTap;

  const AboutScreen({
    super.key,
    this.onBack,
    this.onPrivacySecurityTap,
  });

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  static const String _appVersion = '1.0.0';

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onBack?.call();
      },
      child: Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: widget.onBack,
          icon: const Icon(Icons.arrow_back),
        ),
        title: const Text('About'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _aboutRow('App Version', _appVersion),
                  const Divider(height: 1),
                  _aboutRow('Terms of Service', '', onTap: () {}),
                  const Divider(height: 1),
                  _aboutRow('Privacy & Security', '', onTap: widget.onPrivacySecurityTap),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _aboutRow(String title, String subtitle, {VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
        child: Row(
          children: [
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
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (onTap != null)
              Icon(
                Icons.chevron_right,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
          ],
        ),
      ),
    );
  }
}
