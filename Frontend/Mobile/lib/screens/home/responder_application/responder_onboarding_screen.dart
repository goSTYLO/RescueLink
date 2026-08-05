import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import '../../../services/responder_application_service.dart';
import '../../../widgets/glass_card.dart';

class ResponderOnboardingScreen extends StatefulWidget {
  final Map<String, dynamic>? initialProfile;
  final VoidCallback? onSubmitted;

  const ResponderOnboardingScreen({
    super.key,
    this.initialProfile,
    this.onSubmitted,
  });

  @override
  State<ResponderOnboardingScreen> createState() => _ResponderOnboardingScreenState();
}

class _ResponderOnboardingScreenState extends State<ResponderOnboardingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();
  final ResponderApplicationService _appService = ResponderApplicationService();

  // Tab 1 State
  bool _agreedToTerms = false;

  // Tab 3 Upload State
  File? _govIdFile;
  final List<File> _certificateFiles = [];
  final List<File> _otherDocFiles = [];

  // Tab 4 Form State
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  late TextEditingController _addressController;
  late TextEditingController _emergencyNameController;
  late TextEditingController _emergencyPhoneController;
  late TextEditingController _emergencyRelationController;

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);

    final profile = widget.initialProfile ?? {};
    final firstName = profile['first_name'] ?? profile['firstName'] ?? '';
    final lastName = profile['last_name'] ?? profile['lastName'] ?? '';
    final fullName = '$firstName $lastName'.trim();

    _nameController = TextEditingController(text: fullName);
    _phoneController = TextEditingController(text: (profile['phone_number'] ?? profile['phone'] ?? '').toString());
    _emailController = TextEditingController(text: (profile['email'] ?? '').toString());
    _addressController = TextEditingController(text: (profile['address'] ?? '').toString());
    _emergencyNameController = TextEditingController();
    _emergencyPhoneController = TextEditingController();
    _emergencyRelationController = TextEditingController();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emergencyRelationController.dispose();
    super.dispose();
  }

  Future<void> _pickGovId() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (image != null) {
      setState(() {
        _govIdFile = File(image.path);
      });
    }
  }

  Future<void> _pickCertificate() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage(imageQuality: 85);
    if (images.isNotEmpty) {
      setState(() {
        for (final img in images) {
          if (_certificateFiles.length < 5) {
            _certificateFiles.add(File(img.path));
          }
        }
      });
    }
  }

  Future<void> _pickOtherDoc() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage(imageQuality: 85);
    if (images.isNotEmpty) {
      setState(() {
        for (final img in images) {
          if (_otherDocFiles.length < 3) {
            _otherDocFiles.add(File(img.path));
          }
        }
      });
    }
  }

  Future<void> _submitApplication() async {
    if (!_agreedToTerms) {
      _tabController.animateTo(0);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the Terms & Conditions first.')),
      );
      return;
    }

    if (_govIdFile == null) {
      _tabController.animateTo(2);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Government ID photo upload is required.')),
      );
      return;
    }

    if (!_formKey.currentState!.validate()) {
      _tabController.animateTo(3);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final personalDetails = {
        'full_name': _nameController.text.trim(),
        'phone_number': _phoneController.text.trim(),
        'email': _emailController.text.trim(),
        'address': _addressController.text.trim(),
        'emergency_contact_name': _emergencyNameController.text.trim(),
        'emergency_contact_phone': _emergencyPhoneController.text.trim(),
        'emergency_contact_relationship': _emergencyRelationController.text.trim(),
      };

      await _appService.submitApplication(
        personalDetails: personalDetails,
        govIdFile: _govIdFile!,
        certificateFiles: _certificateFiles,
        otherDocFiles: _otherDocFiles,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Application submitted successfully!')),
        );
        widget.onSubmitted?.call();
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('ApiException: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply as First Responder'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: '1. Terms'),
            Tab(text: '2. Overview'),
            Tab(text: '3. Checklist'),
            Tab(text: '4. Form'),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_errorMessage != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                color: Colors.red.withOpacity(0.2),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
              ),

            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildTabTerms(),
                  _buildTabOverview(),
                  _buildTabRequirements(),
                  _buildTabForm(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Tab 1: Terms & Conditions
  Widget _buildTabTerms() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Terms & Conditions',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Welcome to RescueLink Volunteer Responder Program. By applying, you agree to act in good faith and adhere to standard emergency protocols set by Dagupan City DRRMO.\n\n'
                    '1. Confidentiality: You must respect citizen privacy and maintain non-disclosure of sensitive incident details.\n'
                    '2. Code of Conduct: High standard of conduct and neutrality is required during incident response.\n'
                    '3. Credential Accuracy: All submitted government identification and training certificates must be authentic.\n'
                    '4. Safety First: Never compromise personal safety or enter hazardous situations without proper authorization and equipment.',
                    style: TextStyle(height: 1.5),
                  ),
                  const SizedBox(height: 16),
                  CheckboxListTile(
                    value: _agreedToTerms,
                    onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
                    title: const Text(
                      'I have read and agree to the Terms & Conditions',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => _tabController.animateTo(1),
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            child: const Text('Next: Role Overview'),
          ),
        ],
      ),
    );
  }

  // Tab 2: Role Overview
  Widget _buildTabOverview() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Responsibilities & Expectations',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  _sectionHeader(context, Icons.assignment_turned_in, 'Responsibilities'),
                  const SizedBox(height: 6),
                  const Text('• Receive real-time incident dispatch alerts nearby.\n'
                      '• Accept tasks and provide live status updates to DRRMO.\n'
                      '• Coordinate directly with dispatchers and department teams.'),
                  const SizedBox(height: 16),
                  _sectionHeader(context, Icons.verified_user, 'Expectations'),
                  const SizedBox(height: 6),
                  const Text('• Maintain updated availability status on the app.\n'
                      '• Comply with safety protocols and wear identifier badges.\n'
                      '• Respond promptly when accepting an incident dispatch.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => _tabController.animateTo(2),
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            child: const Text('Next: Requirements Checklist'),
          ),
        ],
      ),
    );
  }

  // Tab 3: Requirements Checklist
  Widget _buildTabRequirements() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Required Credentials',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text('Upload photos (JPG or PNG) of your official documents.'),
                  const Divider(height: 24),

                  // 1. Government ID Upload
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          '1. Government ID (Required)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        onPressed: _pickGovId,
                        icon: const Icon(Icons.upload_file, size: 16),
                        label: Text(_govIdFile == null ? 'Upload' : 'Change', style: const TextStyle(fontSize: 13)),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ],
                  ),
                  if (_govIdFile != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8.0),
                      child: Text(
                        '✓ Selected: ${_govIdFile!.path.split(Platform.pathSeparator).last}',
                        style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),

                  const SizedBox(height: 20),

                  // 2. Training / Volunteer Certificates
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          '2. Certificates (Optional)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: _pickCertificate,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add File', style: TextStyle(fontSize: 13)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ],
                  ),
                  for (int i = 0; i < _certificateFiles.length; i++)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.card_membership, color: Colors.blue, size: 20),
                      title: Text(_certificateFiles[i].path.split(Platform.pathSeparator).last, style: const TextStyle(fontSize: 13)),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18, color: Colors.red),
                        onPressed: () => setState(() => _certificateFiles.removeAt(i)),
                      ),
                    ),

                  const SizedBox(height: 20),

                  // 3. Supporting Documents
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          '3. Supporting Docs (Optional)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: _pickOtherDoc,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add File', style: TextStyle(fontSize: 13)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ],
                  ),
                  for (int i = 0; i < _otherDocFiles.length; i++)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.description, color: Colors.grey, size: 20),
                      title: Text(_otherDocFiles[i].path.split(Platform.pathSeparator).last, style: const TextStyle(fontSize: 13)),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18, color: Colors.red),
                        onPressed: () => setState(() => _otherDocFiles.removeAt(i)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => _tabController.animateTo(3),
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
            child: const Text('Next: Personal Application Form'),
          ),
        ],
      ),
    );
  }

  // Tab 4: Application Form & Submit
  Widget _buildTabForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Applicant Information',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Full Name *', prefixIcon: Icon(Icons.person)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      decoration: const InputDecoration(labelText: 'Contact Phone Number *', prefixIcon: Icon(Icons.phone)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Phone is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(labelText: 'Email Address', prefixIcon: Icon(Icons.email)),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _addressController,
                      decoration: const InputDecoration(labelText: 'Address', prefixIcon: Icon(Icons.home)),
                    ),
                    const Divider(height: 32),
                    Text(
                      'Emergency Contact Person',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emergencyNameController,
                      decoration: const InputDecoration(labelText: 'Emergency Contact Name *', prefixIcon: Icon(Icons.contact_phone)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Emergency contact name is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emergencyPhoneController,
                      decoration: const InputDecoration(labelText: 'Emergency Contact Phone *', prefixIcon: Icon(Icons.phone_in_talk)),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Emergency contact phone is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emergencyRelationController,
                      decoration: const InputDecoration(labelText: 'Relationship (e.g. Spouse, Parent)', prefixIcon: Icon(Icons.people)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitApplication,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                backgroundColor: Theme.of(context).primaryColor,
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      'Submit Application',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Theme.of(context).primaryColor),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ],
    );
  }
}
