#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');
const { ROLES } = require('../src/config/roles');
const { encrypt } = require('../src/utils/encryption');
const fs = require('fs/promises');
const path = require('path');

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
  {
    code: 'pnp',
    name: 'Dagupan City Police Station',
    type: 'Police',
    color: 'blue',
    address: 'Dagupan City Police Station, A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.043037,
    longitude: 120.3323573,
    status: 'active',
  },
  {
    code: 'drrmo',
    name: 'Dagupan CDRRMC',
    type: 'Disaster',
    color: 'orange',
    address: 'City Engineers Office, A.B. Fernandez Ave, Dagupan City, Pangasinan',
    latitude: 16.043652,
    longitude: 120.333521,
    status: 'active',
  },
];

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg']);
const INCIDENT_SEED_COUNT = 72;

const DAGUPAN_LOCATION_FIXTURES = [
  { barangay: 'Poblacion Oeste', latitude: 16.043037, longitude: 120.3323573, label: 'Dagupan City Police Station' },
  { barangay: 'Poblacion Oeste', latitude: 16.043652, longitude: 120.333521, label: 'City Engineers Office (CDRRMC)' },
  { barangay: 'Poblacion Oeste', latitude: 16.043259, longitude: 120.333036, label: 'Dagupan Post Office' },
  { barangay: 'Pantal', latitude: 16.042901, longitude: 120.352587, label: 'Pantal Area' },
  { barangay: 'Tapuac', latitude: 16.051945, longitude: 120.347309, label: 'Tapuac Area' },
  { barangay: 'Lucao', latitude: 16.0561, longitude: 120.3519, label: 'Lucao District Center' },
  { barangay: 'Bonuan Boquig', latitude: 16.0781, longitude: 120.334, label: 'Bonuan Boquig Barangay Hall' },
  { barangay: 'Bonuan Gueset', latitude: 16.0736, longitude: 120.3332, label: 'Bonuan Gueset Barangay Hall' },
  { barangay: 'Bonuan Binloc', latitude: 16.0708, longitude: 120.338, label: 'Bonuan Binloc Barangay Hall' },
  { barangay: 'Bacayao Norte', latitude: 16.06322, longitude: 120.320998, label: 'Bacayao Norte Area' },
  { barangay: 'Bacayao Sur', latitude: 16.0581, longitude: 120.3248, label: 'Bacayao Sur Area' },
  { barangay: 'Lasip Chico', latitude: 16.0553, longitude: 120.3578, label: 'Lasip Chico District Center' },
  { barangay: 'Malued', latitude: 16.0569, longitude: 120.346, label: 'Malued District Center' },
  { barangay: 'Poblacion Norte', latitude: 16.0449, longitude: 120.333, label: 'Poblacion Norte Hall' },
  { barangay: 'Poblacion Sur', latitude: 16.0429, longitude: 120.3336, label: 'Poblacion Sur Hall' },
];

const INCIDENT_TEMPLATES = [
  { type: 'fire', severity: 'high', description: 'Residential fire with visible smoke and trapped occupants.' },
  { type: 'fire', severity: 'medium', description: 'Electrical fire reported in a commercial establishment.' },
  { type: 'fire', severity: 'low', description: 'Small outdoor fire near roadside vegetation.' },
  { type: 'medical', severity: 'high', description: 'Unconscious patient requiring urgent life support.' },
  { type: 'medical', severity: 'medium', description: 'Patient with breathing difficulty and chest discomfort.' },
  { type: 'medical', severity: 'low', description: 'Minor injury requiring transport and first aid.' },
  { type: 'police', severity: 'high', description: 'Armed disturbance reported with immediate threat to civilians.' },
  { type: 'police', severity: 'medium', description: 'Road altercation escalating and blocking traffic flow.' },
  { type: 'police', severity: 'low', description: 'Suspicious activity near a neighborhood entrance.' },
  { type: 'disaster', severity: 'high', description: 'Flooding reported with stranded residents and rising water.' },
  { type: 'disaster', severity: 'medium', description: 'Strong winds damaged structures and power lines.' },
  { type: 'disaster', severity: 'low', description: 'Localized water accumulation affecting side streets.' },
];

function shuffleList(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function walkAudioFiles(sourceDir) {
  const entries = [];
  async function walk(currentDir) {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) continue;
      entries.push({ sourcePath: absolutePath, originalName: entry.name, ext });
    }
  }
  await walk(sourceDir);
  return entries;
}

