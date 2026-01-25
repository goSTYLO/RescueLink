/// Validation utilities for form inputs
class Validators {
  /// Validates Philippine phone numbers
  /// Accepts formats:
  /// - 09171234567 (11 digits starting with 09)
  /// - +639171234567 (with country code)
  /// - 639171234567 (country code without +)
  static String? validatePhoneNumber(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }

    // Remove spaces, dashes, and parentheses
    final cleaned = value.replaceAll(RegExp(r'[\s\-\(\)]'), '');

    // Pattern for PH phone numbers:
    // 09XXXXXXXXX (11 digits starting with 09)
    // +639XXXXXXXXX (country code with +)
    // 639XXXXXXXXX (country code without +)
    final phoneRegex = RegExp(
      r'^(\+?63|0)9\d{9}$',
    );

    if (!phoneRegex.hasMatch(cleaned)) {
      return 'Invalid PH phone number. Use format: 09171234567';
    }

    return null;
  }

  /// Formats phone number to E.164 format for Firebase (+639171234567)
  static String formatPhoneForFirebase(String phone) {
    // Remove spaces, dashes, and parentheses
    final cleaned = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');

    // If starts with 0, replace with +63
    if (cleaned.startsWith('0')) {
      return '+63${cleaned.substring(1)}';
    }

    // If starts with 63 (no +), add +
    if (cleaned.startsWith('63') && !cleaned.startsWith('+')) {
      return '+$cleaned';
    }

    // Already has +63
    if (cleaned.startsWith('+63')) {
      return cleaned;
    }

    // Fallback: assume it's missing country code
    return '+63$cleaned';
  }

  /// Validates email address
  static String? validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return null; // Email is optional
    }

    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );

    if (!emailRegex.hasMatch(value)) {
      return 'Invalid email address';
    }

    return null;
  }

  /// Validates password strength
  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (value.length > 128) {
      return 'Password must not exceed 128 characters';
    }

    // Check for at least one letter
    if (!RegExp(r'[a-zA-Z]').hasMatch(value)) {
      return 'Password must contain at least one letter';
    }

    // Check for at least one number
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Password must contain at least one number';
    }

    return null;
  }

  /// Validates name fields (first name, last name)
  static String? validateName(String? value, String fieldName) {
    if (value == null || value.isEmpty) {
      return '$fieldName is required';
    }

    if (value.length < 2) {
      return '$fieldName must be at least 2 characters';
    }

    if (value.length > 100) {
      return '$fieldName must not exceed 100 characters';
    }

    // Only letters, spaces, hyphens, and apostrophes
    if (!RegExp(r"^[a-zA-Z\s\-']+$").hasMatch(value)) {
      return '$fieldName can only contain letters, spaces, hyphens, and apostrophes';
    }

    return null;
  }

  /// Validates password confirmation
  static String? validatePasswordConfirmation(String? value, String password) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your password';
    }

    if (value != password) {
      return 'Passwords do not match';
    }

    return null;
  }
}
