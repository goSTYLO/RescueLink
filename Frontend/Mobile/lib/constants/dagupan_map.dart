import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../utils/app_config.dart';

/// Dagupan City map defaults shared across mobile maps.
class DagupanMap {
  DagupanMap._();

  static const LatLng center = LatLng(
    AppConfig.defaultLatitude,
    AppConfig.defaultLongitude,
  );

  static const double overviewZoom = 13;
  static const double detailZoom = 14;
  static const double departmentZoom = 15;

  /// Philippines viewport — keep in sync with web mapViewport.js.
  static const LatLng philippinesSouthWest = LatLng(4.0, 115.8);
  static const LatLng philippinesNorthEast = LatLng(21.5, 127.2);
  static const double philippinesMinZoom = 5;
  static const double philippinesMaxZoom = 18;

  static final LatLngBounds philippinesBounds = LatLngBounds(
    philippinesSouthWest,
    philippinesNorthEast,
  );

  static MapOptions applyPhilippinesConstraints(MapOptions options) {
    return MapOptions(
      crs: options.crs,
      initialCenter: options.initialCenter,
      initialZoom: options.initialZoom,
      initialRotation: options.initialRotation,
      initialCameraFit: options.initialCameraFit,
      minZoom: philippinesMinZoom,
      maxZoom: philippinesMaxZoom,
      backgroundColor: options.backgroundColor,
      onTap: options.onTap,
      onSecondaryTap: options.onSecondaryTap,
      onLongPress: options.onLongPress,
      onPointerDown: options.onPointerDown,
      onPointerUp: options.onPointerUp,
      onPointerCancel: options.onPointerCancel,
      onPointerHover: options.onPointerHover,
      onPointerMove: options.onPointerMove,
      onPositionChanged: options.onPositionChanged,
      onMapEvent: options.onMapEvent,
      onMapReady: options.onMapReady,
      keepAlive: options.keepAlive,
      interactionOptions: options.interactionOptions,
      cameraConstraint: CameraConstraint.containCenter(
        bounds: philippinesBounds,
      ),
    );
  }
}
