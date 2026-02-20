/**
 * Encryption at Rest Tests
 * 
 * Tests for verifying that sensitive data is properly encrypted/decrypted
 * across all models and controllers.
 */

const request = require('supertest');
const pool = require('../src/config/db');
const app = require('../src/app');
const { encrypt, decrypt } = require('../src/utils/encryption');
const { encryptFields, decryptFields } = require('../src/utils/encryptedField');

describe('Encryption at Rest Tests', () => {
  // Test data
  const testUser = {
    phone_number: '+639171234567',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    address: '123 Main St',
    password: 'hashedpassword123'
  };

  const testIncident = {
    user_id: 1,
    latitude: 16.0419,
    longitude: 120.5351,
    description: 'Severe traffic accident on Main Street',
    transcription: 'Emergency call transcript details',
    audio_path: '/uploads/audio/incident_1.mp3',
    media_url: 'https://example.com/incident_1.jpg',
    media_paths: ['path1', 'path2']
  };

  const testResponder = {
    name: 'Fire Department Unit 1',
    contact_number: '+639123456789',
    organization: 'City Fire Department'
  };

  // ========== Unit Tests: Encryption Utility ==========

  describe('Unit: Encryption Utility', () => {
    test('encrypt and decrypt should roundtrip correctly', () => {
      const original = 'sensitive data';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted.length).toBeGreaterThan(original.length);
    });

    only('encrypt should produce different output each time', () => {
      const data = 'sensitive data';
      const encrypted1 = encrypt(data);
      const encrypted2 = encrypt(data);
      
      // Same data, different encrypted output (due to random IV and salt)
      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(data);
      expect(decrypt(encrypted2)).toBe(data);
    });

    test('encrypt should throw error if ENCRYPTION_KEY is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => encrypt('data')).toThrow('ENCRYPTION_KEY');
      
      process.env.ENCRYPTION_KEY = originalKey;
    });

    test('decrypt should handle numbers as strings', () => {
      const latitude = 16.0419;
      const encrypted = encrypt(latitude.toString());
      const decrypted = parseFloat(decrypt(encrypted));
      
      expect(decrypted).toBe(latitude);
    });

    test('encrypt should handle JSON objects', () => {
      const data = { field1: 'value1', field2: 'value2' };
      const encrypted = encrypt(JSON.stringify(data));
      const decrypted = JSON.parse(decrypt(encrypted));
      
      expect(decrypted).toEqual(data);
    });
  });

  // ========== Unit Tests: EncryptedField Helper ==========

  describe('Unit: EncryptedField Helper', () => {
    test('encryptFields should encrypt specified fields only', () => {
      const data = {
        phone_number: '+639171234567',
        email: 'test@example.com',
        is_active: true
      };

      const result = encryptFields(data, ['phone_number', 'email']);

      expect(result.phone_number).not.toBe(data.phone_number);
      expect(result.email).not.toBe(data.email);
      expect(result.is_active).toBe(true); // Unencrypted field unchanged
    });

    test('encryptFields should skip null and empty values', () => {
      const data = {
        phone_number: '+639171234567',
        email: null,
        address: ''
      };

      expect(() => {
        encryptFields(data, ['phone_number', 'email', 'address']);
      }).not.toThrow();
    });

    test('decryptFields should decrypt specified fields only', () => {
      const encryptedPhone = encrypt('+639171234567');
      const encryptedEmail = encrypt('test@example.com');

      const data = {
        phone_number: encryptedPhone,
        email: encryptedEmail,
        is_active: true
      };

      const result = decryptFields(data, ['phone_number', 'email']);

      expect(result.phone_number).toBe('+639171234567');
      expect(result.email).toBe('test@example.com');
      expect(result.is_active).toBe(true);
    });

    test('decryptFields should handle type conversion', () => {
      const latitude = 16.0419;
      const encryptedLat = encrypt(latitude.toString());

      const data = {
        latitude: encryptedLat,
        status: 'pending'
      };

      const result = decryptFields(data, ['latitude'], { latitude: 'number' });

      expect(result.latitude).toBe(latitude);
      expect(typeof result.latitude).toBe('number');
    });

    test('decryptFields should handle JSON deserialization', () => {
      const mediaPaths = ['path1', 'path2', 'path3'];
      const encryptedPaths = encrypt(JSON.stringify(mediaPaths));

      const data = {
        media_paths: encryptedPaths
      };

      const result = decryptFields(data, ['media_paths'], { media_paths: 'json' });

      expect(Array.isArray(result.media_paths)).toBe(true);
      expect(result.media_paths).toEqual(mediaPaths);
    });
  });

  // ========== Integration Tests: User Model ==========

  describe('Integration: User Model Encryption', () => {
    let User;

    beforeAll(() => {
      User = require('../src/models/user');
    });

    test('User.create should encrypt sensitive fields', async () => {
      const user = await User.create(testUser);

      // Verify returned user has decrypted data
      expect(user.phone_number).toBe(testUser.phone_number);
      expect(user.email).toBe(testUser.email);
      expect(user.first_name).toBe(testUser.first_name);

      // Verify data is encrypted in database
      const dbResult = await pool.query(
        'SELECT phone_number, email, first_name FROM users WHERE user_id = $1',
        [user.user_id]
      );
      const dbUser = dbResult.rows[0];

      expect(dbUser.phone_number).not.toBe(testUser.phone_number);
      expect(dbUser.email).not.toBe(testUser.email);
      expect(dbUser.first_name).not.toBe(testUser.first_name);
    });

    test('User.findById should return decrypted data', async () => {
      const created = await User.create(testUser);
      const user = await User.findById(created.user_id);

      expect(user.phone_number).toBe(testUser.phone_number);
      expect(user.email).toBe(testUser.email);
      expect(user.first_name).toBe(testUser.first_name);
      expect(user.last_name).toBe(testUser.last_name);
      expect(user.address).toBe(testUser.address);
    });

    test('User.findByEmail should return decrypted data', async () => {
      const created = await User.create({
        ...testUser,
        email: `unique_${Date.now()}@example.com`
      });

      const user = await User.findByEmail(created.email);

      expect(user).toBeDefined();
      expect(user.phone_number).toBe(testUser.phone_number);
      expect(user.first_name).toBe(testUser.first_name);
    });

    test('User.getPaginated should return decrypted data', async () => {
      const result = await User.getPaginated(0, 10);

      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);

      // Verify all returned users have decrypted fields
      result.users.forEach(user => {
        if (user.phone_number) {
          expect(user.phone_number).toMatch(/^\+?[0-9]{7,15}$/); // Phone format
        }
        if (user.email) {
          expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Email format
        }
      });
    });

    afterEach(async () => {
      // Clean up test data
      await pool.query('DELETE FROM users WHERE email LIKE ?', [`test%`]);
    });
  });

  // ========== Integration Tests: Incident Model ==========

  describe('Integration: Incident Model Encryption', () => {
    let Incident;

    beforeAll(() => {
      Incident = require('../src/models/incident');
    });

    test('Incident.create should encrypt coordinates and description', async () => {
      const incident = await Incident.create({
        ...testIncident,
        severity_level: 'high'
      });

      // Verify returned incident has decrypted data
      expect(incident.latitude).toBe(testIncident.latitude);
      expect(incident.longitude).toBe(testIncident.longitude);
      expect(incident.description).toBe(testIncident.description);

      // Verify data is encrypted in database
      const dbResult = await pool.query(
        'SELECT latitude, longitude, description FROM incident_reports WHERE report_id = $1',
        [incident.report_id]
      );
      const dbIncident = dbResult.rows[0];

      expect(dbIncident.latitude).not.toBe(testIncident.latitude);
      expect(dbIncident.longitude).not.toBe(testIncident.longitude);
      expect(dbIncident.description).not.toBe(testIncident.description);
    });

    test('Incident.createWithAi should encrypt audio and transcription', async () => {
      const incident = await Incident.createWithAi({
        ...testIncident,
        severity_level: 'high',
        transcription: 'AI transcription: emergency call details',
        audio_path: '/uploads/audio/call_123.mp3'
      });

      // Verify returned incident has decrypted data
      expect(incident.transcription).toBe('AI transcription: emergency call details');
      expect(incident.audio_path).toBe('/uploads/audio/call_123.mp3');

      // Verify data is encrypted in database
      const dbResult = await pool.query(
        'SELECT transcription, audio_path FROM incident_reports WHERE report_id = $1',
        [incident.report_id]
      );
      const dbIncident = dbResult.rows[0];

      expect(dbIncident.transcription).not.toContain('emergency call');
      expect(dbIncident.audio_path).not.toBe('/uploads/audio/call_123.mp3');
    });

    test('Incident.findById should return decrypted coordinates', async () => {
      const created = await Incident.create({
        ...testIncident,
        severity_level: 'high'
      });

      const incident = await Incident.findById(created.report_id);

      expect(incident.latitude).toBe(testIncident.latitude);
      expect(incident.longitude).toBe(testIncident.longitude);
      expect(typeof incident.latitude).toBe('number');
      expect(typeof incident.longitude).toBe('number');
    });

    test('Incident.findAll should return decrypted data', async () => {
      const incidents = await Incident.findAll({ limit: 5, offset: 0 });

      expect(Array.isArray(incidents)).toBe(true);

      incidents.forEach(incident => {
        if (incident.latitude && incident.longitude) {
          expect(typeof incident.latitude).toBe('number');
          expect(typeof incident.longitude).toBe('number');
          expect(incident.latitude).toBeGreaterThanOrEqual(-90);
          expect(incident.latitude).toBeLessThanOrEqual(90);
          expect(incident.longitude).toBeGreaterThanOrEqual(-180);
          expect(incident.longitude).toBeLessThanOrEqual(180);
        }
      });
    });

    afterEach(async () => {
      // Clean up test data
      await pool.query('DELETE FROM incident_reports WHERE description LIKE ?', [`%Severe traffic%`]);
    });
  });

  // ========== Integration Tests: Responder Model ==========

  describe('Integration: Responder Model Encryption', () => {
    let Responder;

    beforeAll(() => {
      Responder = require('../src/models/responder');
    });

    test('Responder.create should encrypt contact_number and name', async () => {
      const responder = await Responder.create(testResponder);

      // Verify returned responder has decrypted data
      expect(responder.name).toBe(testResponder.name);
      expect(responder.contact_number).toBe(testResponder.contact_number);

      // Verify data is encrypted in database
      const dbResult = await pool.query(
        'SELECT name, contact_number FROM responders WHERE responder_id = $1',
        [responder.responder_id]
      );
      const dbResponder = dbResult.rows[0];

      expect(dbResponder.name).not.toBe(testResponder.name);
      expect(dbResponder.contact_number).not.toBe(testResponder.contact_number);
    });

    test('Responder.findById should return decrypted data', async () => {
      const created = await Responder.create(testResponder);
      const responder = await Responder.findById(created.responder_id);

      expect(responder.name).toBe(testResponder.name);
      expect(responder.contact_number).toBe(testResponder.contact_number);
    });

    test('Responder.findAll should return decrypted data', async () => {
      const responders = await Responder.findAll({ limit: 5, offset: 0 });

      expect(Array.isArray(responders)).toBe(true);

      responders.forEach(responder => {
        if (responder.contact_number) {
          expect(responder.contact_number).toMatch(/^\+?[0-9]{7,20}$/);
        }
        if (responder.name) {
          expect(typeof responder.name).toBe('string');
          expect(responder.name.length).toBeGreaterThan(0);
        }
      });
    });

    afterEach(async () => {
      // Clean up test data
      await pool.query('DELETE FROM responders WHERE name LIKE ?', [`%Fire Department%`]);
    });
  });

  // ========== GDPR Compliance Tests ==========

  describe('GDPR Compliance: Data Export & Deletion', () => {
    test('User data export should return decrypted PII', async () => {
      const User = require('../src/models/user');
      const user = await User.create(testUser);

      expect(user.phone_number).toBe(testUser.phone_number);
      expect(user.email).toBe(testUser.email);
      expect(user.first_name).toBe(testUser.first_name);

      // Verify all PII is accessible for data subject access requests
      const fields = ['phone_number', 'email', 'first_name', 'last_name', 'address'];
      fields.forEach(field => {
        expect(user[field]).toBeDefined();
      });

      await User.delete(user.user_id);
    });

    test('Deleted user data should not be recoverable', async () => {
      const User = require('../src/models/user');
      const user = await User.create({
        ...testUser,
        email: `delete_test_${Date.now()}@example.com`
      });

      const userId = user.user_id;
      await User.delete(userId);

      const deleted = await User.findById(userId);
      expect(deleted).toBeUndefined();
    });

    test('Cascade delete should remove all related incident data', async () => {
      const User = require('../src/models/user');
      const Incident = require('../src/models/incident');

      const user = await User.create({
        ...testUser,
        email: `cascade_test_${Date.now()}@example.com`
      });

      const incident = await Incident.create({
        ...testIncident,
        user_id: user.user_id,
        severity_level: 'high'
      });

      await User.delete(user.user_id);

      const deletedIncident = await Incident.findById(incident.report_id);
      expect(deletedIncident).toBeUndefined();
    });
  });

  // ========== Performance Tests ==========

  describe('Performance: Encryption Overhead', () => {
    test('Encryption should not significantly impact model operations', async () => {
      const User = require('../src/models/user');
      const iterations = 10;

      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await User.create({
          ...testUser,
          email: `perf_test_${i}_${Date.now()}@example.com`,
          phone_number: `+6391234567${i}`
        });
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      console.log(`\n   Avg time per User.create: ${avgTime.toFixed(2)}ms`);
      
      // Reasonable threshold: <200ms per operation for encrypted fields
      expect(avgTime).toBeLessThan(200);

      // Clean up
      await pool.query("DELETE FROM users WHERE email LIKE 'perf_test_%'");
    });
  });
});

module.exports = {};
