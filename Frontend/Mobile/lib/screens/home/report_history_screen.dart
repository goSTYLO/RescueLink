import 'package:flutter/material.dart';

class ReportHistoryScreen extends StatelessWidget {
  final VoidCallback? onReportTap;

  const ReportHistoryScreen({super.key, this.onReportTap});

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
                Icon(Icons.location_on, color: Color(0xFF6B7280), size: 24),
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
          // Report History title bar (red)
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
                        'Report History',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Your past emergency reports',
                        style: TextStyle(color: Colors.white.withOpacity(0.95), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(Icons.filter_list, color: Colors.white, size: 26),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Summary cards (Total, Resolved, Active)
          Row(
            children: [
              Expanded(
                child: _summaryCard(value: '5', label: 'Total', valueColor: const Color(0xFF14B8A6)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _summaryCard(value: '6', label: 'Resolved', valueColor: const Color(0xFF22C55E)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _summaryCard(value: '1', label: 'Active', valueColor: const Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // List of reports
          _reportCard(
            icon: Icons.local_fire_department,
            iconBg: const Color(0xFFFFEDD5),
            iconColor: const Color(0xFFEA580C),
            type: 'Fire Emergency',
            id: 'DGP-2026-0119-001',
            department: 'Fire Department',
            dateTime: 'Jan 19, 2026 • 2:30 PM',
            status: 'En Route',
            statusColor: const Color(0xFF2563EB),
            onTap: onReportTap,
          ),
          const SizedBox(height: 12),
          _reportCard(
            icon: Icons.favorite_border,
            iconBg: const Color(0xFFFCE7F3),
            iconColor: const Color(0xFFEC4899),
            type: 'Medical Emergency',
            id: 'DGP-2026-0119-001',
            department: 'City Health',
            dateTime: 'Jan 19, 2026 • 2:30 PM',
            status: 'Resolved',
            statusColor: const Color(0xFF22C55E),
            onTap: onReportTap,
          ),
          const SizedBox(height: 12),
          _reportCard(
            icon: Icons.favorite_border,
            iconBg: const Color(0xFFFCE7F3),
            iconColor: const Color(0xFFEC4899),
            type: 'Medical Emergency',
            id: 'DGP-2026-0119-001',
            department: 'City Health',
            dateTime: 'Jan 19, 2026 • 2:30 PM',
            status: 'Resolved',
            statusColor: const Color(0xFF22C55E),
            onTap: onReportTap,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _summaryCard({
    required String value,
    required String label,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
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
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }

  Widget _reportCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String type,
    required String id,
    required String department,
    required String dateTime,
    required String status,
    required Color statusColor,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
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
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      type,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ID: $id',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      department,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dateTime,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF9CA3AF)),
            ],
          ),
        ),
    );
  }
}
