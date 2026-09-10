import 'package:flutter/material.dart';
import '../../utils/responsive.dart';
import '../../utils/validators.dart';
import '../../widgets/bottom_sheet_wrapper.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';

class EmergencyContact {
  final String name;
  final String relation;
  final String phone;

  EmergencyContact({required this.name, required this.relation, required this.phone});
}

const List<String> _relationshipOptions = [
  'Spouse',
  'Parent',
  'Sibling',
  'Friend',
  'Other',
];

class EmergencyContactsScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const EmergencyContactsScreen({
    super.key,
    this.onBack,
  });

  @override
  State<EmergencyContactsScreen> createState() => _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState extends State<EmergencyContactsScreen> {
  final List<EmergencyContact> _contacts = [
    EmergencyContact(name: 'Maria Cruz', relation: 'Spouse', phone: '+63 917 234 5678'),
    EmergencyContact(name: 'Jose Dela Cruz', relation: 'Parent', phone: '+63 918 345 6789'),
  ];

  EmergencyContact? _contactToDelete;
  bool _loadingContacts = true;

  static const int _maxContacts = 5;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _loadingContacts = false);
    });
  }

  void _onAddContactTap() {
    if (_contacts.length >= _maxContacts) return;
    BottomSheetWrapper.show(
      context: context,
      title: 'Add Emergency Contact',
      child: _AddContactFormContent(
        onAdd: (name, relation, phone) {
          setState(() {
            _contacts.add(EmergencyContact(
              name: name,
              relation: relation,
              phone: Validators.formatPhoneForFirebase(phone),
            ));
          });
          if (context.mounted) Navigator.of(context).pop();
        },
        onCancel: () => Navigator.of(context).pop(),
        relationshipOptions: _relationshipOptions,
      ),
    );
  }

  void _onDeleteTap(EmergencyContact contact) {
    setState(() => _contactToDelete = contact);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _DeleteContactDialog(
        illustrationPath: 'assets/images/deleteemergencycontacts_illustration.png',
        onYes: () {
          if (_contactToDelete != null) {
            setState(() {
              _contacts.remove(_contactToDelete);
              _contactToDelete = null;
            });
          }
        },
        onNo: () => setState(() => _contactToDelete = null),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onBack?.call();
      },
      child: Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
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
                          'Emergency Contacts',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_contacts.length}/$_maxContacts contacts added',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.95), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Image.asset(
                    'assets/logo/icon.png',
                    width: Responsive.headerLogoSize,
          height: Responsive.headerLogoSize,
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
                    if (_loadingContacts) ...[
                      const SkeletonPlaceholder(
                        width: double.infinity,
                        height: 48,
                        borderRadius: 12,
                      ),
                      const SizedBox(height: 20),
                      const SkeletonContactCard(),
                      const SizedBox(height: 12),
                      const SkeletonContactCard(),
                      const SizedBox(height: 12),
                      const SkeletonContactCard(),
                      const SizedBox(height: 24),
                      const SkeletonPlaceholder(
                        width: double.infinity,
                        height: 100,
                        borderRadius: 12,
                      ),
                      const SizedBox(height: 24),
                    ] else ...[
                    // Add Emergency Contact button
                    OutlinedButton.icon(
                        onPressed: _contacts.length >= _maxContacts ? null : _onAddContactTap,
                        icon: const Icon(Icons.person_add, color: Color(0xFF111827), size: 22),
                        label: const Text(
                          'Add Emergency Contact',
                          style: TextStyle(
                            color: Color(0xFF111827),
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          side: const BorderSide(color: Color(0xFFE5E7EB)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    const SizedBox(height: 20),
                    // Existing contact cards
                    ...List.generate(_contacts.length, (i) {
                      final c = _contacts[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _contactCard(
                          initial: c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                          name: c.name,
                          phone: c.phone,
                          onEdit: () {},
                          onDelete: () => _onDeleteTap(c),
                        ),
                      );
                    }),
                    const SizedBox(height: 24),
                    // How It Works box
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Color(0xFFF59E0B),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.info_outline, color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'How It Works',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF111827),
                                  ),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'When auto-notify is enabled, all contacts will receive an SMS with your emergency details and real-time location when you submit a report.',
                                  style: TextStyle(fontSize: 13, color: Color(0xFF374151), height: 1.4),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    ],
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

  Widget _contactCard({
    required String initial,
    required String name,
    required String phone,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) {
    return GlassCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFEF4444), Color(0xFF2563EB)],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              initial,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  phone,
                  style: TextStyle(
                    fontSize: 13,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined, color: Color(0xFF2563EB), size: 22),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          IconButton(
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 22),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

class _AddContactFormContent extends StatefulWidget {
  final void Function(String name, String relation, String phone) onAdd;
  final VoidCallback onCancel;
  final List<String> relationshipOptions;

  const _AddContactFormContent({
    required this.onAdd,
    required this.onCancel,
    required this.relationshipOptions,
  });

  @override
  State<_AddContactFormContent> createState() => _AddContactFormContentState();
}

class _AddContactFormContentState extends State<_AddContactFormContent> {
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _selectedRelation;

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _fullNameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty || _selectedRelation == null || _selectedRelation!.isEmpty) return;
    if (Validators.validatePhoneNumber(phone) != null) return;
    widget.onAdd(name, _selectedRelation!, phone);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _fullNameController,
          maxLength: 100,
          decoration: const InputDecoration(
            hintText: 'Full name',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _selectedRelation,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
          ),
          hint: const Text('Relationship'),
          items: widget.relationshipOptions
              .map((s) => DropdownMenuItem(value: s, child: Text(s)))
              .toList(),
          onChanged: (v) => setState(() => _selectedRelation = v),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          inputFormatters: Validators.phoneInputFormatters,
          maxLength: 11,
          decoration: const InputDecoration(
            hintText: '09171234567',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: widget.onCancel,
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
                child: const Text('Add', style: TextStyle(color: Colors.white)),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DeleteContactDialog extends StatelessWidget {
  final String illustrationPath;
  final VoidCallback onYes;
  final VoidCallback onNo;

  const _DeleteContactDialog({
    required this.illustrationPath,
    required this.onYes,
    required this.onNo,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.asset(
                illustrationPath,
                height: 140,
                width: double.infinity,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(Icons.help_outline, size: 80, color: Color(0xFF9CA3AF)),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Do you want to delete this contact?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFFEF4444),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onYes();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF22C55E),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('YES', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onNo();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('NO', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
