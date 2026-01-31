import '../models/location_result.dart';
import '../services/auth_service.dart';

class LocationRepository {
  final AuthService _authService;

  LocationRepository({AuthService? authService})
      : _authService = authService ?? AuthService();

  Future<LocationCheckResult> checkLocationInDagupan({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await _authService.checkLocationInDagupan(
        latitude: latitude,
        longitude: longitude,
      );

      if (result['success'] == true) {
        return LocationCheckSuccess(
          isInDagupan: result['isInDagupan'] as bool? ?? false,
          message: result['message'] as String?,
        );
      }

      return LocationCheckFailure(
        result['error']?.toString() ??
            result['message']?.toString() ??
            'Location check failed',
      );
    } catch (e) {
      return LocationCheckFailure(e.toString());
    }
  }

  Future<CurrentLocationResult> getCurrentLocation({
    int maxRetries = 2,
    int timeoutSeconds = 30,
  }) async {
    try {
      final result = await _authService.getCurrentLocation(
        maxRetries: maxRetries,
        timeoutSeconds: timeoutSeconds,
      );

      if (result['success'] == true &&
          result['latitude'] != null &&
          result['longitude'] != null) {
        return CurrentLocationSuccess(
          latitude: (result['latitude'] as num).toDouble(),
          longitude: (result['longitude'] as num).toDouble(),
          accuracy: result['accuracy'] != null
              ? (result['accuracy'] as num).toDouble()
              : null,
        );
      }

      return CurrentLocationFailure(
        result['error']?.toString() ?? 'Failed to get location',
      );
    } catch (e) {
      return CurrentLocationFailure(e.toString());
    }
  }
}
