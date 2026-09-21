/// Maps backend / network OTP verify failures to user-facing copy.
/// Never expose raw IPROG or provider errors.
String mapOtpVerifyError(Object error, {String? message}) {
  final raw = (message ?? error.toString()).toLowerCase();
  if (raw.contains('expired')) {
    return 'Verification code has expired.';
  }
  if (raw.contains('invalid') ||
      raw.contains('incorrect') ||
      raw.contains('wrong')) {
    return 'Invalid verification code.';
  }
  if (raw.contains('socket') ||
      raw.contains('connection') ||
      raw.contains('timeout') ||
      raw.contains('failed host lookup') ||
      raw.contains('network')) {
    return 'Unable to verify your code. Please try again.';
  }
  return 'Unable to verify your code. Please try again.';
}

String mapOtpResendError(Object error, {String? message}) {
  final raw = (message ?? error.toString()).toLowerCase();
  if (raw.contains('socket') ||
      raw.contains('connection') ||
      raw.contains('timeout') ||
      raw.contains('failed host lookup') ||
      raw.contains('network')) {
    return 'Unable to resend code. Check your network and try again.';
  }
  if (message != null && message.trim().isNotEmpty) {
    // Allow short backend messages that are already user-safe (e.g. rate limit).
    if (message.length < 120 && !raw.contains('iprog')) {
      return message;
    }
  }
  return 'Unable to resend code. Please try again.';
}