async function collectAudioFiles() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const aiTestDir = path.join(repoRoot, 'RescueLink AI', 'test');
  const backendUploadsDir = path.join(repoRoot, 'Backend', 'uploads', 'incidents');
  const entries = [];

  for (const sourceDir of [aiTestDir, backendUploadsDir]) {
    try {
      const files = await walkAudioFiles(sourceDir);
      entries.push(...files);
    } catch (_) {
      // ignore missing directories
    }
  }

  const unique = new Map();
  entries.forEach((entry) => unique.set(entry.sourcePath, entry));
  return shuffleList([...unique.values()]);
}

const TEAMS = [
  { department_code: 'pnp', team_name: 'Patrol Alpha', team_status: 'available', supported_incident_types: ['police'] },
  { department_code: 'pnp', team_name: 'Patrol Bravo', team_status: 'standby', supported_incident_types: ['police'] },
  { department_code: 'pnp', team_name: 'Traffic Unit', team_status: 'available', supported_incident_types: ['police'] },
  { department_code: 'drrmo', team_name: 'Rescue Alpha', team_status: 'available', supported_incident_types: ['disaster', 'medical'] },
  { department_code: 'drrmo', team_name: 'Medical Alpha', team_status: 'available', supported_incident_types: ['medical'] },
  { department_code: 'drrmo', team_name: 'Fire Support', team_status: 'standby', supported_incident_types: ['fire', 'disaster'] },
];

