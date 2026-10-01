import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/constants/dagupan_map.dart';

void main() {
  test('Philippines viewport constants match web mapViewport.js', () {
    expect(DagupanMap.philippinesMinZoom, 5);
    expect(DagupanMap.philippinesMaxZoom, 18);
    expect(DagupanMap.philippinesSouthWest.latitude, 4.0);
    expect(DagupanMap.philippinesSouthWest.longitude, 115.8);
    expect(DagupanMap.philippinesNorthEast.latitude, 21.5);
    expect(DagupanMap.philippinesNorthEast.longitude, 127.2);
  });

  test('applyPhilippinesConstraints sets minZoom and camera constraint', () {
    final options = DagupanMap.applyPhilippinesConstraints(
      MapOptions(initialCenter: DagupanMap.center, initialZoom: 14),
    );
    expect(options.minZoom, DagupanMap.philippinesMinZoom);
    expect(options.maxZoom, DagupanMap.philippinesMaxZoom);
    expect(options.cameraConstraint, isNotNull);
  });
}
