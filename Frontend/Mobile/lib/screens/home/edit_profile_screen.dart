import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/auth_service.dart';
import '../../utils/responsive.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/profile_avatar.dart';

class EditProfileScreen extends StatefulWidget {
  final Map<String, dynamic>? initialProfile;
  final Uint8List? initialPhotoBytes;

  const EditProfileScreen({
    super.key,
    this.initialProfile,
    this.initialPhotoBytes,
  });

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _picker = ImagePicker();

  bool _isSaving = false;
  bool _hasServerPhoto = false;
  Uint8List? _photoBytes;
  File? _pendingPhotoFile;
  bool _removePhoto = false;

  @override
  void initState() {
    super.initState();
    final profile = widget.initialProfile ?? {};
    _firstNameController.text =
        (profile['firstName'] ?? profile['first_name'] ?? '') as String;
    _lastNameController.text =
        (profile['lastName'] ?? profile['last_name'] ?? '') as String;
    _photoBytes = widget.initialPhotoBytes;
    _hasServerPhoto = profile['has_profile_image'] == true;
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  bool get _canSave {
    final first = _firstNameController.text.trim();
    final last = _lastNameController.text.trim();
    return first.isNotEmpty && last.isNotEmpty && !_isSaving;
  }

  Future<void> _showPhotoOptions() async {
    final canRemove = _pendingPhotoFile != null || _photoBytes != null || _hasServerPhoto;
    final action = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take photo'),
              onTap: () => Navigator.pop(ctx, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(ctx, 'gallery'),
            ),
            if (canRemove)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                title: const Text('Remove photo', style: TextStyle(color: Color(0xFFEF4444))),
                onTap: () => Navigator.pop(ctx, 'remove'),
              ),
          ],
        ),
      ),
    );

    if (!mounted || action == null) return;

    if (action == 'remove') {
      setState(() {
        _pendingPhotoFile = null;
        _photoBytes = null;
        _removePhoto = true;
      });
      return;
    }

    final source = action == 'camera' ? ImageSource.camera : ImageSource.gallery;
    final image = await _picker.pickImage(source: source, imageQuality: 85);
    if (image == null || !mounted) return;

    final bytes = await File(image.path).readAsBytes();
    setState(() {
      _pendingPhotoFile = File(image.path);
      _photoBytes = bytes;
      _removePhoto = false;
    });
  }

  Future<void> _save() async {
    if (!_canSave) return;

    setState(() => _isSaving = true);
    final auth = AuthService();
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();

    final nameResult = await auth.updateProfile(
      firstName: firstName,
      lastName: lastName,
    );
    if (!mounted) return;

    if (nameResult['success'] != true) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(nameResult['error']?.toString() ?? 'Failed to save profile')),
      );
      return;
    }

    Map<String, dynamic>? user = (nameResult['user'] as Map?)?.cast<String, dynamic>();

    if (_removePhoto) {
      final deleteResult = await auth.deleteAvatar();
      if (!mounted) return;
      if (deleteResult['success'] != true) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(deleteResult['error']?.toString() ?? 'Failed to remove photo')),
        );
        return;
      }
      user = (deleteResult['user'] as Map?)?.cast<String, dynamic>() ?? user;
    } else if (_pendingPhotoFile != null) {
      final uploadResult = await auth.uploadAvatar(_pendingPhotoFile!);
      if (!mounted) return;
      if (uploadResult['success'] != true) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(uploadResult['error']?.toString() ?? 'Failed to upload photo')),
        );
        return;
      }
      user = (uploadResult['user'] as Map?)?.cast<String, dynamic>() ?? user;
    }

    HapticFeedback.mediumImpact();
    if (!mounted) return;
    Navigator.pop(context, user);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 8,
              left: 16,
              right: 16,
              bottom: 16,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFEF4444),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const CircleAvatar(
                    backgroundColor: Colors.white,
                    child: Icon(Icons.arrow_back, color: Color(0xFF111827), size: 22),
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Edit Profile',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Image.asset(
                  'assets/logo/icon.png',
                  width: Responsive.headerLogoSize,
                  height: Responsive.headerLogoSize,
                  fit: BoxFit.contain,
                  color: Colors.white,
                  colorBlendMode: BlendMode.srcIn,
                  errorBuilder: (_, __, ___) => const Icon(Icons.person, color: Colors.white, size: 28),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Center(
                    child: ProfileAvatar(
                      firstName: _firstNameController.text,
                      lastName: _lastNameController.text,
                      size: 96,
                      photoBytes: _photoBytes,
                      showEditBadge: true,
                      onTap: _showPhotoOptions,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _showPhotoOptions,
                    child: const Text('Change photo'),
                  ),
                  const SizedBox(height: 16),
                  GlassCard(
                    padding: const EdgeInsets.all(16),
                    borderRadius: 16,
                    child: Column(
                      children: [
                        TextField(
                          controller: _firstNameController,
                          maxLength: 100,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'First name',
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _lastNameController,
                          maxLength: 100,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Last name',
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Phone and barangay can be updated from Account Information on Settings.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: _canSave ? _save : null,
                  child: _isSaving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
