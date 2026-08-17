import 'package:flutter_map/flutter_map.dart';

/// Shared OpenStreetMap tile layer used across RescueLink mobile maps.
class AppMapTileLayer extends TileLayer {
  AppMapTileLayer({super.key})
      : super(
          urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: const ['a', 'b', 'c'],
          userAgentPackageName: 'com.rescuelink.mobile',
          // Rapid fit/move on the responder map was aborting in-flight tile fetches,
          // leaving the default gray MapOptions.backgroundColor visible.
          tileProvider: NetworkTileProvider(
            abortObsoleteRequests: false,
          ),
        );
}
