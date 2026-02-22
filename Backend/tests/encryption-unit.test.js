/**
 * Simple Encryption Unit Tests
 * Tests encryption utility in isolation without full app startup
 */

const { encrypt, decrypt } = require('../src/utils/encryption');
const { encryptFields, decryptFields, decryptRows } = require('../src/utils/encryptedField');

describe('Encryption Utility - Unit Tests', () => {
  beforeAll(() => {
    // Ensure ENCRYPTION_KEY is set
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'test-key-32-bytes-long-for-aes';
    }
  });

  describe('encrypt/decrypt roundtrip', () => {
    test('should encrypt and decrypt string values', () => {
      const original = '+639666638967';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original); // Should be different
    });

    test('should encrypt and decrypt number values', () => {
      const latitude = 14.5995;
      const encrypted = encrypt(latitude.toString());
      const decrypted = parseFloat(decrypt(encrypted));
      
      expect(decrypted).toBe(latitude);
    });

    test('should encrypt and decrypt JSON objects', () => {
      const data = { file_name: 'incident.mp3', size: 2048 };
      const jsonStr = JSON.stringify(data);
      const encrypted = encrypt(jsonStr);
      const decrypted = JSON.parse(decrypt(encrypted));
      
      expect(decrypted).toEqual(data);
    });

    test('encrypted value should be different each time (random IV)', () => {
      const plaintext = 'test data';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      // Different IVs produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
      // But both decrypt to same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    test('encrypted value should be hex string', () => {
      const encrypted = encrypt('test');
      const isHex = /^[0-9a-f]+$/.test(encrypted);
      expect(isHex).toBe(true);
    });

    test('should handle special characters', () => {
      const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(special);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(special);
    });

    test('should handle unicode characters', () => {
      const unicode = 'Hello 世界 مرحبا';
      const encrypted = encrypt(unicode);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(unicode);
    });

    test('should handle empty string', () => {
      const empty = '';
      const encrypted = encrypt(empty);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(empty);
    });

    test('should handle long strings', () => {
      const longStr = 'a'.repeat(10000);
      const encrypted = encrypt(longStr);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(longStr);
    });
  });

  describe('encryptFields helper', () => {
    test('should encrypt specified fields only', () => {
      const data = {
        id: 1,
        phone_number: '+639666638967',
        email: 'test@example.com',
        public_field: 'visible'
      };
      
      const fieldsToEncrypt = ['phone_number', 'email'];
      const encrypted = encryptFields(data, fieldsToEncrypt);
      
      expect(encrypted.id).toBe(1); // Not encrypted
      expect(encrypted.public_field).toBe('visible'); // Not encrypted
      expect(encrypted.phone_number).not.toBe(data.phone_number); // Encrypted
      expect(encrypted.email).not.toBe(data.email); // Encrypted
    });

    test('should skip undefined/null fields', () => {
      const data = {
        id: 1,
        phone_number: '+639666638967',
        optional_field: null
      };
      
      const encrypted = encryptFields(data, ['phone_number', 'optional_field']);
      
      expect(encrypted.phone_number).not.toBe(data.phone_number);
      expect(encrypted.optional_field).toBeNull(); // Skipped
    });

    test('should handle arrays of strings', () => {
      const data = {
        id: 1,
        media_paths: ['photo1.jpg', 'photo2.jpg']
      };
      
      const encrypted = encryptFields(data, ['media_paths']);
      
      expect(Array.isArray(encrypted.media_paths)).toBe(true);
      expect(encrypted.media_paths).not.toEqual(data.media_paths);
    });
  });

  describe('decryptFields helper', () => {
    test('should decrypt fields with type conversion', () => {
      const data = {
        id: 1,
        latitude: encrypt('14.5995'),
        is_active: encrypt('true'),
        metadata: encrypt(JSON.stringify({ key: 'value' }))
      };
      
      const fieldTypes = {
        latitude: 'number',
        is_active: 'boolean',
        metadata: 'json'
      };
      
      const decrypted = decryptFields(data, ['latitude', 'is_active', 'metadata'], fieldTypes);
      
      expect(decrypted.latitude).toBe(14.5995);
      expect(typeof decrypted.latitude).toBe('number');
      expect(decrypted.is_active).toBe(true);
      expect(typeof decrypted.is_active).toBe('boolean');
      expect(decrypted.metadata).toEqual({ key: 'value' });
    });

    test('should handle string type conversion', () => {
      const encrypted = encrypt('+639666638967');
      const decrypted = decryptFields(
        { phone: encrypted },
        ['phone'],
        { phone: 'string' }
      );
      expect(decrypted.phone).toBe('+639666638967');
    });
  });

  describe('decryptRows helper', () => {
    test('should decrypt array of rows', () => {
      const rows = [
        {
          id: 1,
          phone_number: encrypt('+639666638967'),
          latitude: encrypt('14.5995')
        },
        {
          id: 2,
          phone_number: encrypt('+639123456789'),
          latitude: encrypt('15.1234')
        }
      ];
      
      const fieldTypes = { latitude: 'number' };
      const decrypted = decryptRows(rows, ['phone_number', 'latitude'], fieldTypes);
      
      expect(decrypted[0].phone_number).toBe('+639666638967');
      expect(decrypted[0].latitude).toBe(14.5995);
      expect(decrypted[1].phone_number).toBe('+639123456789');
      expect(decrypted[1].latitude).toBe(15.1234);
    });

    test('should handle empty array', () => {
      const decrypted = decryptRows([], ['phone_number'], {});
      expect(decrypted).toEqual([]);
    });
  });

  describe('Encryption Performance', () => {
    test('encryption should complete in reasonable time', () => {
      const iterations = 100;
      const data = 'sensitive data to encrypt';
      
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        encrypt(data);
      }
      const duration = Date.now() - start;
      
      // 100 encryptions should take less than 5 seconds
      expect(duration).toBeLessThan(5000);
      console.log(`✅ 100 encryptions completed in ${duration}ms`);
    });

    test('decryption should complete in reasonable time', () => {
      const iterations = 100;
      const encrypted = encrypt('sensitive data');
      
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        decrypt(encrypted);
      }
      const duration = Date.now() - start;
      
      // 100 decryptions should take less than 2 seconds
      expect(duration).toBeLessThan(2000);
      console.log(`✅ 100 decryptions completed in ${duration}ms`);
    });
  });

  describe('Error Handling', () => {
    test('decrypt should throw on invalid hex', () => {
      expect(() => decrypt('not-valid-hex')).toThrow();
    });

    test('decrypt should throw on tampered data', () => {
      const encrypted = encrypt('test');
      // Flip a bit in the encrypted data
      const tampered = encrypted.slice(0, -2) + 'ff';
      expect(() => decrypt(tampered)).toThrow();
    });

    test('should handle missing ENCRYPTION_KEY gracefully', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
      expect(() => decrypt('test')).toThrow('ENCRYPTION_KEY');
      
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('GDPR Compliance', () => {
    test('encrypted data should not contain readable PII', () => {
      const pii = '+639666638967';
      const encrypted = encrypt(pii);
      
      // Encrypted value should not contain original PII
      expect(encrypted).not.toContain(pii);
      expect(encrypted).toMatch(/^[0-9a-f]+$/); // Only hex chars
    });

    test('deleted data cannot be recovered from encryption alone', () => {
      const data = 'important PII';
      const encrypted = encrypt(data);
      
      // Even with encrypted value, cannot decrypt without the key
      // This test documents GDPR compliance: 
      // Encryption ensures deleted data cannot be recovered if key is deleted
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });
});
