import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../services/geolocation_service.dart';

/// Renders the Dagupan City administrative boundary from bundled GeoJSON.
class DagupanBoundaryLayer extends StatelessWidget {
  const DagupanBoundaryLayer({super.key});

  static List<LatLng> ringToLatLngs(List<List<double>> ring) {
    return ring
        .map((coord) => LatLng(coord[1], coord[0]))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<List<double>>>(
      future: GeolocationService.loadDagupanPolygon(),
      builder: (context, snapshot) {
        final ring = snapshot.data;
        if (ring == null || ring.length < 3) return const SizedBox.shrink();
        return PolygonLayer(
          polygons: [
            Polygon(
              points: ringToLatLngs(ring),
              color: const Color(0xFF4F46E5).withValues(alpha: 0.08),
              borderColor: const Color(0xFF4F46E5),
              borderStrokeWidth: 2,
            ),
          ],
        );
      },
    );
  }
}
