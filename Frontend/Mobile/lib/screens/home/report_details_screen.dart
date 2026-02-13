import 'package:flutter/material.dart';

class ReportDetailsScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const ReportDetailsScreen({super.key, this.onBack});

  @override
  State<ReportDetailsScreen> createState() => _ReportDetailsScreenState();
}

class _ReportDetailsScreenState extends State<ReportDetailsScreen> {
  bool _isPlaying = false;
  final double _playbackProgress = 0.45 / 1.38; // 0:45 / 1:38

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Report Details',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'DGP-2026-0118-045',
                          style: TextStyle(color: Colors.white.withOpacity(0.95), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Image.asset(
                    'assets/logo/logo2.png',
                    width: 32,
                    height: 32,
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
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Successfully Resolved card
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 48),
                          SizedBox(height: 12),
                          Text(
                            'Successfully Resolved',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF22C55E),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Emergency handled by City Health',
                            style: TextStyle(fontSize: 13, color: Color(0xFF16A34A)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Incident Summary card
                    _whiteCard(
                      title: 'Incident Summary',
                      icon: Icons.local_fire_department,
                      iconColor: const Color(0xFFEA580C),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _detailRow(
                            icon: Icons.whatshot_outlined,
                            iconBg: const Color(0xFFFFEDD5),
                            label: 'Emergency Type',
                            value: 'Medical Emergency',
                          ),
                          const SizedBox(height: 12),
                          _detailRow(
                            icon: Icons.calendar_today,
                            iconBg: const Color(0xFFDBEAFE),
                            label: 'Date & Time',
                            value: 'January 18, 2026 • 10:15 AM',
                          ),
                          const SizedBox(height: 12),
                          _detailRow(
                            icon: Icons.location_on,
                            iconBg: const Color(0xFFDBEAFE),
                            label: 'Location',
                            value: 'Poblacion Oeste, Dagupan City',
                            subtitle: '16.0422° N, 120.3337° E',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Voice Recording card
                    _whiteCard(
                      title: 'Voice Recording',
                      icon: Icons.mic,
                      iconColor: const Color(0xFFEF4444),
                      child: Column(
                        children: [
                          InkWell(
                            onTap: () => setState(() => _isPlaying = !_isPlaying),
                            borderRadius: BorderRadius.circular(30),
                            child: Container(
                              width: 56,
                              height: 56,
                              decoration: const BoxDecoration(
                                color: Color(0xFFEF4444),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                _isPlaying ? Icons.pause : Icons.play_arrow,
                                color: Colors.white,
                                size: 32,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _playbackProgress,
                              backgroundColor: const Color(0xFFE5E7EB),
                              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFEF4444)),
                              minHeight: 6,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Duration 0:45 / 1:38',
                            style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Attach Media card
                    _whiteCard(
                      title: 'Attach Media',
                      icon: Icons.attach_file,
                      iconColor: const Color(0xFF374151),
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.camera_alt, size: 24, color: Color(0xFF6B7280)),
                              label: const Text(
                                'Photo',
                                style: TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w500),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                side: const BorderSide(color: Color(0xFFE5E7EB)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.videocam, size: 24, color: Color(0xFF6B7280)),
                              label: const Text(
                                'Video',
                                style: TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w500),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                side: const BorderSide(color: Color(0xFFE5E7EB)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Response Details card
                    _whiteCard(
                      title: 'Response Details',
                      icon: Icons.info_outline,
                      iconColor: const Color(0xFF374151),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _simpleRow('Department', 'City Health'),
                          const SizedBox(height: 10),
                          _simpleRow('Response Time', '6 minutes'),
                          const SizedBox(height: 10),
                          _simpleRow('Responder', 'EMT Unit 2'),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              const Text(
                                'Severity',
                                style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                              ),
                              const SizedBox(width: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFEDD5),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFFDBA74)),
                                ),
                                child: const Text(
                                  'Medium',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFEA580C),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          _simpleRow('Victims', '1 person'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Emergency Resolved footer card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 28),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Emergency Resolved',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF166534),
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Patient was transported to Pangasinan Provincial Hospital. Vital signs stable. Resolved on Jan 18, 2026 at 10:36 AM',
                                  style: TextStyle(fontSize: 13, color: Color(0xFF15803D)),
                                ),
                              ],
                            ),
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
    );
  }

  Widget _whiteCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    return Container(
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _detailRow({
    required IconData icon,
    required Color iconBg,
    required String label,
    required String value,
    String? subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconBg,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconBg == const Color(0xFFFFEDD5) ? const Color(0xFFEA580C) : const Color(0xFF2563EB), size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _simpleRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
        ),
      ],
    );
  }
}
