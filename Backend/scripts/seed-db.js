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

const DEPARTMENTS = [
  { code: 'pnp', name: 'Dagupan City Police Office', type: 'Police', color: 'blue', status: 'active' },
  { code: 'drrmo', name: 'Dagupan CDRRMO', type: 'Disaster', color: 'orange', status: 'active' },
];

const TEAMS = [
  { department_code: 'pnp', team_name: 'Patrol Alpha', team_status: 'available', supported_incident_types: ['police'] },
  { department_code: 'pnp', team_name: 'Patrol Bravo', team_status: 'standby', supported_incident_types: ['police'] },
  { department_code: 'pnp', team_name: 'Traffic Unit', team_status: 'available', supported_incident_types: ['police'] },
  { department_code: 'drrmo', team_name: 'Rescue Alpha', team_status: 'available', supported_incident_types: ['disaster', 'medical'] },
  { department_code: 'drrmo', team_name: 'Medical Alpha', team_status: 'available', supported_incident_types: ['medical'] },
  { department_code: 'drrmo', team_name: 'Fire Support', team_status: 'standby', supported_incident_types: ['fire', 'disaster'] },
];

const USERS = [
  { first_name: 'Ariel', last_name: 'Admin', email: 'admin@rescuelink.test', phone_number: '639001000001', password: 'admin123', role: ROLES.ADMIN, address: 'Arellano St, Dagupan City', department_code: null },
  { first_name: 'Bianca', last_name: 'Admin', email: 'admin2@rescuelink.test', phone_number: '639001000002', password: 'admin123', role: ROLES.ADMIN, address: 'Perez Blvd, Dagupan City', department_code: null },
  { first_name: 'Alice', last_name: 'Dispatcher', email: 'dispatcher@rescuelink.test', phone_number: '639002000001', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Bonuan Boquig, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Bob', last_name: 'Dispatcher', email: 'dispatcher2@rescuelink.test', phone_number: '639002000002', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Pantal, Dagupan City', department_code: 'pnp' },
  { first_name: 'Carla', last_name: 'Dispatcher', email: 'dispatcher3@rescuelink.test', phone_number: '639002000003', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Lucao, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Evan', last_name: 'Supervisor', email: 'supervisor@rescuelink.test', phone_number: '639004000001', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Lasip Chico, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Fiona', last_name: 'Supervisor', email: 'supervisor2@rescuelink.test', phone_number: '639004000002', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Malued, Dagupan City', department_code: 'pnp' },
  { first_name: 'John', last_name: 'Reporter', email: 'user@rescuelink.test', phone_number: '639005000001', password: 'user123', role: ROLES.USER, address: 'Bonuan Binloc, Dagupan City', department_code: null },
  { first_name: 'Jane', last_name: 'Reporter', email: 'user2@rescuelink.test', phone_number: '639005000002', password: 'user123', role: ROLES.USER, address: 'Tapuac, Dagupan City', department_code: null },
  { first_name: 'Miguel', last_name: 'Reporter', email: 'user3@rescuelink.test', phone_number: '639005000003', password: 'user123', role: ROLES.USER, address: 'Mangin, Dagupan City', department_code: null },
  { first_name: 'Paolo', last_name: 'Responder', email: 'responder@rescuelink.test', phone_number: '639003000001', password: 'responder123', role: ROLES.RESPONDER, address: 'Pob. Oeste, Dagupan City', department_code: 'pnp' },
  { first_name: 'Diana', last_name: 'Responder', email: 'responder2@rescuelink.test', phone_number: '639003000002', password: 'responder123', role: ROLES.RESPONDER, address: 'Pob. Oeste, Dagupan City', department_code: 'pnp' },
  { first_name: 'Noel', last_name: 'Responder', email: 'responder3@rescuelink.test', phone_number: '639003000003', password: 'responder123', role: ROLES.RESPONDER, address: 'Bonuan Gueset, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Trina', last_name: 'Responder', email: 'responder4@rescuelink.test', phone_number: '639003000004', password: 'responder123', role: ROLES.RESPONDER, address: 'Bonuan Gueset, Dagupan City', department_code: 'drrmo' },
];

const RESPONDERS = [
  { name: 'SPO2 Paolo Reyes', organization: 'Dagupan City Police Office', contact_number: '09171230001', availability_status: 'available', source_type: 'account', team_name: 'Patrol Alpha', supported_incident_types: ['police'] },
  { name: 'SPO1 Diana Flores', organization: 'Dagupan City Police Office', contact_number: '09171230002', availability_status: 'standby', source_type: 'account', team_name: 'Patrol Bravo', supported_incident_types: ['police'] },
  { name: 'Traffic Officer Miguel Cruz', organization: 'Dagupan City Police Office', contact_number: '09171230003', availability_status: 'available', source_type: 'directory', team_name: 'Traffic Unit', supported_incident_types: ['police'] },
  { name: 'Rescuer Noel Ramos', organization: 'Dagupan CDRRMO', contact_number: '09181230001', availability_status: 'available', source_type: 'account', team_name: 'Rescue Alpha', supported_incident_types: ['disaster', 'medical'] },
  { name: 'Medic Trina Santos', organization: 'Dagupan CDRRMO', contact_number: '09181230002', availability_status: 'available', source_type: 'account', team_name: 'Medical Alpha', supported_incident_types: ['medical'] },
  { name: 'Fire Volunteer Leo Dela Cruz', organization: 'Dagupan CDRRMO', contact_number: '09181230003', availability_status: 'standby', source_type: 'directory', team_name: 'Fire Support', supported_incident_types: ['fire', 'disaster'] },
  { name: 'BLS Medic Karen Villanueva', organization: 'Dagupan CDRRMO', contact_number: '09181230004', availability_status: 'busy', source_type: 'directory', team_name: 'Medical Alpha', supported_incident_types: ['medical'] },
  { name: 'Rescue Driver Omar Garcia', organization: 'Dagupan CDRRMO', contact_number: '09181230005', availability_status: 'off-duty', source_type: 'directory', team_name: 'Rescue Alpha', supported_incident_types: ['disaster'] },
];

function toRoleLabel(role) {
  if (role === ROLES.ADMIN) return 'admin';
  if (role === ROLES.DISPATCHER) return 'dispatcher';
  if (role === ROLES.RESPONDER) return 'responder';
  if (role === ROLES.SUPERVISOR) return 'supervisor';
  return 'user';
}

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
    await client.query('DELETE FROM responder_team_members');
    await client.query('DELETE FROM responder_teams');
    await client.query('DELETE FROM incident_reports');
    await client.query('DELETE FROM responders');
    await client.query('DELETE FROM department_personnel');
    await client.query('DELETE FROM department_units');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM departments');

    console.log('✅ Cleared old data\n');

    const userColumnMeta = {
      first_name: await getColumnMeta(client, 'users', 'first_name'),
      last_name: await getColumnMeta(client, 'users', 'last_name'),
      email: await getColumnMeta(client, 'users', 'email'),
      phone_number: await getColumnMeta(client, 'users', 'phone_number'),
      address: await getColumnMeta(client, 'users', 'address'),
      department_id: await getColumnMeta(client, 'users', 'department_id'),
    };

    // Seed departments
    console.log('🏢 Seeding departments...');
    const departmentIdByCode = {};
    for (const dept of DEPARTMENTS) {
      const result = await client.query(
        `INSERT INTO departments(code, name, type, color, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING department_id, code`,
        [dept.code, dept.name, dept.type, dept.color, dept.status]
      );
      departmentIdByCode[result.rows[0].code] = result.rows[0].department_id;
    }
    console.log(`✅ Seeded ${DEPARTMENTS.length} departments\n`);

    // Seed teams
    console.log('👥 Seeding responder teams...');
    const teamIdByKey = {};
    for (const team of TEAMS) {
      const result = await client.query(
        `INSERT INTO responder_teams(department_code, team_name, team_status, supported_incident_types, is_active)
         VALUES($1, $2, $3, $4, TRUE)
         RETURNING team_id, department_code, team_name`,
        [team.department_code, team.team_name, team.team_status, team.supported_incident_types]
      );
      const key = `${result.rows[0].department_code}::${result.rows[0].team_name}`;
      teamIdByKey[key] = result.rows[0].team_id;
    }
    console.log(`✅ Seeded ${TEAMS.length} teams\n`);

    // Seed users
    console.log('👤 Seeding users...');
    const users = USERS;
    const userIds = [];
    const userIdsByRole = {};
    Object.values(ROLES).forEach((role) => { userIdsByRole[role] = []; });

    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      const encryptedFirstName = maybeEncrypt(user.first_name, userColumnMeta.first_name);
      const encryptedLastName = maybeEncrypt(user.last_name, userColumnMeta.last_name);
      const encryptedEmail = maybeEncrypt(user.email, userColumnMeta.email);
      const encryptedPhone = maybeEncrypt(user.phone_number, userColumnMeta.phone_number);
      const encryptedAddress = maybeEncrypt(user.address, userColumnMeta.address);
      const userDepartmentId = user.department_code ? (departmentIdByCode[user.department_code] || null) : null;
      const result = userColumnMeta.department_id
        ? await client.query(
          `INSERT INTO users (first_name, last_name, email, phone_number, password, role, phone_verified, address, department_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING user_id`,
          [encryptedFirstName, encryptedLastName, encryptedEmail, encryptedPhone, hashedPassword, user.role, true, encryptedAddress, userDepartmentId]
        )
        : await client.query(
          `INSERT INTO users (first_name, last_name, email, phone_number, password, role, phone_verified, address)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING user_id`,
          [encryptedFirstName, encryptedLastName, encryptedEmail, encryptedPhone, hashedPassword, user.role, true, encryptedAddress]
        );
      const newUserId = result.rows[0].user_id;
      userIds.push(newUserId);
      userIdsByRole[user.role].push(newUserId);
    }
    console.log(`✅ Seeded ${users.length} users\n`);

    // Seed responders
    console.log('🚨 Seeding responders...');
    const responders = RESPONDERS;
    const responderIds = [];
    const responderIdByTeam = {};

    for (const responder of responders) {
      const result = await client.query(
        `INSERT INTO responders (name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING responder_id`,
        [
          responder.name,
          responder.organization,
          responder.contact_number,
          responder.availability_status,
          responder.source_type,
          responder.team_name,
          responder.supported_incident_types,
        ]
      );
      const id = result.rows[0].responder_id;
      responderIds.push(id);
      if (!responderIdByTeam[responder.team_name]) {
        responderIdByTeam[responder.team_name] = [];
      }
      responderIdByTeam[responder.team_name].push(id);
    }
    console.log(`✅ Seeded ${responders.length} responders\n`);

    // Map responder memberships
    console.log('🔗 Seeding responder team memberships...');
    let membershipCount = 0;
    for (const team of TEAMS) {
      const teamKey = `${team.department_code}::${team.team_name}`;
      const teamId = teamIdByKey[teamKey];
      if (!teamId) continue;
      for (const responderId of responderIdByTeam[team.team_name] || []) {
        await client.query(
          `INSERT INTO responder_team_members(team_id, responder_id, is_active)
           VALUES($1, $2, TRUE)`,
          [teamId, responderId]
        );
        membershipCount++;
      }
    }
    console.log(`✅ Seeded ${membershipCount} team memberships\n`);

    console.log('════════════════════════════════════════════════');
    console.log('🎉 Core data seeding completed successfully!');
    console.log('════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   👤  Users: ${userIds.length}`);
    console.log(`   🏢 Departments: ${DEPARTMENTS.length}`);
    console.log(`   👥 Teams: ${TEAMS.length}`);
    console.log(`   🚨 Responders: ${responderIds.length}`);
    console.log(`   🔗 Team memberships: ${membershipCount}`);
    console.log('\nℹ️ Incident seeding moved to dedicated script for realistic audio-based samples.');
    console.log('   Run: npm run seed-incidents');
    console.log('\n🔑 Test Credentials (by role):');
    const seen = new Set();
    for (const user of USERS) {
      const key = `${user.role}:${user.password}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(`   ${toRoleLabel(user.role)} password: ${user.password}`);
      }
      console.log(`     - ${user.email}`);
    }
    console.log('');

  } catch (err) {
    console.error('❌ Core data seeding failed!');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();
