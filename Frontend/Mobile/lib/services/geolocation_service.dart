import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

class GeolocationService {
  // Cache for the loaded polygon
  static List<List<double>>? _dagupanPolygon;

  /// Load and parse the Dagupan GeoJSON file, extracting the polygon coordinates
  /// Returns an array of [longitude, latitude] coordinate pairs
  static Future<List<List<double>>> loadDagupanPolygon() async {
    if (_dagupanPolygon != null) {
      return _dagupanPolygon!;
    }

    try {
      final geojsonString = await rootBundle.loadString('assets/geojson/dagupan.geojson');
      final geojson = jsonDecode(geojsonString) as Map<String, dynamic>;

      // Extract polygon coordinates from the first feature
      // GeoJSON format: features[0].geometry.coordinates[0] contains the outer ring
      if (geojson['features'] != null && (geojson['features'] as List).isNotEmpty) {
        final geometry = geojson['features'][0]['geometry'] as Map<String, dynamic>;
        if (geometry['type'] == 'Polygon' && geometry['coordinates'] != null) {
          final coordinates = geometry['coordinates'][0] as List;
          _dagupanPolygon = coordinates
              .map((coord) => [
                    (coord[0] as num).toDouble(),
                    (coord[1] as num).toDouble(),
                  ])
              .toList();
          return _dagupanPolygon!;
        }
      }

      throw Exception('Invalid GeoJSON structure: Could not find polygon coordinates');
    } catch (error) {
      throw Exception('Failed to load Dagupan polygon: $error');
    }
  }

  /// Request location permissions from the user
  static Future<LocationPermission> requestLocationPermission() async {
    final permission = await Geolocator.requestPermission();
    return permission;
  }

  /// Check the current location permission status
  static Future<LocationPermission> checkLocationPermission() async {
    return await Geolocator.checkPermission();
  }

  /// Get the current position of the device
  /// Returns Position with latitude and longitude
  static Future<Position> getCurrentPosition() async {
    try {
      final permission = await checkLocationPermission();

      if (permission == LocationPermission.denied) {
        final newPermission = await requestLocationPermission();
        if (newPermission != LocationPermission.whileInUse &&
            newPermission != LocationPermission.always) {
          throw Exception('Location permission denied');
        }
      } else if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permission denied forever. Enable it in settings.');
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
      );

      return position;
    } catch (error) {
      throw Exception('Failed to get current position: $error');
    }
  }

  /// Check if a point is inside a polygon using the ray casting algorithm
  static bool pointInPolygon(double lat, double lng, List<List<double>> polygon) {
    if (polygon.length < 3) {
      return false;
    }

    bool inside = false;
    final x = lng;
    final y = lat;

    for (int i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i][0]; // longitude
      final yi = polygon[i][1]; // latitude
      final xj = polygon[j][0]; // longitude
      final yj = polygon[j][1]; // latitude

      // Ray casting algorithm: check if ray from point crosses polygon edge
      final intersect = ((yi > y) != (yj > y)) && 
                        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /// Calculate the distance between two points in meters using Haversine formula
  static double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371000.0; // Earth radius in meters
    final dLat = (lat2 - lat1) * (math.pi / 180);
    final dLng = (lng2 - lng1) * (math.pi / 180);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * (math.pi / 180)) *
            math.cos(lat2 * (math.pi / 180)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return R * c;
  }

  /// Check if a point is within the polygon or within buffer distance from nearest edge
  static bool pointInPolygonWithBuffer(
    double lat,
    double lng,
    List<List<double>> polygon, {
    double bufferMeters = 0,
  }) {
    // First check if point is inside polygon
    if (pointInPolygon(lat, lng, polygon)) {
      return true;
    }

    // If buffer is 0 or not specified, return false
    if (bufferMeters <= 0) {
      return false;
    }

    // Check distance to nearest polygon edge
    double minDistance = double.infinity;

    for (int i = 0; i < polygon.length; i++) {
      final p1 = polygon[i];
      final p2 = polygon[(i + 1) % polygon.length];

      // Find closest point on line segment p1-p2
      final distToSegment = _distanceToLineSegment(
        lat,
        lng,
        p1[1],
        p1[0],
        p2[1],
        p2[0],
      );
      minDistance = minDistance < distToSegment ? minDistance : distToSegment;

      if (minDistance <= bufferMeters) {
        return true;
      }
    }

    return minDistance <= bufferMeters;
  }

  /// Calculate shortest distance from a point to a line segment
  static double _distanceToLineSegment(
    double lat,
    double lng,
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    final A = lat - lat1;
    final B = lng - lng1;
    final C = lat2 - lat1;
    final D = lng2 - lng1;

    final dot = A * C + B * D;
    final lenSq = C * C + D * D;
    double param = -1;

    if (lenSq != 0) {
      param = dot / lenSq;
    }

    double xx, yy;

    if (param < 0) {
      xx = lat1;
      yy = lng1;
    } else if (param > 1) {
      xx = lat2;
      yy = lng2;
    } else {
      xx = lat1 + param * C;
      yy = lng1 + param * D;
    }

    return calculateDistance(lat, lng, xx, yy);
  }

  /// Check if a point (latitude, longitude) is within Dagupan city boundaries
  /// Returns true if point is in Dagupan or within buffer distance, false otherwise
  static Future<bool> isPointInDagupan(
    double lat,
    double lng, {
    double bufferMeters = 0,
  }) async {
    final polygon = await loadDagupanPolygon();
    return pointInPolygonWithBuffer(lat, lng, polygon, bufferMeters: bufferMeters);
  }
}
