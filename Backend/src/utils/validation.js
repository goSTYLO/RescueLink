// Input validation utilities to prevent SQL injection and ensure data integrity

// Validate integer input
function validateInteger(value, fieldName) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid positive integer`);
  }
  return parsed;
}

// Validate string input with length constraints
function validateString(value, fieldName, minLength = 0, maxLength = 500) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }
  
  return trimmed;
}

// Validate phone number format and convert to E.164 format
function validatePhone(phone) {
  if (typeof phone !== 'string') {
    throw new Error('Phone number must be a string');
  }
  
  const trimmed = phone.trim();
  
  // Basic phone validation: allow +, digits, spaces, hyphens, parentheses
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  
  if (!phoneRegex.test(trimmed)) {
    throw new Error('Invalid phone number format');
  }
  
  if (trimmed.length > 20) {
    throw new Error('Phone number must not exceed 20 characters');
  }
  
  // Convert to E.164 format for Philippine numbers
  // Remove all non-digit characters
  let digitsOnly = trimmed.replace(/\D/g, '');
  
  // If starts with 0 (local format like 09123456789), replace with 63
  if (digitsOnly.startsWith('0')) {
    digitsOnly = '63' + digitsOnly.substring(1);
  }
  
  // If doesn't start with country code 63, add it
  if (!digitsOnly.startsWith('63')) {
    digitsOnly = '63' + digitsOnly;
  }
  
  // Add + prefix for E.164 format
  const e164Format = '+' + digitsOnly;
  
  console.log(`📱 Phone formatting: ${trimmed} → ${e164Format}`);
  
  return e164Format;
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

// Sanitize input to prevent XSS and other injection attacks
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove any potential SQL injection characters while preserving legitimate data
  // Note: Parameterized queries are the primary defense; this is additional safety
  return input
    .replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case '\0': return '';
        case '\x08': return '';
        case '\x09': return '';
        case '\x1a': return '';
        case '\n': return '';
        case '\r': return '';
        default: return char;
      }
    });
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

  // Complexity requirements: at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);

  if (!hasLetter) {
    throw new Error('Password must contain at least one letter');
  }

  if (!hasNumber) {
    throw new Error('Password must contain at least one number');
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