const USERS = [
  // System Admins (full system access)
  { first_name: 'Ariel', last_name: 'Admin', email: 'admin@rescuelink.test', phone_number: '639001000001', password: 'admin123', role: ROLES.ADMIN, address: 'Arellano St, Dagupan City', department_code: null },
  { first_name: 'Bianca', last_name: 'Admin', email: 'admin2@rescuelink.test', phone_number: '639001000002', password: 'admin123', role: ROLES.ADMIN, address: 'Perez Blvd, Dagupan City', department_code: null },
  // Department Admins (manage rosters, teams, and department resources)
  { first_name: 'Paolo', last_name: 'DeptAdmin', email: 'deptadmin_pnp@rescuelink.test', phone_number: '639001000010', password: 'deptadmin123', role: ROLES.DEPARTMENT_ADMIN, address: 'PNP Headquarters, Dagupan City', department_code: 'pnp' },
  { first_name: 'Rosa', last_name: 'DeptAdmin', email: 'deptadmin_drrmo@rescuelink.test', phone_number: '639001000011', password: 'deptadmin123', role: ROLES.DEPARTMENT_ADMIN, address: 'CDRRMO Office, Dagupan City', department_code: 'drrmo' },
  // Dispatchers (manage dispatches and handle incidents)
  { first_name: 'Alice', last_name: 'Dispatcher', email: 'dispatcher@rescuelink.test', phone_number: '639002000001', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Bonuan Boquig, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Bob', last_name: 'Dispatcher', email: 'dispatcher2@rescuelink.test', phone_number: '639002000002', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Pantal, Dagupan City', department_code: 'pnp' },
  { first_name: 'Carla', last_name: 'Dispatcher', email: 'dispatcher3@rescuelink.test', phone_number: '639002000003', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Lucao, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Daniel', last_name: 'Dispatcher', email: 'dispatcher4@rescuelink.test', phone_number: '639002000004', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Arellano St, Dagupan City', department_code: 'pnp' },
  // Department Heads (operational leadership: view and assign responders/teams)
  { first_name: 'Maria', last_name: 'DeptHead', email: 'depthead_pnp@rescuelink.test', phone_number: '639001000020', password: 'depthead123', role: ROLES.DEPARTMENT_HEAD, address: 'PNP Field Office, Dagupan City', department_code: 'pnp' },
  { first_name: 'Lucia', last_name: 'DeptHead', email: 'depthead_drrmo@rescuelink.test', phone_number: '639001000021', password: 'depthead123', role: ROLES.DEPARTMENT_HEAD, address: 'CDRRMO Operations, Dagupan City', department_code: 'drrmo' },
  // Supervisors (escalation management)
  { first_name: 'Evan', last_name: 'Supervisor', email: 'supervisor@rescuelink.test', phone_number: '639004000001', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Lasip Chico, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Fiona', last_name: 'Supervisor', email: 'supervisor2@rescuelink.test', phone_number: '639004000002', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Malued, Dagupan City', department_code: 'pnp' },
  // Mobile app reporters/users (incident reporting)
  { first_name: 'John', last_name: 'Cruz', email: 'user@rescuelink.test', phone_number: '639005000001', password: 'user123', role: ROLES.USER, address: 'Bonuan Binloc, Dagupan City', department_code: null },
  { first_name: 'Jane', last_name: 'Sarmiento', email: 'user2@rescuelink.test', phone_number: '639005000002', password: 'user123', role: ROLES.USER, address: 'Tapuac, Dagupan City', department_code: null },
  { first_name: 'Miguel', last_name: 'Domingo', email: 'user3@rescuelink.test', phone_number: '639005000003', password: 'user123', role: ROLES.USER, address: 'Mangin, Dagupan City', department_code: null },
  { first_name: 'Alyssa', last_name: 'Reyes', email: 'user4@rescuelink.test', phone_number: '639005000004', password: 'user123', role: ROLES.USER, address: 'Pantal, Dagupan City', department_code: null },
  { first_name: 'Ramon', last_name: 'Velasco', email: 'user5@rescuelink.test', phone_number: '639005000005', password: 'user123', role: ROLES.USER, address: 'Bonuan Boquig, Dagupan City', department_code: null },
  { first_name: 'Katrina', last_name: 'Perez', email: 'user6@rescuelink.test', phone_number: '639005000006', password: 'user123', role: ROLES.USER, address: 'Lucao, Dagupan City', department_code: null },
  // Responders (field personnel with accounts)
  { first_name: 'SPO2', last_name: 'Reyes', email: 'responder@rescuelink.test', phone_number: '639003000001', password: 'responder123', role: ROLES.RESPONDER, address: 'Pob. Oeste, Dagupan City', department_code: 'pnp' },
  { first_name: 'SPO1', last_name: 'Flores', email: 'responder2@rescuelink.test', phone_number: '639003000002', password: 'responder123', role: ROLES.RESPONDER, address: 'Pob. Oeste, Dagupan City', department_code: 'pnp' },
  { first_name: 'Rescuer', last_name: 'Ramos', email: 'responder3@rescuelink.test', phone_number: '639003000003', password: 'responder123', role: ROLES.RESPONDER, address: 'Bonuan Gueset, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Medic', last_name: 'Santos', email: 'responder4@rescuelink.test', phone_number: '639003000004', password: 'responder123', role: ROLES.RESPONDER, address: 'Bonuan Gueset, Dagupan City', department_code: 'drrmo' },
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
        `INSERT INTO departments(code, name, type, color, address, latitude, longitude, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING department_id, code`,
        [dept.code, dept.name, dept.type, dept.color, dept.address || null, dept.latitude || null, dept.longitude || null, dept.status]
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

    // Seed incidents (audio-backed, no AI/STT processing)
    console.log('🆘 Seeding incident reports (Dagupan-only, broad status/type/severity mix)...');
    const audioFiles = await collectAudioFiles();
    const reporterIds = userIdsByRole[ROLES.USER] || [];
    if (reporterIds.length === 0) {
      throw new Error('No reporter users available for incident seeding.');
    }
    if (audioFiles.length === 0) {
      throw new Error('No audio files found for incident seeding.');
    }

    const incidentColumnMeta = {
      description: await getColumnMeta(client, 'incident_reports', 'description'),
      latitude: await getColumnMeta(client, 'incident_reports', 'latitude'),
      longitude: await getColumnMeta(client, 'incident_reports', 'longitude'),
      barangay: await getColumnMeta(client, 'incident_reports', 'barangay'),
      transcription: await getColumnMeta(client, 'incident_reports', 'transcription'),
    };

    const seedUploadsDir = path.join(process.cwd(), 'uploads', 'incidents');
    await fs.mkdir(seedUploadsDir, { recursive: true });

    const statuses = ['pending', 'verified', 'in_progress', 'resolved', 'closed'];
    let incidentsSeeded = 0;

    for (let i = 0; i < INCIDENT_SEED_COUNT; i += 1) {
      const reporterId = reporterIds[i % reporterIds.length];
      const locationFixture = DAGUPAN_LOCATION_FIXTURES[i % DAGUPAN_LOCATION_FIXTURES.length];
      const template = INCIDENT_TEMPLATES[i % INCIDENT_TEMPLATES.length];
      const status = statuses[i % statuses.length];
      const sourceAudio = audioFiles[i % audioFiles.length];

      const baseDescription = `${template.description} Location reference: ${locationFixture.label}, ${locationFixture.barangay}, Dagupan City.`;
      const createdAt = new Date(Date.now() - (i * 45 * 60 * 1000));
      const verified = status !== 'pending';

      const inserted = await client.query(
        `INSERT INTO incident_reports(
          user_id,
          incident_type,
          severity_level,
          description,
          latitude,
          longitude,
          barangay,
          status,
          transcription,
          verified,
          ai_pending,
          ai_attempted,
          scan_status,
          quarantined,
          created_at
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,FALSE,'clean',FALSE,$11)
        RETURNING report_id`,
        [
          reporterId,
          template.type,
          template.severity,
          maybeEncrypt(baseDescription, incidentColumnMeta.description),
          maybeEncrypt(locationFixture.latitude, incidentColumnMeta.latitude),
          maybeEncrypt(locationFixture.longitude, incidentColumnMeta.longitude),
          maybeEncrypt(locationFixture.barangay, incidentColumnMeta.barangay),
          status,
          maybeEncrypt(null, incidentColumnMeta.transcription),
          verified,
          createdAt.toISOString(),
        ]
      );

      const reportId = inserted.rows[0].report_id;
      const copiedAudioName = `incident_${reportId}_audio${sourceAudio.ext}`;
      const copiedAudioAbsolute = path.join(seedUploadsDir, copiedAudioName);
      await fs.copyFile(sourceAudio.sourcePath, copiedAudioAbsolute);
      const audioDbPath = path.join('uploads', 'incidents', copiedAudioName).replace(/\\/g, '/');

      await client.query(
        `UPDATE incident_reports SET audio_path = $1 WHERE report_id = $2`,
        [audioDbPath, reportId]
      );

      incidentsSeeded += 1;
    }
    console.log(`✅ Seeded ${incidentsSeeded} incident reports\n`);

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
    console.log(`   👤  Users: ${userIds.length} (2 Admins, 2 Dept Admins, 4 Dispatchers, 2 Dept Heads, 2 Supervisors, 4 Responders, 6 Reporters)`);
    console.log(`   🏢 Departments: ${DEPARTMENTS.length}`);
    console.log(`   👥 Teams: ${TEAMS.length}`);
    console.log(`   🚨 Responders: ${responderIds.length}`);
    console.log(`   🔗 Team memberships: ${membershipCount}`);
    console.log(`   🆘 Incident reports: ${INCIDENT_SEED_COUNT}`);
    console.log('\n🔑 Test Account Credentials:');
    console.log('\n   System Admins (full access):');
    console.log('   - admin@rescuelink.test / admin123');
    console.log('   - admin2@rescuelink.test / admin123');
    console.log('\n   Department Admins (manage rosters & teams):');
    console.log('   - deptadmin_pnp@rescuelink.test / deptadmin123');
    console.log('   - deptadmin_drrmo@rescuelink.test / deptadmin123');
    console.log('\n   Dispatchers (manage incidents & dispatches):');
    console.log('   - dispatcher@rescuelink.test / dispatcher123');
    console.log('   - dispatcher2@rescuelink.test / dispatcher123');
    console.log('   - dispatcher3@rescuelink.test / dispatcher123');
    console.log('   - dispatcher4@rescuelink.test / dispatcher123');
    console.log('\n   Department Heads (operational leadership: view responders/teams):');
    console.log('   - depthead_pnp@rescuelink.test / depthead123');
    console.log('   - depthead_drrmo@rescuelink.test / depthead123');
    console.log('\n   Responders (field personnel):');
    console.log('   - responder@rescuelink.test / responder123');
    console.log('   - responder2@rescuelink.test / responder123');
    console.log('   - responder3@rescuelink.test / responder123');
    console.log('   - responder4@rescuelink.test / responder123');
    console.log('\n   Reporters (mobile app users):');
    console.log('   - user@rescuelink.test / user123');
    console.log('   - user2@rescuelink.test / user123');
    console.log('   - user3@rescuelink.test / user123');
    console.log('   - user4@rescuelink.test / user123');
    console.log('   - user5@rescuelink.test / user123');
    console.log('   - user6@rescuelink.test / user123');
    console.log('\nℹ️ Incident reports are seeded in this script using audio files without AI/STT for broad test coverage.');
    console.log('   Optional additional seeding: npm run seed-incidents');
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
