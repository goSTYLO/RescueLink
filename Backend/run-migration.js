const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    console.log('📝 Reading migration file...');
    
    const migrationPath = path.join(__dirname, 'migrations', 'change_coordinates_to_text_for_encryption.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('💾 Executing migration...\n');
    await pool.query(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Changes made:');
    console.log('   • Changed latitude from DOUBLE PRECISION to TEXT');
    console.log('   • Changed longitude from DOUBLE PRECISION to TEXT');
    console.log('   • Updated index: idx_incident_reports_location');
    console.log('\n🎯 Reason: Support encrypted coordinate storage (hex strings in DB)');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();
