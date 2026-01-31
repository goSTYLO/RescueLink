import 'package:equatable/equatable.dart';

abstract class LocationCheckResult extends Equatable {
  const LocationCheckResult();

  @override
  List<Object?> get props => [];
}

class LocationCheckSuccess extends LocationCheckResult {
  final bool isInDagupan;
  final String? message;

  const LocationCheckSuccess({
    required this.isInDagupan,
    this.message,
  });

  @override
  List<Object?> get props => [isInDagupan, message];
}

class LocationCheckFailure extends LocationCheckResult {
  final String error;

  const LocationCheckFailure(this.error);

  @override
  List<Object?> get props => [error];
}

abstract class CurrentLocationResult extends Equatable {
  const CurrentLocationResult();

  @override
  List<Object?> get props => [];
}

class CurrentLocationSuccess extends CurrentLocationResult {
  final double latitude;
  final double longitude;
  final double? accuracy;

  const CurrentLocationSuccess({
    required this.latitude,
    required this.longitude,
    this.accuracy,
  });

  @override
  List<Object?> get props => [latitude, longitude, accuracy];
}

class CurrentLocationFailure extends CurrentLocationResult {
  final String error;

  const CurrentLocationFailure(this.error);

  @override
  List<Object?> get props => [error];
}
