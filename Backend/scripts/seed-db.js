#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');
const { ROLES } = require('../src/config/roles');
const { encrypt } = require('../src/utils/encryption');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

console.log('🌱 Seeding database...');
console.log(`📍 Database URL: ${DATABASE_URL}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Password hashing utility
async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

function encryptNullable(value) {
  if (value === null || value === undefined) return null;
  return encrypt(String(value));
}

function estimateEncryptedHexLength(value) {
  if (value === null || value === undefined) return 0;
  const plainBytes = Buffer.byteLength(String(value), 'utf8');
  // hex(salt[64] + iv[12] + tag[16] + ciphertext[n]) => 2 * (92 + plainBytes)
  return 2 * (92 + plainBytes);
}

async function getColumnMeta(client, tableName, columnName) {
  const res = await client.query(
    `SELECT data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return res.rows[0] || null;
}

function shouldEncryptForColumn(columnMeta, value) {
  if (!columnMeta || value === null || value === undefined) return false;

  if (columnMeta.data_type === 'text') {
    return true;
  }

  const maxLen = columnMeta.character_maximum_length;
  if (!maxLen) {
    return false;
  }

  return estimateEncryptedHexLength(value) <= maxLen;
}

function maybeEncrypt(value, columnMeta) {
  if (value === null || value === undefined) return null;
  if (shouldEncryptForColumn(columnMeta, value)) {
    return encryptNullable(value);
  }
  return value;
}

