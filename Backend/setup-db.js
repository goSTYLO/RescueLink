#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getPgPoolConfig, formatDatabaseTarget } = require('./src/config/pgPool');
const { MIGRATION_ORDER } = require('./migrations/migrationOrder');

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

console.log('🔧 Setting up database...');
console.log(`📍 Database: ${formatDatabaseTarget()}`);

const pool = new Pool(getPgPoolConfig());

async function setupDatabase() {
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    console.log('📝 Executing schema...');
    await client.query(schema);

    console.log('📝 Running migrations...');
    for (const filename of MIGRATION_ORDER) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      if (!fs.existsSync(filepath)) {
        console.warn(`   ⚠ Migration file not found: ${filename}`);
        continue;
      }
      const sql = fs.readFileSync(filepath, 'utf8');
      await client.query(sql);
      console.log(`   ✓ ${filename}`);
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
