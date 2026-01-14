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
    
    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created: users');
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
