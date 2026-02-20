/**
 * Migration Script: Encrypt At Rest
 * 
 * This script encrypts all sensitive fields in the database.
 * Run this script after deploying the encryption changes.
 * 
 * Usage: node migrate-encryption.js [--dry-run] [--table TABLE_NAME]
 * 
 * Options:
 *   --dry-run          Show what would be encrypted without making changes
 *   --table TABLE_NAME Encrypt only specific table (users, incident_reports, responders, dispatcher_audit_logs)
 */

require('dotenv').config();
const pool = require('../src/config/db');
const { encryptFields } = require('../src/utils/encryptedField');

// Define sensitive fields per table
const ENCRYPTION_CONFIG = {
  users: {
    fields: ['phone_number', 'email', 'first_name', 'last_name', 'address'],
    primaryKey: 'user_id'
  },
  incident_reports: {
    fields: ['latitude', 'longitude', 'description', 'transcription', 'audio_path', 'media_url', 'media_paths'],
    primaryKey: 'report_id'
  },
  responders: {
    fields: ['contact_number', 'name'],
    primaryKey: 'responder_id'
  },
  dispatcher_audit_logs: {
    fields: ['ip_address', 'details'],
    primaryKey: 'id'
  }
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tableArg = args.find(arg => arg.startsWith('--table='))?.split('=')[1];

async function encryptTable(tableName, config, dryRunMode = false) {
  console.log(`\n📋 ${dryRunMode ? '[DRY RUN] ' : ''}Processing table: ${tableName}`);
  console.log(`   Sensitive fields: ${config.fields.join(', ')}`);

  try {
    // Fetch all records from the table
    const res = await pool.query(`SELECT * FROM ${tableName}`);
    const records = res.rows;
    console.log(`   Total records: ${records.length}`);

    if (records.length === 0) {
      console.log(`   ✓ No records to encrypt`);
      return { success: true, encrypted: 0 };
    }

    let encryptedCount = 0;
    const updates = [];

    // Prepare encrypted updates for each record
    for (const record of records) {
      try {
        // Check if any field needs encryption (not all null/empty)
        const hasDataToEncrypt = config.fields.some(field => 
          record[field] !== null && record[field] !== undefined && record[field] !== ''
        );

        if (!hasDataToEncrypt) {
          continue;
        }

        // Encrypt the sensitive fields
        const encrypted = encryptFields(record, config.fields);

        // Build update query
        const setClause = config.fields
          .map((field, index) => `${field} = $${index + 1}`)
          .join(', ');

        const query = `UPDATE ${tableName} SET ${setClause} WHERE ${config.primaryKey} = $${config.fields.length + 1}`;
        const values = [...config.fields.map(field => encrypted[field]), record[config.primaryKey]];

        updates.push({ query, values, recordId: record[config.primaryKey] });
        encryptedCount++;
      } catch (err) {
        console.error(`   ❌ Error preparing encryption for ${config.primaryKey}=${record[config.primaryKey]}: ${err.message}`);
      }
    }

    // Execute updates
    if (!dryRunMode && updates.length > 0) {
      console.log(`   🔄 Encrypting ${updates.length} records...`);

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (let i = 0; i < updates.length; i++) {
          const { query, values} = updates[i];
          await client.query(query, values);

          // Progress indicator
          if ((i + 1) % 10 === 0 || i === updates.length - 1) {
            process.stdout.write(`\r   Progress: ${i + 1}/${updates.length}`);
          }
        }

        await client.query('COMMIT');
        console.log(`\n   ✅ Successfully encrypted ${updates.length} records\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else if (dryRunMode && updates.length > 0) {
      console.log(`   📊 DRY RUN: Would encrypt ${updates.length} records`);
      console.log(`   Sample operations:`);
      updates.slice(0, 3).forEach(({ recordId }) => {
        console.log(`     - ${config.primaryKey}=${recordId}`);
      });
      if (updates.length > 3) {
        console.log(`     ... and ${updates.length - 3} more records`);
      }
    } else {
      console.log(`   ℹ️  No records with data to encrypt`);
    }

    return { success: true, encrypted: encryptedCount };
  } catch (err) {
    console.error(`   ❌ Error processing table: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 RescueLink Encryption at Rest Migration');
  console.log('='.repeat(60));

  if (!process.env.ENCRYPTION_KEY) {
    console.error('\n❌ ERROR: ENCRYPTION_KEY environment variable is not set!');
    console.error('   Please set ENCRYPTION_KEY in .env file before running this migration.');
    process.exit(1);
  }

  console.log(`\n⚙️  Configuration:`);
  console.log(`   ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY.substring(0, 10)}...`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (changes will be applied)'}`);

  // Determine which tables to encrypt
  const tablesToProcess = tableArg 
    ? [tableArg] 
    : Object.keys(ENCRYPTION_CONFIG);

  // Validate table names
  const invalidTables = tablesToProcess.filter(t => !ENCRYPTION_CONFIG[t]);
  if (invalidTables.length > 0) {
    console.error(`\n❌ ERROR: Invalid table names: ${invalidTables.join(', ')}`);
    console.error(`   Available tables: ${Object.keys(ENCRYPTION_CONFIG).join(', ')}`);
    process.exit(1);
  }

  const results = {};
  let totalEncrypted = 0;

  try {
    // Test database connection
    const connTest = await pool.query('SELECT 1');
    console.log(`\n✅ Database connection successful`);

    // Process each table
    for (const tableName of tablesToProcess) {
      const config = ENCRYPTION_CONFIG[tableName];
      const result = await encryptTable(tableName, config, dryRun);
      results[tableName] = result;
      if (result.success) {
        totalEncrypted += result.encrypted || 0;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));

    Object.entries(results).forEach(([table, result]) => {
      if (result.success) {
        console.log(`✅ ${table}: ${result.encrypted || 0} records encrypted`);
      } else {
        console.log(`❌ ${table}: ${result.error}`);
      }
    });

    console.log(`\n📈 Total: ${totalEncrypted} records encrypted`);

    if (dryRun) {
      console.log(`\n💡 This was a DRY RUN. Run without --dry-run to apply changes.`);
    } else {
      console.log(`\n✅ Encryption migration completed successfully!`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { encryptTable };
