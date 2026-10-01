import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../constants/dagupan_map.dart';
import 'map_recenter_fab.dart';

/// Embedded map with a recenter FAB; owns [MapController] lifecycle.
class RecenterableMapFrame extends StatefulWidget {
  final double height;
  final LatLng center;
  final double zoom;
  final List<Widget> children;
  final MapOptions? mapOptions;
  final BorderRadius? borderRadius;

  const RecenterableMapFrame({
    super.key,
    required this.height,
    required this.center,
    this.zoom = DagupanMap.detailZoom,
    required this.children,
    this.mapOptions,
    this.borderRadius,
  });

  @override
  State<RecenterableMapFrame> createState() => _RecenterableMapFrameState();
}

class _RecenterableMapFrameState extends State<RecenterableMapFrame> {
  final MapController _mapController = MapController();

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(12);
    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        height: widget.height,
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: DagupanMap.applyPhilippinesConstraints(
                widget.mapOptions ??
                    MapOptions(
                      initialCenter: widget.center,
                      initialZoom: widget.zoom,
                    ),
              ),
              children: widget.children,
            ),
            Positioned(
              right: 8,
              bottom: 8,
              child: MapRecenterFab(
                mapController: _mapController,
                center: widget.center,
                zoom: widget.zoom,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