// Sample data generators
const generateUsers = () => [
  // Admins (2)
  { first_name: 'Ariel', last_name: 'Admin', email: 'admin@rescuelink.test', phone_number: '639001000001', password: 'admin123', role: ROLES.ADMIN, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Bianca', last_name: 'Admin', email: 'admin2@rescuelink.test', phone_number: '639001000002', password: 'admin123', role: ROLES.ADMIN, address: 'Malur Barangay, Dagupan City, Pangasinan' },
  // Dispatchers (2)
  { first_name: 'Alice', last_name: 'Dispatcher', email: 'dispatcher@rescuelink.test', phone_number: '639002000001', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Bonuan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Bob', last_name: 'Dispatcher', email: 'dispatcher2@rescuelink.test', phone_number: '639002000002', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Bacnotan Barangay, Dagupan City, Pangasinan' },
  // Responders (2)
  { first_name: 'Charlie', last_name: 'Responder', email: 'responder@rescuelink.test', phone_number: '639003000001', password: 'responder123', role: ROLES.RESPONDER, address: 'Pantal Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Diana', last_name: 'Responder', email: 'responder2@rescuelink.test', phone_number: '639003000002', password: 'responder123', role: ROLES.RESPONDER, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  // Supervisors (2)
  { first_name: 'Evan', last_name: 'Supervisor', email: 'supervisor@rescuelink.test', phone_number: '639004000001', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Malur Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Fiona', last_name: 'Supervisor', email: 'supervisor2@rescuelink.test', phone_number: '639004000002', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Bonuan Barangay, Dagupan City, Pangasinan' },
  // Regular users (2)
  { first_name: 'John', last_name: 'Doe', email: 'user@rescuelink.test', phone_number: '639005000001', password: 'user123', role: ROLES.USER, address: 'Bacnotan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Jane', last_name: 'Smith', email: 'user2@rescuelink.test', phone_number: '639005000002', password: 'user123', role: ROLES.USER, address: 'Pantal Barangay, Dagupan City, Pangasinan' },
];

const generateResponders = () => [
  { name: 'Dagupan Fire Department', organization: 'Fire Services', contact_number: '09171234567', availability_status: 'available' },
  { name: 'Dagupan Medical Center', organization: 'Health Services', contact_number: '09179876543', availability_status: 'available' },
  { name: 'Dagupan Police Dept', organization: 'Law Enforcement', contact_number: '09172223333', availability_status: 'available' },
  { name: 'Red Cross - Dagupan', organization: 'Humanitarian', contact_number: '09173334444', availability_status: 'on_standby' },
  { name: 'Dagupan Civil Defense', organization: 'Disaster Management', contact_number: '09174445555', availability_status: 'available' },
];

const generateIncidents = (reportingUserIds) => {
  const incidentTypes = ['Fire', 'Accident', 'Crime', 'Medical', 'Natural Disaster', 'Other'];
  const severities = ['Green', 'Yellow', 'Red', 'Black'];
  const statuses = ['pending', 'in_progress', 'resolved', 'cancelled'];
  const barangays = ['Dagupan', 'Malur', 'Bonuan', 'Bacnotan', 'Pantal'];

  const baseIncidents = [
    {
      user_id: null,
      incident_type: incidentTypes[0],
      severity_level: severities[2],
      description: 'House fire at residential area. Smoke visible from street.',
      latitude: 16.0437,
      longitude: 120.3355,
      barangay: barangays[0],
      status: statuses[2],
    },
    {
      user_id: null,
      incident_type: incidentTypes[1],
      severity_level: severities[1],
      description: 'Car accident on main highway. Two vehicles involved.',
      latitude: 16.0450,
      longitude: 120.3360,
      barangay: barangays[1],
      status: statuses[1],
    },
    {
      user_id: null,
      incident_type: incidentTypes[3],
      severity_level: severities[2],
      description: 'Person collapsed in public area. Requires emergency medical attention.',
      latitude: 16.0425,
      longitude: 120.3345,
      barangay: barangays[2],
      status: statuses[2],
    },
    {
      user_id: null,
      incident_type: incidentTypes[2],
      severity_level: severities[1],
      description: 'Robbery attempt at convenience store.',
      latitude: 16.0440,
      longitude: 120.3350,
      barangay: barangays[3],
      status: statuses[0],
    },
    {
      user_id: null,
      incident_type: incidentTypes[4],
      severity_level: severities[1],
      description: 'Heavy flooding in low-lying areas.',
      latitude: 16.0435,
      longitude: 120.3340,
      barangay: barangays[4],
      status: statuses[0],
    },
    {
      user_id: null,
      incident_type: incidentTypes[0],
      severity_level: severities[3],
      description: 'Large wildfire spreading towards residential areas.',
      latitude: 16.0420,
      longitude: 120.3330,
      barangay: barangays[0],
      status: statuses[1],
    },
  ];
  return baseIncidents.map((incident, index) => ({
    ...incident,
    user_id: reportingUserIds[index % reportingUserIds.length]
  }));
};

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('\n🔄 Clearing existing data (maintaining referential integrity)...');

    // Delete in reverse dependency order
    await client.query('DELETE FROM dispatcher_login_otp');
    await client.query('DELETE FROM token_blacklist');
    await client.query('DELETE FROM dispatcher_audit_logs');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM dispatches');
    await client.query('DELETE FROM blockchain_records');
    await client.query('DELETE FROM ai_classifications');
    await client.query('DELETE FROM incident_reports');
    await client.query('DELETE FROM responders');
    await client.query('DELETE FROM users');

    console.log('✅ Cleared old data\n');

    const userColumnMeta = {
      first_name: await getColumnMeta(client, 'users', 'first_name'),
      last_name: await getColumnMeta(client, 'users', 'last_name'),
      email: await getColumnMeta(client, 'users', 'email'),
      phone_number: await getColumnMeta(client, 'users', 'phone_number'),
      address: await getColumnMeta(client, 'users', 'address'),
    };

    const incidentColumnMeta = {
      description: await getColumnMeta(client, 'incident_reports', 'description'),
      latitude: await getColumnMeta(client, 'incident_reports', 'latitude'),
      longitude: await getColumnMeta(client, 'incident_reports', 'longitude'),
      barangay: await getColumnMeta(client, 'incident_reports', 'barangay'),
    };

    // Seed users
    console.log('👤 Seeding users...');
    const users = generateUsers();
    const userIds = [];
    const userIdsByRole = {
      [ROLES.ADMIN]: [],
      [ROLES.DISPATCHER]: [],
      [ROLES.RESPONDER]: [],
      [ROLES.SUPERVISOR]: [],
      [ROLES.USER]: []
    };

    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      const encryptedFirstName = maybeEncrypt(user.first_name, userColumnMeta.first_name);
      const encryptedLastName = maybeEncrypt(user.last_name, userColumnMeta.last_name);
      const encryptedEmail = maybeEncrypt(user.email, userColumnMeta.email);
      const encryptedPhone = maybeEncrypt(user.phone_number, userColumnMeta.phone_number);
      const encryptedAddress = maybeEncrypt(user.address, userColumnMeta.address);
      const result = await client.query(
        `INSERT INTO users (first_name, last_name, email, phone_number, password, role, phone_verified, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING user_id`,
        [encryptedFirstName, encryptedLastName, encryptedEmail, encryptedPhone, hashedPassword, user.role, true, encryptedAddress]
      );
      const newUserId = result.rows[0].user_id;
      userIds.push(newUserId);
      userIdsByRole[user.role].push(newUserId);
    }
    console.log(`✅ Seeded ${users.length} users (2 admins, 2 dispatchers, 2 responders, 2 supervisors, 2 users)\n`);

    // Seed responders
    console.log('🚨 Seeding responders...');
    const responders = generateResponders();
    const responderIds = [];

    for (const responder of responders) {
      const result = await client.query(
        `INSERT INTO responders (name, organization, contact_number, availability_status)
         VALUES ($1, $2, $3, $4)
         RETURNING responder_id`,
        [responder.name, responder.organization, responder.contact_number, responder.availability_status]
      );
      responderIds.push(result.rows[0].responder_id);
    }
    console.log(`✅ Seeded ${responders.length} responders\n`);

    // Seed incidents
    console.log('🚨 Seeding incident reports...');
    const reportOwners = [
      ...userIdsByRole[ROLES.USER],
      ...userIdsByRole[ROLES.DISPATCHER],
      ...userIdsByRole[ROLES.SUPERVISOR]
    ];
    const incidents = generateIncidents(reportOwners);
    const incidentIds = [];

    for (const incident of incidents) {
      const encryptedDescription = maybeEncrypt(incident.description, incidentColumnMeta.description);
      const encryptedLatitude = maybeEncrypt(incident.latitude, incidentColumnMeta.latitude);
      const encryptedLongitude = maybeEncrypt(incident.longitude, incidentColumnMeta.longitude);
      const encryptedBarangay = maybeEncrypt(incident.barangay, incidentColumnMeta.barangay);
      const result = await client.query(
        `INSERT INTO incident_reports
         (user_id, incident_type, severity_level, description, latitude, longitude, barangay, status, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING report_id`,
        [incident.user_id, incident.incident_type, incident.severity_level, encryptedDescription,
         encryptedLatitude, encryptedLongitude, encryptedBarangay, incident.status, true]
      );
      incidentIds.push(result.rows[0].report_id);
    }
    console.log(`✅ Seeded ${incidents.length} incident reports\n`);

    // Seed dispatches (link some incidents to responders)
    console.log('📤 Seeding dispatches...');
    const dispatchCount = Math.min(incidentIds.length, responderIds.length);

    for (let i = 0; i < dispatchCount; i++) {
      await client.query(
        `INSERT INTO dispatches (report_id, responder_id, response_status)
         VALUES ($1, $2, $3)`,
        [incidentIds[i], responderIds[i % responderIds.length], i % 2 === 0 ? 'responded' : 'pending']
      );
    }
    console.log(`✅ Seeded ${dispatchCount} dispatches\n`);

    // Seed sample notifications
    console.log('💬 Seeding notifications...');
    for (let i = 0; i < Math.min(3, userIdsByRole[ROLES.USER].length); i++) {
      await client.query(
        `INSERT INTO notifications (user_id, report_id, message, sent_via)
         VALUES ($1, $2, $3, $4)`,
        [userIdsByRole[ROLES.USER][i], incidentIds[i], `Your incident report #${incidentIds[i]} has been processed.`, 'sms']
      );
    }
    console.log(`✅ Seeded sample notifications\n`);

    console.log('════════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!');
    console.log('════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   👤  Users: ${userIds.length} (2 admins, 2 dispatchers, 2 responders, 2 supervisors, 2 users)`);
    console.log(`   🚨 Responders: ${responderIds.length}`);
    console.log(`   📍 Incidents: ${incidentIds.length}`);
    console.log(`   📤 Dispatches: ${dispatchCount}`);
    console.log('\n🔑 Test Credentials (by role):');
    console.log('   Admins (password: admin123):');
    console.log('     - admin@rescuelink.test');
    console.log('     - admin2@rescuelink.test');
    console.log('   Dispatchers (password: dispatcher123):');
    console.log('     - dispatcher@rescuelink.test');
    console.log('     - dispatcher2@rescuelink.test');
    console.log('   Responders (password: responder123):');
    console.log('     - responder@rescuelink.test');
    console.log('     - responder2@rescuelink.test');
    console.log('   Supervisors (password: supervisor123):');
    console.log('     - supervisor@rescuelink.test');
    console.log('     - supervisor2@rescuelink.test');
    console.log('   Users (password: user123):');
    console.log('     - user@rescuelink.test');
    console.log('     - user2@rescuelink.test\n');

  } catch (err) {
    console.error('❌ Database seeding failed!');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
