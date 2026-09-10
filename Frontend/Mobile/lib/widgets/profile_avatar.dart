import 'dart:typed_data';

import 'package:flutter/material.dart';

/// Photo or initials circle — no hardcoded illustration asset.
class ProfileAvatar extends StatelessWidget {
  final String firstName;
  final String lastName;
  final double size;
  final Uint8List? photoBytes;
  final VoidCallback? onTap;
  final bool showEditBadge;

  const ProfileAvatar({
    super.key,
    required this.firstName,
    required this.lastName,
    this.size = 72,
    this.photoBytes,
    this.onTap,
    this.showEditBadge = false,
  });

  String get _initials {
    final first = firstName.trim();
    final last = lastName.trim();
    if (first.isEmpty && last.isEmpty) return '';
    final a = first.isNotEmpty ? first[0].toUpperCase() : '';
    final b = last.isNotEmpty ? last[0].toUpperCase() : '';
    return '$a$b';
  }

  @override
  Widget build(BuildContext context) {
    final avatar = ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: _buildContent(context),
      ),
    );

    Widget child = avatar;
    if (showEditBadge) {
      child = Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
            ),
          ),
        ],
      );
    }

    if (onTap == null) return child;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: child,
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (photoBytes != null && photoBytes!.isNotEmpty) {
      return Image.memory(
        photoBytes!,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _initialsOrIcon(context),
      );
    }
    return _initialsOrIcon(context);
  }

  Widget _initialsOrIcon(BuildContext context) {
    if (_initials.isNotEmpty) {
      return ColoredBox(
        color: Theme.of(context).colorScheme.primaryContainer,
        child: Center(
          child: Text(
            _initials,
            style: TextStyle(
              fontSize: size * 0.36,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onPrimaryContainer,
            ),
          ),
        ),
      );
    }
    return ColoredBox(
      color: const Color(0xFFE5E7EB),
      child: Icon(Icons.person, size: size * 0.5, color: const Color(0xFF6B7280)),
    );
  }
}
