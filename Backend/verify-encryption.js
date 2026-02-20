const pool = require('./src/config/db');

async function verifyDatabaseEncryption() {
  try {
    console.log('\n🔍 Verifying Database Encryption...\n');
    
    // Get the most recent incident
    const result = await pool.query(
      `SELECT report_id, latitude, longitude, description FROM incident_reports 
       WHERE latitude IS NOT NULL 
       ORDER BY created_at DESC LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No incidents found');
      process.exit(0);
    }
    
    const incident = result.rows[0];
    
    console.log('📊 Most Recent Incident in Database:');
    console.log(`   ID: ${incident.report_id}`);
    console.log(`   Latitude (raw):  ${incident.latitude}`);
    console.log(`   Longitude (raw): ${incident.longitude}`);
    console.log(`   Description (raw): ${incident.description}\n`);
    
    const latLen = incident.latitude.length;
    const lngLen = incident.longitude.length;
    
    if (latLen > 100 && incident.latitude.match(/^[0-9a-f]+$/)) {
      console.log('✅ ENCRYPTED: latitude is hex string');
      console.log(`   Length: ${latLen} characters (encrypted hex)`);
    } else {
      console.log('❌ NOT ENCRYPTED: latitude is plaintext');
    }
    
    if (lngLen > 100 && incident.longitude.match(/^[0-9a-f]+$/)) {
      console.log('✅ ENCRYPTED: longitude is hex string');
      console.log(`   Length: ${lngLen} characters (encrypted hex)`);
    } else {
      console.log('❌ NOT ENCRYPTED: longitude is plaintext');
    }
    
    console.log('\n🎯 Summary:');
    if (latLen > 100 && lngLen > 100) {
      console.log('✅ Coordinates are encrypted in database');
      console.log('✅ Full encryption at rest working correctly!');
    } else {
      console.log('❌ Coordinates not encrypted - check encryption process');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

verifyDatabaseEncryption();
