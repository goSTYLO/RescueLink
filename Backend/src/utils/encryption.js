const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;
const DECRYPT_CACHE_MAX_SIZE = 5000;

const decryptCache = new Map();

function readDecryptCache(ciphertext) {
  if (!decryptCache.has(ciphertext)) {
    return null;
  }
  const hit = decryptCache.get(ciphertext);
  // Refresh insertion order for simple LRU behavior.
  decryptCache.delete(ciphertext);
  decryptCache.set(ciphertext, hit);
  return hit;
}

function writeDecryptCache(ciphertext, plaintext) {
  decryptCache.set(ciphertext, plaintext);
  if (decryptCache.size <= DECRYPT_CACHE_MAX_SIZE) {
    return;
  }
  const oldestKey = decryptCache.keys().next().value;
  if (oldestKey) {
    decryptCache.delete(oldestKey);
  }
}

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

  const cached = readDecryptCache(encryptedData);
  if (cached !== null) {
    return cached;
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

  writeDecryptCache(encryptedData, decrypted);
  
  return decrypted;
}

/**
 * Returns true if the value looks like data encrypted with encrypt() (hex string, min length).
 */
function looksEncryptedValue(value) {
  return typeof value === 'string'
    && /^[0-9a-f]+$/i.test(value)
    && value.length >= 184
    && value.length % 2 === 0;
}

/**
 * Decrypts value if it looks encrypted; otherwise returns as-is. Never throws.
 */
function tryDecryptValue(value) {
  if (!looksEncryptedValue(value)) {
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Recursively decrypt any encrypted strings in an object or array.
 * If a string is decrypted and the result looks like JSON, it is parsed and recursively decrypted.
 */
function recursivelyDecrypt(obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    const decrypted = tryDecryptValue(obj);
    if (typeof decrypted === 'string' && (decrypted.trim().startsWith('{') || decrypted.trim().startsWith('['))) {
      try {
        return recursivelyDecrypt(JSON.parse(decrypted));
      } catch {
        return decrypted;
      }
    }
    return decrypted;
  }
  if (Array.isArray(obj)) return obj.map(recursivelyDecrypt);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = recursivelyDecrypt(v);
    return out;
  }
  return obj;
}

module.exports = {
  encrypt,
  decrypt,
  looksEncryptedValue,
  tryDecryptValue,
  recursivelyDecrypt,
};
