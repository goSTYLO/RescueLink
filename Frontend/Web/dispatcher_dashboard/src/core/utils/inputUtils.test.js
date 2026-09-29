import { sanitizePhoneInput, isValidLocalPhone, PHONE_MAX_LENGTH, getPasswordValidationError } from '@/core/utils/inputUtils';

describe('inputUtils', () => {
  test('PHONE_MAX_LENGTH is 11', () => {
    expect(PHONE_MAX_LENGTH).toBe(11);
  });

  test('sanitizePhoneInput strips non-digits and caps length', () => {
    expect(sanitizePhoneInput('09ab712-34567')).toBe('0971234567');
    expect(sanitizePhoneInput('091712345678901')).toBe('09171234567');
  });

  test('isValidLocalPhone accepts local PH format', () => {
    expect(isValidLocalPhone('09171234567')).toBe(true);
    expect(isValidLocalPhone('9171234567')).toBe(false);
    expect(isValidLocalPhone('')).toBe(false);
  });

  test('getPasswordValidationError matches backend complexity rules', () => {
    expect(getPasswordValidationError('')).toMatch(/required/i);
    expect(getPasswordValidationError('short')).toMatch(/8 characters/i);
    expect(getPasswordValidationError('password1!')).toMatch(/capital/i);
    expect(getPasswordValidationError('Password!')).toMatch(/number/i);
    expect(getPasswordValidationError('Password1')).toMatch(/special/i);
    expect(getPasswordValidationError('Password1!')).toBe('');
  });
});
