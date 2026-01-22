const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {string} - Encrypted data as hex string (salt + iv + tag + encrypted)
 * @throws {Error} - If ENCRYPTION_KEY is not set
 */
function encrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (typeof text !== 'string') {
    throw new Error('Text to encrypt must be a string');
  }

  // Generate a random salt
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive key from encryption key and salt
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
  
  // Generate a random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine salt + iv + tag + encrypted data
  return salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted;
}

/**
 * Decrypts data encrypted with encrypt()
 * @param {string} encryptedData - The encrypted data as hex string
 * @returns {string} - Decrypted text
 * @throws {Error} - If ENCRYPTION_KEY is not set or decryption fails
 */
function decrypt(encryptedData) {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a string');
  }

  // Extract salt, IV, tag, and encrypted data
  const salt = Buffer.from(encryptedData.slice(0, SALT_LENGTH * 2), 'hex');
  const iv = Buffer.from(encryptedData.slice(SALT_LENGTH * 2, TAG_POSITION * 2), 'hex');
  const tag = Buffer.from(encryptedData.slice(TAG_POSITION * 2, ENCRYPTED_POSITION * 2), 'hex');
  const encrypted = encryptedData.slice(ENCRYPTED_POSITION * 2);
  
  // Derive key from encryption key and salt
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
