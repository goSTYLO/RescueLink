import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/validators.dart';

void main() {
  group('validatePhoneNumber', () {
    test('accepts local 11-digit format', () {
      expect(Validators.validatePhoneNumber('09171234567'), isNull);
    });

    test('rejects too short', () {
      expect(Validators.validatePhoneNumber('0917123456'), isNotNull);
    });

    test('rejects country code formats', () {
      expect(Validators.validatePhoneNumber('+639171234567'), isNotNull);
      expect(Validators.validatePhoneNumber('639171234567'), isNotNull);
    });

    test('rejects empty', () {
      expect(Validators.validatePhoneNumber(''), isNotNull);
      expect(Validators.validatePhoneNumber(null), isNotNull);
    });
  });

  group('validateOptionalPhoneNumber', () {
    test('allows empty', () {
      expect(Validators.validateOptionalPhoneNumber(''), isNull);
      expect(Validators.validateOptionalPhoneNumber(null), isNull);
    });

    test('validates when provided', () {
      expect(Validators.validateOptionalPhoneNumber('09171234567'), isNull);
      expect(Validators.validateOptionalPhoneNumber('123'), isNotNull);
    });
  });

  group('formatPhoneForFirebase', () {
    test('converts local to E.164', () {
      expect(Validators.formatPhoneForFirebase('09171234567'), '+639171234567');
    });
  });

  group('phoneInputFormatters', () {
    test('caps at 11 digits', () {
      expect(Validators.phoneInputFormatters.length, 2);
    });
  });
}
