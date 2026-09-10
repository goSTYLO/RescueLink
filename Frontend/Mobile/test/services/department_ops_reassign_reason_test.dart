import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/services/department_ops_service.dart';

void main() {
  test('reassign reason must be at least 10 chars after trim', () {
    expect(isValidReassignReason(null), isFalse);
    expect(isValidReassignReason('short'), isFalse);
    expect(isValidReassignReason('123456789'), isFalse);
    expect(isValidReassignReason('1234567890'), isTrue);
    expect(isValidReassignReason('  Override for coverage  '), isTrue);
  });
}
