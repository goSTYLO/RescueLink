import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../utils/app_config.dart';
import '../../utils/responsive.dart';
import '../../services/auth_service.dart';
import '../../widgets/app_map_tile_layer.dart';

class VerifyDagupanResidencyScreen extends StatefulWidget {
  final Function(double lat, double lng)? onVerificationComplete;
  final VoidCallback? onRefreshGps;
  final VoidCallback? onLocationVerificationFailed;
  final String? selectedBarangay;

  const VerifyDagupanResidencyScreen({
    super.key,
    this.onVerificationComplete,
    this.onRefreshGps,
    this.onLocationVerificationFailed,
    this.selectedBarangay,
  });

  @override
  State<VerifyDagupanResidencyScreen> createState() =>
      _VerifyDagupanResidencyScreenState();
}

class _VerifyDagupanResidencyScreenState
    extends State<VerifyDagupanResidencyScreen> {
  static const _dagupanCenter = LatLng(16.043, 120.334);

  final MapController _mapController = MapController();
  bool _isVerifying = false;
  bool _isVerified = false;
  bool _isInsideDagupan = false;
  String? _verificationMessage;
  double? _currentLat;
  double? _currentLng;

  @override
  void initState() {
    super.initState();
    _verifyLocation();
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _moveMapToCurrent() {
    final lat = _currentLat;
    final lng = _currentLng;
    if (lat == null || lng == null) return;
    try {
      _mapController.move(LatLng(lat, lng), 15);
    } catch (_) {
      // Map not ready yet; initialCenter covers first frame.
    }
  }

  Future<void> _verifyLocation() async {
    setState(() => _isVerifying = true);

    if (AppConfig.bypassLocationCheck) {
      await Future.delayed(const Duration(milliseconds: 500));
      if (!mounted) return;
      setState(() {
        _currentLat = 16.043;
        _currentLng = 120.334;
        _isInsideDagupan = true;
        _isVerified = true;
        _verificationMessage = 'Location verified (bypass mode for testing).';
        _isVerifying = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _moveMapToCurrent());
      return;
    }

    try {
      final authService = AuthService();
      final locResult = await authService.getCurrentLocation();

      if (!mounted) return;
      if (locResult['success'] != true) {
        setState(() {
          _isVerifying = false;
          _isVerified = false;
          _verificationMessage =
              locResult['error'] as String? ?? 'Could not get location.';
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(locResult['error'] as String? ?? 'Location error'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      final lat = locResult['latitude'] as double?;
      final lng = locResult['longitude'] as double?;
      if (lat == null || lng == null) {
        setState(() {
          _isVerifying = false;
          _isVerified = false;
          _verificationMessage = 'Invalid location coordinates.';
        });
        return;
      }

      final checkResult = await authService.checkLocationInDagupan(
        latitude: lat,
        longitude: lng,
      );

      if (!mounted) return;
      final isInDagupan = checkResult['isInDagupan'] as bool? ?? false;
      final message = checkResult['message'] as String? ??
          checkResult['error'] as String? ??
          (isInDagupan
              ? 'Location verified! You are in Dagupan City.'
              : 'Location verification failed. You are outside Dagupan City.');

      setState(() {
        _currentLat = lat;
        _currentLng = lng;
        _isInsideDagupan = isInDagupan;
        _isVerified = true;
        _verificationMessage = message;
        _isVerifying = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _moveMapToCurrent());
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifying = false;
          _verificationMessage = 'Error verifying location: $e';
          _isVerified = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _handleRefreshGps() async {
    await _verifyLocation();
    widget.onRefreshGps?.call();
  }

  Widget _buildLogo(double width) {
    final logoSize = Responsive.logoSize(width);
    final titleSize = Responsive.brandTitleSize(width);
    final subtitleSize = Responsive.brandSubtitleSize(width);
    final compact = Responsive.isCompact(width);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Image.asset(
          'assets/logo/icon.png',
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
        ),
        SizedBox(width: compact ? 8 : 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text.rich(
                TextSpan(
                  style: TextStyle(
                      fontSize: titleSize, fontWeight: FontWeight.bold),
                  children: [
                    TextSpan(
                      text: 'Rescue',
                      style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF0F172A)),
                    ),
                    const TextSpan(
                      text: 'Link',
                      style: TextStyle(color: Color(0xFFFF6B6B)),
                    ),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                'Emergency Response and Safety',
                style: TextStyle(
                    color: const Color(0xFF6B7280), fontSize: subtitleSize),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMap(double width) {
    final barangay = widget.selectedBarangay ?? 'Barangay Poblacion Oeste';
    final center = (_currentLat != null && _currentLng != null)
        ? LatLng(_currentLat!, _currentLng!)
        : _dagupanCenter;
    final markers = <Marker>[];
    if (_currentLat != null && _currentLng != null) {
      markers.add(
        Marker(
          point: LatLng(_currentLat!, _currentLng!),
          width: 40,
          height: 40,
          child: const Icon(Icons.location_on, color: Color(0xFFEF4444), size: 36),
        ),
      );
    }

    return Container(
      height: Responsive.isCompact(width) ? 200 : 240,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: center,
              initialZoom: 14,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.pinchZoom |
                    InteractiveFlag.drag |
                    InteractiveFlag.doubleTapZoom,
              ),
              onMapReady: _moveMapToCurrent,
            ),
            children: [
              AppMapTileLayer(),
              if (markers.isNotEmpty) MarkerLayer(markers: markers),
            ],
          ),
          if (_isVerifying)
            Container(
              color: Colors.white54,
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFFEF4444)),
              ),
            ),
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(8),
              color: Colors.white,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.map_outlined,
                        size: 18, color: Color(0xFF6B7280)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        barangay,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Dagupan City',
                      style: TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard() {
    if (_isVerifying) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFCD34D)),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(Color(0xFFF59E0B)),
                strokeWidth: 2,
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Verifying Location',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF92400E),
                    ),
                  ),
                  Text(
                    'Please wait while we verify your GPS location...',
                    style: TextStyle(fontSize: 13, color: Color(0xFFB45309)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (!_isVerified) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFCAFA8)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error, color: Color(0xFFDC2626), size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Location Verification Failed',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF7F1D1D),
                    ),
                  ),
                  Text(
                    _verificationMessage ?? 'Unable to verify location',
                    style:
                        const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_isInsideDagupan) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF86EFAC)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Inside Dagupan City',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF166534),
                    ),
                  ),
                  Text(
                    _verificationMessage ?? 'Location verified',
                    style:
                        const TextStyle(fontSize: 13, color: Color(0xFF15803D)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCAFA8)),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_off, color: Color(0xFFDC2626), size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Outside Dagupan City',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF7F1D1D),
                  ),
                ),
                Text(
                  _verificationMessage ?? 'You are outside service area',
                  style:
                      const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final barangay = widget.selectedBarangay ?? 'Barangay Poblacion Oeste';
    final screenWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = Responsive.horizontalPadding(screenWidth);
    final compact = Responsive.isCompact(screenWidth);
    final headingSize = compact ? 24.0 : 28.0;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              _buildLogo(screenWidth),
              const SizedBox(height: 20),
              Text(
                'Verify Dagupan Residency',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: headingSize,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Confirm you are inside Dagupan City',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20),
              _buildMap(screenWidth),
              const SizedBox(height: 16),
              _buildStatusCard(),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Selected Barangay',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      barangay,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    if (_currentLat != null && _currentLng != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Lat: ${_currentLat!.toStringAsFixed(5)}, Lng: ${_currentLng!.toStringAsFixed(5)}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF9CA3AF),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isVerifying ? null : _handleRefreshGps,
                  icon: _isVerifying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh,
                          size: 20, color: Color(0xFF374151)),
                  label: Text(
                    _isVerifying ? 'Verifying...' : 'Refresh GPS',
                    style: const TextStyle(
                        color: Color(0xFF374151), fontWeight: FontWeight.w500),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Color(0xFFE5E7EB)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_isVerified && _isInsideDagupan && !_isVerifying)
                      ? () {
                          if (widget.onVerificationComplete != null &&
                              _currentLat != null &&
                              _currentLng != null) {
                            widget.onVerificationComplete!(
                                _currentLat!, _currentLng!);
                          }
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    disabledBackgroundColor: const Color(0xFFD1D5DB),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    _isVerifying
                        ? 'Verifying...'
                        : (_isVerified && _isInsideDagupan
                            ? 'Continue'
                            : 'Awaiting Verification'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              if (_isVerified &&
                  !_isInsideDagupan &&
                  widget.onLocationVerificationFailed != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: widget.onLocationVerificationFailed,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: Color(0xFFEF4444)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text(
                      'Go Back to Sign Up',
                      style: TextStyle(
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
