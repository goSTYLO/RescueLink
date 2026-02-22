const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function runEncryptedFieldsMigration() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🔧 Fixing Encrypted Field Column Types (VARCHAR→TEXT)    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Check current column types
    console.log('📊 Step 1: Checking current column types...\n');
    
    const typeCheck = await pool.query(`
      SELECT table_name, column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name IN ('users', 'responders', 'incident_reports', 'dispatcher_audit_logs')
      AND column_name IN (
        'phone_number', 'email', 'first_name', 'last_name', 'address',
        'contact_number', 'name', 'audio_path', 'media_url', 'media_paths', 'ip_address'
      )
      ORDER BY table_name, column_name
    `);

    console.log('   Current types:');
    typeCheck.rows.forEach(row => {
      const maxLen = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      console.log(`   - ${row.table_name}.${row.column_name}: ${row.data_type}${maxLen}`);
    });
    console.log('');

    // Step 2: Run migration
    console.log('📊 Step 2: Running migration...\n');
    
    const migrationPath = path.join(__dirname, 'migrations', 'fix_encrypted_fields_varchar_to_text.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    console.log('   ✅ Migration completed successfully\n');

    // Step 3: Verify changes
    console.log('📊 Step 3: Verifying all columns are TEXT...\n');
    
    const verifyCheck = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_name IN ('users', 'responders', 'incident_reports', 'dispatcher_audit_logs')
      AND column_name IN (
        'phone_number', 'email', 'first_name', 'last_name', 'address',
        'contact_number', 'name', 'audio_path', 'media_url', 'media_paths', 'ip_address'
      )
      ORDER BY table_name, column_name
    `);

    let allText = true;
    console.log('   After migration:');
    verifyCheck.rows.forEach(row => {
      const status = row.data_type === 'text' ? '✅' : '❌';
      console.log(`   ${status} ${row.table_name}.${row.column_name}: ${row.data_type}`);
      if (row.data_type !== 'text') allText = false;
    });
    console.log('');

    if (!allText) {
      throw new Error('Not all columns were successfully migrated to TEXT');
    }

    console.log('   ✅ Verification passed: All encrypted fields are TEXT\n');

    // Step 4: Test user registration with encrypted fields
    console.log('📊 Step 4: Testing user creation with long encrypted values...\n');
    
    // Simulate encrypted hex strings (200+ chars)
    const testPhone = '0'.repeat(210); // Simulate 210 char encrypted phone
    const testEmail = '1'.repeat(242); // Simulate 242 char encrypted email
    const testFirstName = '2'.repeat(194); // Simulate 194 char encrypted first_name
    const testLastName = '3'.repeat(196); // Simulate 196 char encrypted last_name

    const testResult = await pool.query(`
      INSERT INTO users(phone_number, email, first_name, last_name, password, role)
      VALUES($1, $2, $3, $4, $5, $6) RETURNING user_id
    `, [testPhone, testEmail, testFirstName, testLastName, 'test_pass', 'user']);

    if (testResult.rows[0]) {
      console.log(`   ✅ Test user created (ID: ${testResult.rows[0].user_id})`);
      console.log(`   ✅ Long encrypted values (200+ chars) accepted`);
      
      // Clean up test user
      await pool.query('DELETE FROM users WHERE user_id = $1', [testResult.rows[0].user_id]);
      console.log('   ✅ Test user cleaned up\n');
    }

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ALL MIGRATIONS APPLIED                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Summary:\n');
    console.log('   ✅ Users table: phone_number, email, first_name, last_name, address → TEXT');
    console.log('   ✅ Responders table: contact_number, name → TEXT');
    console.log('   ✅ Incident_reports table: audio_path, media_url, media_paths → TEXT');
    console.log('   ✅ Dispatcher_audit_logs table: ip_address → TEXT');
    console.log('');
    console.log('🎯 Result: All encrypted fields can now store 200+ character hex strings\n');
    console.log('✅ User and dispatcher registration should work now!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runEncryptedFieldsMigration();
