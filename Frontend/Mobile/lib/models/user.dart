import 'package:equatable/equatable.dart';

class User extends Equatable {
  final int id;
  final String phone;
  final String? firstName;
  final String? lastName;
  final String role;

  const User({
    required this.id,
    required this.phone,
    this.firstName,
    this.lastName,
    this.role = 'user',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['user_id'] ?? json['id']) as int,
      phone: json['phone'] as String? ?? '',
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      role: json['role'] as String? ?? 'user',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': id,
      'phone': phone,
      'firstName': firstName,
      'lastName': lastName,
      'role': role,
    };
  }

  @override
  List<Object?> get props => [id, phone, firstName, lastName, role];
}
