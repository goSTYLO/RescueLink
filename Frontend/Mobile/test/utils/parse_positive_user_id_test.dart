import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/services/auth_service.dart';

void main() {
  group('parsePositiveUserId', () {
    test('accepts positive int', () {
      expect(parsePositiveUserId(42), 42);
    });

    test('accepts numeric string', () {
      expect(parsePositiveUserId('42'), 42);
    });

    test('accepts num (double from JSON)', () {
      expect(parsePositiveUserId(42.0), 42);
    });

    test('rejects zero, negative, null, non-numeric', () {
      expect(parsePositiveUserId(0), isNull);
      expect(parsePositiveUserId(-1), isNull);
      expect(parsePositiveUserId(null), isNull);
      expect(parsePositiveUserId(''), isNull);
      expect(parsePositiveUserId('abc'), isNull);
    });
  });
}
