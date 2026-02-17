// Input validation utilities to prevent SQL injection and ensure data integrity

// Validate integer input
function validateInteger(value, fieldName) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid positive integer`);
  }
  return parsed;
}

// Validate string input with length constraints; applies sanitizeInput for safety
function validateString(value, fieldName, minLength = 0, maxLength = 500) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  const sanitized = sanitizeInput(trimmed);
  if (sanitized.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }
  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }
  return sanitized;
}

// Validate phone number format and convert to E.164 format (Philippine mobile: 09xxxxxxxxx or +639xxxxxxxxx)
function validatePhone(phone) {
  if (typeof phone !== 'string') {
    throw new Error('Phone number must be a string');
  }

  const trimmed = phone.trim();
  if (!trimmed.length) {
    throw new Error('Phone number is required');
  }

  // Allow common separators: spaces, hyphens, parentheses, dots; strip for digit check
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    throw new Error('Invalid phone number format. Use a valid Philippine mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).');
  }

  // Normalize to E.164 for Philippines: +63 9XX XXX XXXX (12 digits total)
  let normalized = digitsOnly;
  if (normalized.startsWith('0')) {
    normalized = '63' + normalized.slice(1);
  }
  if (!normalized.startsWith('63')) {
    normalized = '63' + normalized;
  }

  // Philippine mobile: country code 63 + 10 digits, mobile numbers start with 9
  if (normalized.length !== 12) {
    throw new Error('Invalid phone number format. Philippine mobile must be 10 digits (e.g. 09XXXXXXXXX).');
  }
  if (!/^63[0-9]{10}$/.test(normalized)) {
    throw new Error('Invalid phone number format. Use a valid Philippine mobile number (e.g. 09XXXXXXXXX).');
  }

  return '+' + normalized;
}

// Validate email format
function validateEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  
  const trimmed = email.trim();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }
  
  if (trimmed.length > 255) {
    throw new Error('Email must not exceed 255 characters');
  }
  
  return trimmed;
}

// Validate optional string (can be null/undefined)
function validateOptionalString(value, fieldName, maxLength = 500) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return validateString(value, fieldName, 0, maxLength);
}

// Sanitize input to prevent XSS and other injection attacks.
// Normalizes line endings (\\r\\n, \\r -> \\n) and removes dangerous control characters.
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  // Normalize line endings first
  let out = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Remove null and other control characters; parameterized queries remain primary defense
  out = out.replace(/[\0\x08\x09\x1a]/g, '');
  return out;
}

// Validate password strength
function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new Error('Password must be a string');
  }

  const trimmed = password.trim();

  // Minimum length requirement
  if (trimmed.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Maximum length to prevent DoS attacks
  if (trimmed.length > 128) {
    throw new Error('Password must not exceed 128 characters');
  }

  // Complexity requirements: at least one uppercase, one number, one special character
  const hasUpperCase = /[A-Z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(trimmed);

  if (!hasUpperCase) {
    throw new Error('Password must contain at least one capital letter');
  }

  if (!hasNumber) {
    throw new Error('Password must contain at least one number');
  }

  if (!hasSpecialChar) {
    throw new Error('Password must contain at least one special character');
  }

  return trimmed;
}

// Validate latitude
function validateLatitude(lat) {
  const parsed = parseFloat(lat);
  if (isNaN(parsed)) {
    throw new Error('Latitude must be a valid number');
  }
  if (parsed < -90 || parsed > 90) {
    throw new Error('Latitude must be between -90 and 90 degrees');
  }
  return parsed;
}

// Validate longitude
function validateLongitude(lng) {
  const parsed = parseFloat(lng);
  if (isNaN(parsed)) {
    throw new Error('Longitude must be a valid number');
  }
  if (parsed < -180 || parsed > 180) {
    throw new Error('Longitude must be between -180 and 180 degrees');
  }
  return parsed;
}

// Validate address (optional field)
function validateAddress(address) {
  if (address === null || address === undefined || address === '') {
    return null;
  }
  
  if (typeof address !== 'string') {
    throw new Error('Address must be a string');
  }
  
  const trimmed = address.trim();
  
  if (trimmed.length > 255) {
    throw new Error('Address must not exceed 255 characters');
  }
  
  return trimmed;
}

// Validate pagination parameters
function validatePagination(limit, offset) {
  const validatedLimit = limit ? validateInteger(limit, 'limit') : 20;
  const validatedOffset = offset ? validateInteger(offset, 'offset') : 0;
  
  // Cap limit at 100
  const cappedLimit = Math.min(validatedLimit, 100);
  
  return { limit: cappedLimit, offset: validatedOffset };
}

module.exports = {
  validateInteger,
  validateString,
  validatePhone,
  validateEmail,
  validateOptionalString,
  sanitizeInput,
  validatePassword,
  validateLatitude,
  validateLongitude,
  validatePagination,
  validateAddress
};
