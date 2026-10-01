import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:rescuelink_mobile/widgets/dagupan_boundary_layer.dart';

void main() {
  test('ringToLatLngs converts GeoJSON lon,lat to LatLng lat,lng', () {
    const ring = [
      [120.333, 16.043],
      [120.334, 16.044],
      [120.335, 16.045],
    ];
    final points = DagupanBoundaryLayer.ringToLatLngs(ring);
    expect(points.length, 3);
    expect(points.first.latitude, 16.043);
    expect(points.first.longitude, 120.333);
    expect(points.last, const LatLng(16.045, 120.335));
  });
}
