import 'package:equatable/equatable.dart';

abstract class OtpResult extends Equatable {
  const OtpResult();

  @override
  List<Object?> get props => [];
}

class OtpSuccess extends OtpResult {
  final String? message;

  const OtpSuccess({this.message});

  @override
  List<Object?> get props => [message];
}

class OtpFailure extends OtpResult {
  final String error;

  const OtpFailure(this.error);

  @override
  List<Object?> get props => [error];
}
