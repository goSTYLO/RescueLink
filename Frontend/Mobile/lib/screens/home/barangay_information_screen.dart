import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/gradient_header.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/skeleton_placeholder.dart';

class BarangayInformationScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const BarangayInformationScreen({super.key, this.onBack});

  @override
  State<BarangayInformationScreen> createState() => _BarangayInformationScreenState();
}

class _BarangayInformationScreenState extends State<BarangayInformationScreen> {
  final _addressController = TextEditingController();
  final _addressFocusNode = FocusNode();
  Timer? _searchDebounce;
  List<Map<String, dynamic>> _suggestions = [];
  bool _isSearching = false;
  bool _isResolvingLocation = false;
  bool _isSaving = false;
  String? _locationError;
  double? _selectedLat;
  double? _selectedLng;
  String _displayAddress = '';
  bool _loadingProfile = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _addressController.addListener(_onAddressChanged);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _addressController.removeListener(_onAddressChanged);
    _addressController.dispose();
    _addressFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final result = await AuthService().getProfile();
    if (!mounted) return;
    if (result['success'] == true) {
      final user = (result['user'] as Map?)?.cast<String, dynamic>() ?? {};
      final address = user['address'] as String? ?? '';
      setState(() {
        _displayAddress = address.trim();
        _addressController.text = address.trim();
        _loadingProfile = false;
      });
    } else {
      setState(() => _loadingProfile = false);
    }
  }

  void _onAddressChanged() {
    _searchDebounce?.cancel();
    final query = _addressController.text.trim();
    if (query.length < 3) {
      setState(() {
        _suggestions = [];
        _locationError = null;
      });
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 350), () => _searchLocations(query));
  }

  Future<void> _searchLocations(String query) async {
    setState(() {
      _isSearching = true;
      _locationError = null;
    });
    final result = await AuthService().searchLocations(query, limit: 5);
    if (!mounted) return;
    final results = (result['results'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final manualOption = <String, dynamic>{
      'label': 'Use typed address: $query',
      'latitude': null,
      'longitude': null,
      'rawInput': query,
    };
    setState(() {
      _suggestions = [manualOption, ...results];
      _isSearching = false;
    });
  }

  void _applySuggestion(Map<String, dynamic> suggestion) {
    final address = suggestion['rawInput'] ?? suggestion['label'] ?? _addressController.text;
    final lat = suggestion['latitude'] as num?;
    final lng = suggestion['longitude'] as num?;
    setState(() {
      _addressController.text = address is String ? address : address.toString();
      _displayAddress = _addressController.text.trim();
      _selectedLat = lat?.toDouble();
      _selectedLng = lng?.toDouble();
      _suggestions = [];
      _locationError = null;
    });
  }

  Future<void> _useCurrentLocation() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      final requested = await Geolocator.requestPermission();
      if (requested == LocationPermission.denied || requested == LocationPermission.deniedForever) {
        if (mounted) {
          setState(() => _locationError = 'Location permission denied.');
        }
        return;
      }
    }
    setState(() {
      _isResolvingLocation = true;
      _locationError = null;
    });
    try {
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      final lat = position.latitude;
      final lng = position.longitude;
      final result = await AuthService().reverseGeocode(lat, lng);
      if (!mounted) return;
      final label = (result['result'] as Map?)?['label'] as String?;
      setState(() {
        _selectedLat = lat;
        _selectedLng = lng;
        _displayAddress = label ?? '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
        _addressController.text = _displayAddress;
        _isResolvingLocation = false;
        _locationError = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
        _isResolvingLocation = false;
        _locationError = 'Unable to get location: ${e.toString()}';
      });
      }
    }
  }

  Future<void> _saveAddress() async {
    final address = _addressController.text.trim();
    if (address.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an address')),
      );
      return;
    }
    setState(() => _isSaving = true);
    final result = await AuthService().updateProfile(address: address);
    if (!mounted) return;
    setState(() => _isSaving = false);
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Address saved successfully')),
      );
      setState(() => _displayAddress = address);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['error']?.toString() ?? 'Failed to save')),
      );
    }
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
        body: Column(
          children: [
            GradientHeader(
              title: 'Barangay Information',
              onBack: widget.onBack,
              transparentFade: true,
              trailing: Image.asset(
                'assets/logo/logo2.png',
                width: 32,
                height: 32,
                fit: BoxFit.contain,
                color: const Color(0xFF93C5FD),
                colorBlendMode: BlendMode.srcIn,
                errorBuilder: (_, __, ___) => const Icon(Icons.shield, color: Color(0xFF93C5FD), size: 28),
              ),
            ),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_loadingProfile)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SkeletonFormField(inputHeight: 48),
                            const SizedBox(height: 12),
                            const SkeletonPlaceholder(
                              width: double.infinity,
                              height: 48,
                              borderRadius: 12,
                            ),
                            const SizedBox(height: 20),
                            const SkeletonMapPlaceholder(height: 180),
                            const SizedBox(height: 16),
                            const SkeletonPlaceholder(
                              width: double.infinity,
                              height: 48,
                              borderRadius: 12,
                            ),
                            const SizedBox(height: 24),
                            SkeletonPlaceholder(
                              width: double.infinity,
                              height: 100,
                              borderRadius: 16,
                            ),
                          ],
                        )
                      else ...[
                        Text(
                          'Address',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Stack(
                          children: [
                            TextField(
                              controller: _addressController,
                              focusNode: _addressFocusNode,
                              decoration: InputDecoration(
                                hintText: 'Search Dagupan address',
                                prefixIcon: const Icon(Icons.search, size: 22),
                                filled: true,
                                fillColor: theme.colorScheme.surface,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(color: theme.colorScheme.outline.withValues(alpha: 0.3)),
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              ),
                              onTap: () {
                                if (_addressController.text.length >= 3) {
                                  _searchLocations(_addressController.text.trim());
                                }
                              },
                            ),
                            if (_isSearching)
                              Positioned(
                                right: 12,
                                top: 0,
                                bottom: 0,
                                child: Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: theme.colorScheme.primary,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        if (_suggestions.isNotEmpty)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            decoration: BoxDecoration(
                              color: theme.colorScheme.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: theme.colorScheme.outline.withValues(alpha: 0.3)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            constraints: const BoxConstraints(maxHeight: 200),
                            child: ListView.builder(
                              shrinkWrap: true,
                              itemCount: _suggestions.length,
                              itemBuilder: (_, i) {
                                final s = _suggestions[i];
                                final label = s['label']?.toString() ?? '';
                                return InkWell(
                                  onTap: () => _applySuggestion(s),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                    child: Text(
                                      label,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: theme.colorScheme.onSurface,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _isResolvingLocation ? null : _useCurrentLocation,
                            icon: _isResolvingLocation
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.my_location, size: 20),
                            label: Text(_isResolvingLocation ? 'Getting location...' : 'Use Current Location'),
                          ),
                        ),
                        if (_locationError != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            _locationError!,
                            style: TextStyle(fontSize: 12, color: theme.colorScheme.error),
                          ),
                        ],
                        const SizedBox(height: 20),
                        if (_selectedLat != null && _selectedLng != null) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: SizedBox(
                              height: 180,
                              child: FlutterMap(
                                options: MapOptions(
                                  initialCenter: LatLng(_selectedLat!, _selectedLng!),
                                  initialZoom: 15,
                                  interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
                                ),
                                children: [
                                  TileLayer(
                                    urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    userAgentPackageName: 'com.rescuelink.mobile',
                                    subdomains: const ['a', 'b', 'c'],
                                  ),
                                  MarkerLayer(
                                    markers: [
                                      Marker(
                                        point: LatLng(_selectedLat!, _selectedLng!),
                                        width: 40,
                                        height: 40,
                                        child: Icon(Icons.location_on, color: theme.colorScheme.error, size: 40),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _isSaving ? null : _saveAddress,
                            icon: _isSaving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.save, size: 20),
                            label: Text(_isSaving ? 'Saving...' : 'Save Address'),
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFFEF4444),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        GlassCard(
                          padding: const EdgeInsets.all(16),
                          borderRadius: 16,
                          blurSigma: 12,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline, color: theme.colorScheme.primary, size: 24),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Important Notice',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: theme.colorScheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Changing your barangay requires LGU re-verification. This process may take 1-3 business days. Emergency services will continue using your current barangay until approved.',
                                      style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurfaceVariant, height: 1.4),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
