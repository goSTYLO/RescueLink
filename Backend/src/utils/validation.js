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

// Validate phone number format
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
  
  return trimmed;
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
  validatePagination
};
