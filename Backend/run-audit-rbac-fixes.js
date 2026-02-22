const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function runFixes() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        🔧 Fixing Audit Logs & RBAC Authorization              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Check current column type
    console.log('📊 Step 1: Checking current column type...');
    const columnCheck = await pool.query(`
      SELECT data_type, column_name, table_name
      FROM information_schema.columns 
      WHERE table_name = 'dispatcher_audit_logs' AND column_name = 'details'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('⚠️  Warning: dispatcher_audit_logs.details column not found');
      console.log('   Table might not exist yet. Skipping migration.\n');
      process.exit(0);
    }

    const currentType = columnCheck.rows[0].data_type;
    console.log(`   Current type: ${currentType}`);

    if (currentType === 'text') {
      console.log('   ✅ Column already TEXT - migration not needed\n');
    } else {
      console.log(`   📝 Need to convert from ${currentType} to TEXT\n`);

      // 2. Run migration
      console.log('📊 Step 2: Running database migration...');
      const migrationPath = path.join(__dirname, 'migrations', 'fix_audit_logs_details_to_text.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await pool.query(migrationSQL);
      console.log('   ✅ Migration completed successfully\n');
    }

    // 3. Verify changes
    console.log('📊 Step 3: Verifying changes...');
    const verifyCheck = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dispatcher_audit_logs' AND column_name = 'details'
    `);

    const newType = verifyCheck.rows[0].data_type;
    if (newType === 'text') {
      console.log('   ✅ Verification passed: details column is TEXT\n');
    } else {
      console.error(`   ❌ Verification failed: Column is ${newType}, expected TEXT\n`);
      process.exit(1);
    }

    // 4. Test audit log creation
    console.log('📊 Step 4: Testing audit log creation with encrypted details...');
    
    // Get a valid user_id for testing
    const userCheck = await pool.query('SELECT user_id FROM users LIMIT 1');
    
    if (userCheck.rows.length > 0) {
      const testUserId = userCheck.rows[0].user_id;
      const { encryptFields } = require('./src/utils/encryptedField');

      const testDetails = { test: true, method: 'migration-test', timestamp: new Date().toISOString() };
      const detailsString = JSON.stringify(testDetails);
      const encrypted = encryptFields({ details: detailsString }, ['details']);

      const testResult = await pool.query(`
        INSERT INTO dispatcher_audit_logs(user_id, action, resource_type, details, ip_address)
        VALUES($1, $2, $3, $4, $5) RETURNING id
      `, [testUserId, 'test', 'migration', encrypted.details, '127.0.0.1']);

      if (testResult.rows[0]) {
        console.log('   ✅ Test insert successful (ID: ' + testResult.rows[0].id + ')');
        
        // Clean up test record
        await pool.query('DELETE FROM dispatcher_audit_logs WHERE id = $1', [testResult.rows[0].id]);
        console.log('   ✅ Test record cleaned up\n');
      }
    } else {
      console.log('   ⚠️  Skipping test insert (no users in database)\n');
    }

    // Summary
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ALL FIXES APPLIED                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Changes Applied:\n');
    console.log('   1. ✅ Database: dispatcher_audit_logs.details → TEXT (supports encrypted strings)');
    console.log('   2. ✅ Code: auditLog.js → stringify JSON before encrypt, parse after decrypt');
    console.log('   3. ✅ RBAC: admin.js → DISPATCHER can access GET /api/admin/users/:id');
    console.log('   4. ✅ RBAC: admin.js → Other admin routes remain ADMIN-only\n');

    console.log('🎯 Next Steps:\n');
    console.log('   1. Backend server will auto-reload (nodemon)');
    console.log('   2. Re-run your Postman collection');
    console.log('   3. Check logs - audit creation should work now');
    console.log('   4. Dispatcher should access user details endpoint\n');

    console.log('✅ Ready to test!\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error applying fixes:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runFixes();
