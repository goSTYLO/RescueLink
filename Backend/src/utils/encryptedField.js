/**
 * Encrypted Field Helper with Console Logging
 * 
 * Provides utility functions for transparent encryption/decryption of sensitive fields.
 * Includes detailed console logging to show encryption/decryption at each layer.
 */

const { encrypt, decrypt } = require('./encryption');

/**
 * Encrypt sensitive fields in an object
 * @param {object} data - Object containing fields to encrypt
 * @param {array} fieldsToEncrypt - Array of field names to encrypt
 * @returns {object} - New object with encrypted fields
 */
function encryptFields(data, fieldsToEncrypt = []) {
  if (!data || Object.keys(data).length === 0) {
    return data;
  }

  const fieldsToEncryptHere = fieldsToEncrypt.filter(f => data[f] !== null && data[f] !== undefined && data[f] !== '');
  if (fieldsToEncryptHere.length > 0) {
    console.log('\n🔐 [ENCRYPT] Starting encryption:');
    console.log(`   Fields: [${fieldsToEncryptHere.join(', ')}]`);
  }

  const encrypted = { ...data };

  fieldsToEncryptHere.forEach(field => {
    try {
      const originalValue = encrypted[field];
      const originalType = typeof originalValue === 'object' ? 'json' : typeof originalValue;
      
      // Log before encryption
      const displayValue = typeof originalValue === 'object' 
        ? JSON.stringify(originalValue).substring(0, 50) 
        : String(originalValue).substring(0, 50);
      console.log(`   📝 Input[${field}]:  ${displayValue} (type: ${originalType})`);

      // Handle different types - convert to string before encryption
      const valueToEncrypt = typeof originalValue === 'object' 
        ? JSON.stringify(originalValue) 
        : String(originalValue);
      
      const encryptedValue = encrypt(valueToEncrypt);
      encrypted[field] = encryptedValue;

      // Log after encryption
      const hexPreview = encryptedValue.substring(0, 20) + '...';
      console.log(`   ✅ Output[${field}]: ${hexPreview} (${encryptedValue.length} hex chars - encrypted)`);
    } catch (err) {
      console.error(`   ❌ Error encrypting field ${field}:`, err.message);
      throw err;
    }
  });

  if (fieldsToEncryptHere.length > 0) {
    console.log('   [ENCRYPT] Complete\n');
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in an object with detailed logging
 * Provides graceful fallback for plaintext data (pre-encryption legacy data)
 * @param {object} data - Object containing fields to decrypt
 * @param {array} fieldsToDecrypt - Array of field names to decrypt
 * @param {object} fieldTypes - Map of field names to their original types for deserialization
 *                             Example: { media_paths: 'json', latitude: 'number' }
 * @returns {object} - New object with decrypted fields
 */
function decryptFields(data, fieldsToDecrypt = [], fieldTypes = {}) {
  if (!data || Object.keys(data).length === 0) {
    return data;
  }

  const fieldsToDecryptHere = fieldsToDecrypt.filter(f => data[f] !== null && data[f] !== undefined && data[f] !== '');
  if (fieldsToDecryptHere.length > 0) {
    console.log('\n🔓 [DECRYPT] Starting decryption:');
    console.log(`   Fields: [${fieldsToDecryptHere.join(', ')}]`);
  }

  const decrypted = { ...data };

  fieldsToDecryptHere.forEach(field => {
    if (decrypted[field] !== null && decrypted[field] !== undefined && decrypted[field] !== '') {
      try {
        const fieldValue = String(decrypted[field]);
        const isLikelyEncrypted = /^[0-9a-f]{100,}$/.test(fieldValue);
        const dbPreview = fieldValue.substring(0, 20) + '...';

        console.log(`   📊 Database[${field}]: ${dbPreview} (${fieldValue.length} hex chars)`);

        if (isLikelyEncrypted) {
          console.log(`      Status: ENCRYPTED (detected by hex pattern)`);
          // Try to decrypt
          try {
            const decryptedValue = decrypt(fieldValue);
            console.log(`      🔑 Decrypted: ${String(decryptedValue).substring(0, 50)}`);
            
            // Restore original type if specified
            if (fieldTypes[field] === 'json') {
              try {
                const parsed = JSON.parse(decryptedValue);
                decrypted[field] = parsed;
                console.log(`      ✅ TypeConvert: JSON parsed successfully`);
              } catch (e) {
                decrypted[field] = decryptedValue;
                console.log(`      ⚠️  TypeConvert: JSON parse failed, keeping as string`);
              }
            } else if (fieldTypes[field] === 'number') {
              const numValue = parseFloat(decryptedValue);
              decrypted[field] = numValue;
              console.log(`      ✅ TypeConvert: String "${decryptedValue}" → Number ${numValue}`);
            } else if (fieldTypes[field] === 'boolean') {
              decrypted[field] = decryptedValue === 'true';
              console.log(`      ✅ TypeConvert: String "${decryptedValue}" → Boolean ${decryptedValue === 'true'}`);
            } else {
              decrypted[field] = decryptedValue;
              console.log(`      ✅ TypeConvert: Kept as string`);
            }
          } catch (decryptErr) {
            console.warn(`      ⚠️  Decryption failed: ${decryptErr.message}, keeping original value`);
          }
        } else {
          console.log(`      Status: PLAINTEXT (legacy data - no encryption detected)`);
          // Not encrypted - apply type conversion if needed
          if (fieldTypes[field] === 'json') {
            try {
              const parsed = JSON.parse(fieldValue);
              decrypted[field] = parsed;
              console.log(`      ✅ TypeConvert: JSON parsed successfully`);
            } catch (e) {
              console.log(`      ℹ️  TypeConvert: Kept as string (not valid JSON)`);
            }
          } else if (fieldTypes[field] === 'number') {
            const numValue = parseFloat(fieldValue);
            decrypted[field] = numValue;
            console.log(`      ✅ TypeConvert: String "${fieldValue}" → Number ${numValue}`);
          } else if (fieldTypes[field] === 'boolean') {
            decrypted[field] = fieldValue === 'true';
            console.log(`      ✅ TypeConvert: String "${fieldValue}" → Boolean ${fieldValue === 'true'}`);
          }
        }

        console.log(`   ✅ Final[${field}]: ${typeof decrypted[field] === 'object' ? JSON.stringify(decrypted[field]).substring(0, 50) : String(decrypted[field]).substring(0, 50)} (type: ${typeof decrypted[field]})`);
      } catch (err) {
        console.error(`   ❌ Unexpected error processing field ${field}:`, err.message);
      }
    }
  });

  if (fieldsToDecryptHere.length > 0) {
    console.log('   [DECRYPT] Complete\n');
  }

  return decrypted;
}

/**
 * Create an array of decrypted objects from database query results
 * @param {array} rows - Array of row objects from database query
 * @param {array} fieldsToDecrypt - Array of field names to decrypt
 * @param {object} fieldTypes - Map of field names to their original types
 * @returns {array} - Array of objects with decrypted fields
 */
function decryptRows(rows, fieldsToDecrypt = [], fieldTypes = {}) {
  if (!Array.isArray(rows)) {
    return rows;
  }

  if (rows.length > 0) {
    console.log(`\n📦 [BATCH] Decrypting ${rows.length} row(s)...`);
  }

  const decrypted = rows.map((row, idx) => {
    if (fieldsToDecrypt.some(f => row[f])) {
      console.log(`   Row ${idx + 1}/${rows.length}:`);
    }
    return decryptFields(row, fieldsToDecrypt, fieldTypes);
  });

  if (rows.length > 0) {
    console.log(`📦 [BATCH] Complete\n`);
  }

  return decrypted;
}

module.exports = {
  encryptFields,
  decryptFields,
  decryptRows
};
