import 'package:flutter_test/flutter_test.dart';
import 'package:rescuelink_mobile/utils/otp_error_messages.dart';

void main() {
  group('mapOtpVerifyError', () {
    test('maps expired', () {
      expect(
        mapOtpVerifyError(Exception('code expired'), message: 'OTP expired'),
        'Verification code has expired.',
      );
    });

    test('maps invalid', () {
      expect(
        mapOtpVerifyError(Exception('x'), message: 'Invalid OTP'),
        'Invalid verification code.',
      );
    });

    test('maps network and never exposes provider names', () {
      expect(
        mapOtpVerifyError(Exception('iprog timeout'), message: 'IPROG failed'),
        'Unable to verify your code. Please try again.',
      );
      expect(
        mapOtpVerifyError(Exception('SocketException')),
        'Unable to verify your code. Please try again.',
      );
    });
  });

  group('mapOtpResendError', () {
    test('maps network', () {
      expect(
        mapOtpResendError(Exception('connection refused')),
        'Unable to resend code. Check your network and try again.',
      );
    });

    test('strips iprog from message', () {
      expect(
        mapOtpResendError(Exception('x'), message: 'IPROG rate limit'),
        'Unable to resend code. Please try again.',
      );
    });
  });
}
