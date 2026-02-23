#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_ORDER = [
  'add_dispatcher_audit_logs.sql',
  'add_token_blacklist.sql',
  'add_dispatcher_login_otp.sql',
  'add_incident_barangay.sql',
  'add_incident_verified.sql',
  'add_ai_fields.sql',
  'add_upload_scan_fields.sql',
];

console.log('🔧 Setting up database...');
console.log(`📍 Database URL: ${DATABASE_URL}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('📝 Executing schema...');
    await client.query(schema);

    console.log('📝 Running migrations...');
    for (const filename of MIGRATION_ORDER) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      if (fs.existsSync(filepath)) {
        const sql = fs.readFileSync(filepath, 'utf8');
        await client.query(sql);
        console.log(`   ✓ ${filename}`);
      }
    }

    console.log('✅ Database setup completed successfully!');
  } catch (err) {
    console.error('❌ Database setup failed!');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
