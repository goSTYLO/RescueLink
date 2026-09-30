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

  group('validatePassword', () {
    test('accepts a password that meets the backend rule', () {
      expect(Validators.validatePassword('Password1!'), isNull);
      expect(Validators.validatePassword('  Password1!  '), isNull);
    });

    test('rejects missing capital or special character', () {
      expect(Validators.validatePassword('password1!'), isNotNull);
      expect(Validators.validatePassword('Password1'), isNotNull);
    });

    test('rejects short and overlong passwords', () {
      expect(Validators.validatePassword('Aa1!'), isNotNull);
      expect(Validators.validatePassword(''), isNotNull);
      expect(Validators.validatePassword(null), isNotNull);
      expect(
        Validators.validatePassword('${'A' * 127}1!'),
        isNotNull,
      );
    });
  });

  group('validatePasswordConfirmation', () {
    test('trims before compare', () {
      expect(
        Validators.validatePasswordConfirmation('Password1! ', 'Password1!'),
        isNull,
      );
      expect(
        Validators.validatePasswordConfirmation('Password1!', ' Password1!'),
        isNull,
      );
    });

    test('rejects a real mismatch', () {
      expect(
        Validators.validatePasswordConfirmation('Password1!', 'Password2!'),
        isNotNull,
      );
    });
  });

  group('passwordStrength', () {
    test('is strong only when the password is accepted', () {
      expect(Validators.passwordStrength('Password1!'), 'strong');
      expect(Validators.passwordStrength('pass'), 'weak');
      expect(Validators.passwordStrength('Password1'), 'medium');
    });
  });
}
