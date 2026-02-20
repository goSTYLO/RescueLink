#!/usr/bin/env node

require('dotenv').config();
const pool = require('../src/config/db');
const bcryptjs = require('bcryptjs');
const { encryptFields } = require('../src/utils/encryptedField');
const { ROLES } = require('../src/config/roles');

console.log('🌱 Seeding database with encryption and RBAC...');

// Password hashing utility
async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

// Sample data generators
const generateUsers = () => [
  // Admin (1)
  { first_name: 'Super', last_name: 'Admin', email: 'admin@rescuelink.test', phone_number: '639000000000', password: 'admin123', role: ROLES.ADMIN, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  // Dispatchers (2)
  { first_name: 'Alice', last_name: 'Dispatcher', email: 'dispatcher@rescuelink.test', phone_number: '639001234567', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Bob', last_name: 'Dispatcher', email: 'dispatcher2@rescuelink.test', phone_number: '639009876543', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Malur Barangay, Dagupan City, Pangasinan' },
  // Regular users (14)
  { first_name: 'Charlie', last_name: 'Firefighter', email: 'user1@rescuelink.test', phone_number: '639111111111', password: 'user123', role: ROLES.USER, address: 'Bonuan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Diana', last_name: 'EMT', email: 'user2@rescuelink.test', phone_number: '639222222222', password: 'user123', role: ROLES.USER, address: 'Bacnotan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Evan', last_name: 'Police', email: 'user3@rescuelink.test', phone_number: '639333333333', password: 'user123', role: ROLES.USER, address: 'Pantal Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Fiona', last_name: 'Nurse', email: 'user4@rescuelink.test', phone_number: '639444444444', password: 'user123', role: ROLES.USER, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'George', last_name: 'Rescuer', email: 'user5@rescuelink.test', phone_number: '639555555555', password: 'user123', role: ROLES.USER, address: 'Malur Barangay, Dagupan City, Pangasinan' },
  { first_name: 'John', last_name: 'Doe', email: 'user@rescuelink.test', phone_number: '639666666666', password: 'user123', role: ROLES.USER, address: 'Bonuan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Jane', last_name: 'Smith', email: 'user6@rescuelink.test', phone_number: '639777777777', password: 'user123', role: ROLES.USER, address: 'Bacnotan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Michael', last_name: 'Johnson', email: 'user7@rescuelink.test', phone_number: '639888888888', password: 'user123', role: ROLES.USER, address: 'Pantal Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Sarah', last_name: 'Williams', email: 'user8@rescuelink.test', phone_number: '639999999999', password: 'user123', role: ROLES.USER, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'David', last_name: 'Brown', email: 'user9@rescuelink.test', phone_number: '639101010101', password: 'user123', role: ROLES.USER, address: 'Malur Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Emma', last_name: 'Davis', email: 'user10@rescuelink.test', phone_number: '639121212121', password: 'user123', role: ROLES.USER, address: 'Bonuan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Frank', last_name: 'Miller', email: 'user11@rescuelink.test', phone_number: '639131313131', password: 'user123', role: ROLES.USER, address: 'Bacnotan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Grace', last_name: 'Wilson', email: 'user12@rescuelink.test', phone_number: '639141414141', password: 'user123', role: ROLES.USER, address: 'Pantal Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Henry', last_name: 'Moore', email: 'user13@rescuelink.test', phone_number: '639151515151', password: 'user123', role: ROLES.USER, address: 'Dagupan Barangay, Dagupan City, Pangasinan' },
  { first_name: 'Isabella', last_name: 'Taylor', email: 'user14@rescuelink.test', phone_number: '639161616161', password: 'user123', role: ROLES.USER, address: 'Malur Barangay, Dagupan City, Pangasinan' },
];

const generateResponders = () => [
  { name: 'Dagupan Fire Department', organization: 'Fire Services', contact_number: '09171234567', availability_status: 'available' },
  { name: 'Dagupan Medical Center', organization: 'Health Services', contact_number: '09179876543', availability_status: 'available' },
  { name: 'Dagupan Police Dept', organization: 'Law Enforcement', contact_number: '09172223333', availability_status: 'available' },
  { name: 'Red Cross - Dagupan', organization: 'Humanitarian', contact_number: '09173334444', availability_status: 'on_standby' },
  { name: 'Dagupan Civil Defense', organization: 'Disaster Management', contact_number: '09174445555', availability_status: 'available' },
];

const generateIncidents = (userIds) => {
  const incidentTypes = ['Fire', 'Accident', 'Crime', 'Medical', 'Natural Disaster', 'Other'];
  const severities = ['Green', 'Yellow', 'Red', 'Black'];
  const statuses = ['pending', 'in_progress', 'resolved', 'cancelled'];
  const barangays = ['Dagupan', 'Malur', 'Bonuan', 'Bacnotan', 'Pantal'];

  return [
    {
      user_id: userIds[6],
      incident_type: incidentTypes[0],
      severity_level: severities[2],
      description: 'House fire at residential area. Smoke visible from street.',
      latitude: 16.0437,
      longitude: 120.3355,
      barangay: barangays[0],
      status: statuses[2],
    },
    {
      user_id: userIds[7],
      incident_type: incidentTypes[1],
      severity_level: severities[1],
      description: 'Car accident on main highway. Two vehicles involved.',
      latitude: 16.0450,
      longitude: 120.3360,
      barangay: barangays[1],
      status: statuses[1],
    },
    {
      user_id: userIds[8],
      incident_type: incidentTypes[3],
      severity_level: severities[2],
      description: 'Person collapsed in public area. Requires emergency medical attention.',
      latitude: 16.0425,
      longitude: 120.3345,
      barangay: barangays[2],
      status: statuses[2],
    },
    {
      user_id: userIds[9],
      incident_type: incidentTypes[2],
      severity_level: severities[1],
      description: 'Robbery attempt at convenience store.',
      latitude: 16.0440,
      longitude: 120.3350,
      barangay: barangays[3],
      status: statuses[0],
    },
    {
      user_id: userIds[10],
      incident_type: incidentTypes[4],
      severity_level: severities[1],
      description: 'Heavy flooding in low-lying areas.',
      latitude: 16.0435,
      longitude: 120.3340,
      barangay: barangays[4],
      status: statuses[0],
    },
    {
      user_id: userIds[11],
      incident_type: incidentTypes[0],
      severity_level: severities[3],
      description: 'Large wildfire spreading towards residential areas.',
      latitude: 16.0420,
      longitude: 120.3330,
      barangay: barangays[0],
      status: statuses[1],
    },
  ];
};

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('\n🔄 Clearing existing data (maintaining referential integrity)...');

    // Delete in reverse dependency order
    await client.query('DELETE FROM dispatcher_audit_logs');
    await client.query('DELETE FROM dispatcher_login_otp');
    await client.query('DELETE FROM token_blacklist');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM dispatches');
    await client.query('DELETE FROM blockchain_records');
    await client.query('DELETE FROM ai_classifications');
    await client.query('DELETE FROM incident_reports');
    await client.query('DELETE FROM responders');
    await client.query('DELETE FROM users');

    console.log('✅ Cleared old data\n');

    // Seed users
    console.log('👤 Seeding users with encryption...');
    const users = generateUsers();
    const userIds = [];

    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      
      // Encrypt sensitive fields: phone_number, email, first_name, last_name, address
      const encryptedData = encryptFields({
        phone_number: user.phone_number,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        address: user.address
      }, ['phone_number', 'email', 'first_name', 'last_name', 'address']);

      const result = await client.query(
        `INSERT INTO users (first_name, last_name, email, phone_number, password, role, phone_verified, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING user_id`,
        [encryptedData.first_name, encryptedData.last_name, encryptedData.email, 
         encryptedData.phone_number, hashedPassword, user.role, true, encryptedData.address]
      );
      userIds.push(result.rows[0].user_id);
    }
    console.log(`✅ Seeded ${users.length} users (1 admin, 2 dispatchers, ${users.length - 3} regular users)\n`);

    // Seed responders
    console.log('🚨 Seeding responders with encryption...');
    const responders = generateResponders();
    const responderIds = [];

    for (const responder of responders) {
      // Encrypt sensitive fields: name, contact_number
      const encryptedData = encryptFields({
        name: responder.name,
        contact_number: responder.contact_number
      }, ['name', 'contact_number']);

      const result = await client.query(
        `INSERT INTO responders (name, organization, contact_number, availability_status)
         VALUES ($1, $2, $3, $4)
         RETURNING responder_id`,
        [encryptedData.name, responder.organization, encryptedData.contact_number, responder.availability_status]
      );
      responderIds.push(result.rows[0].responder_id);
    }
    console.log(`✅ Seeded ${responders.length} responders\n`);

    // Seed incidents
    console.log('🚨 Seeding incident reports with encryption...');
    const incidents = generateIncidents(userIds);
    const incidentIds = [];

    for (const incident of incidents) {
      // Encrypt sensitive fields: latitude, longitude, description
      // Convert coordinates to strings for encryption
      const encryptedData = encryptFields({
        latitude: String(incident.latitude),
        longitude: String(incident.longitude),
        description: incident.description
      }, ['latitude', 'longitude', 'description']);

      const result = await client.query(
        `INSERT INTO incident_reports
         (user_id, incident_type, severity_level, description, latitude, longitude, barangay, status, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING report_id`,
        [incident.user_id, incident.incident_type, incident.severity_level, encryptedData.description,
         encryptedData.latitude, encryptedData.longitude, incident.barangay, incident.status, true]
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
    for (let i = 0; i < Math.min(3, userIds.length); i++) {
      await client.query(
        `INSERT INTO notifications (user_id, report_id, message, sent_via)
         VALUES ($1, $2, $3, $4)`,
        [userIds[6 + i], incidentIds[i], `Your incident report #${incidentIds[i]} has been processed.`, 'sms']
      );
    }
    console.log(`✅ Seeded sample notifications\n`);

    console.log('════════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!');
    console.log('════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   👤  Users: ${userIds.length} (1 admin, 2 dispatchers, ${userIds.length - 3} regular users)`);
    console.log(`   🚨 Responders: ${responderIds.length}`);
    console.log(`   📍 Incidents: ${incidentIds.length}`);
    console.log(`   📤 Dispatches: ${dispatchCount}`);
    console.log('\n🔐 All sensitive data encrypted with AES-256-GCM');
    console.log('   - User: phone_number, email, first_name, last_name, address');
    console.log('   - Responder: name, contact_number');
    console.log('   - Incident: latitude, longitude, description');
    console.log('\n🔑 Test Credentials (by role):');
    console.log('   Admin (password: admin123):');
    console.log('     - admin@rescuelink.test');
    console.log('   Dispatchers (password: dispatcher123):');
    console.log('     - dispatcher@rescuelink.test');
    console.log('     - dispatcher2@rescuelink.test');
    console.log('   Users (password: user123):');
    console.log('     - user@rescuelink.test, user1@rescuelink.test, user2@rescuelink.test, user3@rescuelink.test, user4@rescuelink.test');
    console.log('     - user5@rescuelink.test, user6@rescuelink.test, user7@rescuelink.test, user8@rescuelink.test, user9@rescuelink.test');
    console.log('     - user10@rescuelink.test, user11@rescuelink.test, user12@rescuelink.test, user13@rescuelink.test, user14@rescuelink.test\n');

  } catch (err) {
    console.error('❌ Database seeding failed!');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

seedDatabase();
