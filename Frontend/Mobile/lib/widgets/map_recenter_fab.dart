import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Small recenter control for embedded or full-screen maps.
class MapRecenterFab extends StatelessWidget {
  final MapController mapController;
  final LatLng center;
  final double zoom;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final Color? iconColor;

  const MapRecenterFab({
    super.key,
    required this.mapController,
    required this.center,
    required this.zoom,
    this.margin,
    this.backgroundColor,
    this.iconColor,
  });

  void _recenter() {
    try {
      mapController.move(center, zoom);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: FloatingActionButton.small(
        heroTag: 'map_recenter_${center.latitude}_${center.longitude}',
        tooltip: 'Recenter map',
        backgroundColor: backgroundColor ?? const Color(0xFF1E293B),
        onPressed: _recenter,
        child: Icon(Icons.center_focus_strong_rounded, color: iconColor ?? Colors.white),
      ),
    );
  }
}
