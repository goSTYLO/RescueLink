import 'package:equatable/equatable.dart';
import 'user.dart';

abstract class AuthResult extends Equatable {
  const AuthResult();

  @override
  List<Object?> get props => [];
}

class AuthSuccess extends AuthResult {
  final User user;
  final String? token;

  const AuthSuccess(this.user, {this.token});

  @override
  List<Object?> get props => [user, token];
}

class AuthFailure extends AuthResult {
  final String message;

  const AuthFailure(this.message);

  @override
  List<Object?> get props => [message];
}
