import 'package:flutter/material.dart';
import '../../../widgets/glass_card.dart';

class ApplicationStatusScreen extends StatelessWidget {
  final Map<String, dynamic> application;
  final VoidCallback? onReapply;

  const ApplicationStatusScreen({
    super.key,
    required this.application,
    this.onReapply,
  });

  @override
  Widget build(BuildContext context) {
    final status = (application['status'] ?? 'pending').toString().toLowerCase();
    final notes = application['notes'] as String?;
    final submittedAt = application['submitted_at'] as String?;
    final reviewedAt = application['reviewed_at'] as String?;

    Color statusColor;
    IconData statusIcon;
    String statusTitle;
    String statusSubtitle;

    switch (status) {
      case 'approved':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_rounded;
        statusTitle = 'Application Approved!';
        statusSubtitle = 'Congratulations! You are now an official Volunteer First Responder in RescueLink.';
        break;
      case 'rejected':
        statusColor = Colors.redAccent;
        statusIcon = Icons.cancel_rounded;
        statusTitle = 'Application Not Approved';
        statusSubtitle = 'Thank you for your interest. Unfortunately, your application was not approved at this time.';
        break;
      default:
        statusColor = Colors.amber;
        statusIcon = Icons.hourglass_top_rounded;
        statusTitle = 'Application Under Review';
        statusSubtitle = 'Your application and credentials have been submitted and are being reviewed by the DRRMO team.';
        break;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Responder Application'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      Icon(statusIcon, size: 72, color: statusColor),
                      const SizedBox(height: 16),
                      Text(
                        statusTitle,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: statusColor,
                            ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        statusSubtitle,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Status details card
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Application Details',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const Divider(height: 24),
                      _detailRow(context, 'Application ID', '#${application['id'] ?? 'N/A'}'),
                      if (submittedAt != null)
                        _detailRow(context, 'Submitted On', _formatDate(submittedAt)),
                      _detailRow(
                        context,
                        'Current Status',
                        status.toUpperCase(),
                        valueColor: statusColor,
                      ),
                      if (reviewedAt != null)
                        _detailRow(context, 'Reviewed On', _formatDate(reviewedAt)),

                      // Transparency Note for Rejection
                      if (status == 'rejected' && notes != null && notes.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.red.withOpacity(0.3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.info_outline, size: 20, color: Colors.redAccent),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Reviewer Notes / Reason',
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.redAccent,
                                        ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                notes,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.3),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              if (status == 'rejected' && onReapply != null)
                ElevatedButton.icon(
                  onPressed: onReapply,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Submit New Application'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.all(16),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(BuildContext context, String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey)),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: valueColor,
                ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return isoString;
    }
  }
}
