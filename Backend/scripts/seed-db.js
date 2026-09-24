#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const { getPgPoolConfig, formatDatabaseTarget } = require('../src/config/pgPool');
const bcryptjs = require('bcryptjs');
const { ROLES } = require('../src/config/roles');
const { encrypt } = require('../src/utils/encryption');
const { validatePhone } = require('../src/utils/validation');
const fs = require('fs/promises');
const path = require('path');
const {
  parseSeedCli,
  departmentCodeForType,
  teamNameForDepartmentAndType,
  channelKindForIndex,
  statusProfileForIndex,
  incidentScenarioForIndex,
  seedCreatedAt,
  buildDispatchTimeline,
} = require('./lib/seedAnalyticsFixtures');

const DATABASE_URL = process.env.DATABASE_URL;
const { incidentCount: INCIDENT_SEED_COUNT, spanDays: SEED_SPAN_DAYS } = parseSeedCli();
const RESPONDER_PASSWORD = 'responder123';

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

console.log('🌱 Seeding database...');
console.log(`📍 Database: ${formatDatabaseTarget(DATABASE_URL)}`);

const pool = new Pool(getPgPoolConfig());

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
  if (columnMeta.data_type === 'text') return true;
  const maxLen = columnMeta.character_maximum_length;
  if (!maxLen) return false;
  return estimateEncryptedHexLength(value) <= maxLen;
}

function maybeEncrypt(value, columnMeta) {
  if (value === null || value === undefined) return null;
  if (shouldEncryptForColumn(columnMeta, value)) {
    return encryptNullable(value);
  }
  return value;
}

async function deleteOptional(client, tableName) {
  try {
    await client.query(`DELETE FROM ${tableName}`);
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
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
    supported_incident_types: ['police'],
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
    supported_incident_types: ['fire', 'medical', 'disaster', 'accident'],
  },
];

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg']);

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

const DEPARTMENT_NAME_BY_CODE = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d.name]));
const DUPLICATE_CLUSTER_BASE = DAGUPAN_LOCATION_FIXTURES[0];

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
  { type: 'accident', severity: 'high', description: 'Multi-vehicle collision with injuries reported on main road.' },
  { type: 'accident', severity: 'medium', description: 'Motorcycle accident with rider down, traffic backing up.' },
  { type: 'accident', severity: 'low', description: 'Minor fender-bender; no injuries, lane partially blocked.' },
];

/** 12 teams × 2 account-backed members each (24 mobile-testable responder logins). */
const TEAM_ROSTER = [
  {
    department_code: 'pnp',
    team_name: 'Patrol Alpha',
    team_status: 'available',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder@rescuelink.test', first_name: 'SPO2', last_name: 'Reyes', phone_number: '639003000001', contact_number: '09171230001', availability_status: 'available', supported_incident_types: ['police'] },
      { email: 'responder5@rescuelink.test', first_name: 'Patrol', last_name: 'Officer', phone_number: '639003000005', contact_number: '09171230007', availability_status: 'standby', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'pnp',
    team_name: 'Patrol Bravo',
    team_status: 'standby',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder2@rescuelink.test', first_name: 'SPO1', last_name: 'Flores', phone_number: '639003000002', contact_number: '09171230002', availability_status: 'standby', supported_incident_types: ['police'] },
      { email: 'responder6@rescuelink.test', first_name: 'Desk', last_name: 'Officer', phone_number: '639003000006', contact_number: '09171230008', availability_status: 'available', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'pnp',
    team_name: 'Traffic Unit',
    team_status: 'available',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder7@rescuelink.test', first_name: 'Miguel', last_name: 'Cruz', phone_number: '639003000007', contact_number: '09171230003', availability_status: 'available', supported_incident_types: ['police'] },
      { email: 'responder8@rescuelink.test', first_name: 'Traffic', last_name: 'Auxiliary', phone_number: '639003000008', contact_number: '09171230013', availability_status: 'standby', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'pnp',
    team_name: 'K9 Unit',
    team_status: 'available',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder9@rescuelink.test', first_name: 'K9', last_name: 'Handler', phone_number: '639003000009', contact_number: '09171230004', availability_status: 'available', supported_incident_types: ['police'] },
      { email: 'responder10@rescuelink.test', first_name: 'K9', last_name: 'Partner', phone_number: '639003000010', contact_number: '09171230014', availability_status: 'standby', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'pnp',
    team_name: 'Investigation Unit',
    team_status: 'available',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder11@rescuelink.test', first_name: 'Lead', last_name: 'Investigator', phone_number: '639003000011', contact_number: '09171230005', availability_status: 'available', supported_incident_types: ['police'] },
      { email: 'responder12@rescuelink.test', first_name: 'Scene', last_name: 'Investigator', phone_number: '639003000012', contact_number: '09171230015', availability_status: 'standby', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'pnp',
    team_name: 'Quick Response Team',
    team_status: 'available',
    supported_incident_types: ['police'],
    members: [
      { email: 'responder13@rescuelink.test', first_name: 'QRT', last_name: 'Alpha', phone_number: '639003000013', contact_number: '09171230006', availability_status: 'available', supported_incident_types: ['police'] },
      { email: 'responder14@rescuelink.test', first_name: 'QRT', last_name: 'Bravo', phone_number: '639003000014', contact_number: '09171230016', availability_status: 'standby', supported_incident_types: ['police'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Rescue Alpha',
    team_status: 'available',
    supported_incident_types: ['disaster', 'medical'],
    members: [
      { email: 'responder3@rescuelink.test', first_name: 'Rescuer', last_name: 'Ramos', phone_number: '639003000003', contact_number: '09181230001', availability_status: 'available', supported_incident_types: ['disaster', 'medical'] },
      { email: 'responder15@rescuelink.test', first_name: 'Rescue', last_name: 'Driver', phone_number: '639003000015', contact_number: '09181230005', availability_status: 'standby', supported_incident_types: ['disaster'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Medical Alpha',
    team_status: 'available',
    supported_incident_types: ['medical'],
    members: [
      { email: 'responder4@rescuelink.test', first_name: 'Medic', last_name: 'Santos', phone_number: '639003000004', contact_number: '09181230002', availability_status: 'available', supported_incident_types: ['medical'] },
      { email: 'responder16@rescuelink.test', first_name: 'Ambulance', last_name: 'Driver', phone_number: '639003000016', contact_number: '09181230010', availability_status: 'standby', supported_incident_types: ['medical'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Fire Support',
    team_status: 'standby',
    supported_incident_types: ['fire', 'disaster'],
    members: [
      { email: 'responder17@rescuelink.test', first_name: 'Leo', last_name: 'Dela Cruz', phone_number: '639003000017', contact_number: '09181230003', availability_status: 'standby', supported_incident_types: ['fire', 'disaster'] },
      { email: 'responder18@rescuelink.test', first_name: 'Fire', last_name: 'Support', phone_number: '639003000018', contact_number: '09181230011', availability_status: 'available', supported_incident_types: ['fire', 'disaster'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Emergency Response Alpha',
    team_status: 'available',
    supported_incident_types: ['disaster', 'medical'],
    members: [
      { email: 'responder19@rescuelink.test', first_name: 'Emergency', last_name: 'Medic', phone_number: '639003000019', contact_number: '09181230006', availability_status: 'available', supported_incident_types: ['disaster', 'medical'] },
      { email: 'responder20@rescuelink.test', first_name: 'Field', last_name: 'Paramedic', phone_number: '639003000020', contact_number: '09181230009', availability_status: 'standby', supported_incident_types: ['medical'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Logistics Support',
    team_status: 'available',
    supported_incident_types: ['disaster'],
    members: [
      { email: 'responder21@rescuelink.test', first_name: 'Logistics', last_name: 'Lead', phone_number: '639003000021', contact_number: '09181230007', availability_status: 'available', supported_incident_types: ['disaster'] },
      { email: 'responder22@rescuelink.test', first_name: 'Supply', last_name: 'Coordinator', phone_number: '639003000022', contact_number: '09181230012', availability_status: 'standby', supported_incident_types: ['disaster'] },
    ],
  },
  {
    department_code: 'drrmo',
    team_name: 'Search and Rescue',
    team_status: 'standby',
    supported_incident_types: ['disaster'],
    members: [
      { email: 'responder23@rescuelink.test', first_name: 'SAR', last_name: 'Lead', phone_number: '639003000023', contact_number: '09181230008', availability_status: 'standby', supported_incident_types: ['disaster'] },
      { email: 'responder24@rescuelink.test', first_name: 'SAR', last_name: 'Member', phone_number: '639003000024', contact_number: '09181230013', availability_status: 'available', supported_incident_types: ['disaster'] },
    ],
  },
];

const STAFF_USERS = [
  { first_name: 'Ariel', last_name: 'Admin', email: 'admin@rescuelink.test', phone_number: '639001000001', password: 'admin123', role: ROLES.ADMIN, address: 'Arellano St, Dagupan City', department_code: null },
  { first_name: 'Bianca', last_name: 'Admin', email: 'admin2@rescuelink.test', phone_number: '639001000002', password: 'admin123', role: ROLES.ADMIN, address: 'Perez Blvd, Dagupan City', department_code: null },
  { first_name: 'Paolo', last_name: 'DeptAdmin', email: 'deptadmin_pnp@rescuelink.test', phone_number: '639001000010', password: 'deptadmin123', role: ROLES.DEPARTMENT_ADMIN, address: 'PNP Headquarters, Dagupan City', department_code: 'pnp' },
  { first_name: 'Rosa', last_name: 'DeptAdmin', email: 'deptadmin_drrmo@rescuelink.test', phone_number: '639001000011', password: 'deptadmin123', role: ROLES.DEPARTMENT_ADMIN, address: 'CDRRMO Office, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Alice', last_name: 'Dispatcher', email: 'dispatcher@rescuelink.test', phone_number: '639002000001', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Bonuan Boquig, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Bob', last_name: 'Dispatcher', email: 'dispatcher2@rescuelink.test', phone_number: '639002000002', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Pantal, Dagupan City', department_code: 'pnp' },
  { first_name: 'Carla', last_name: 'Dispatcher', email: 'dispatcher3@rescuelink.test', phone_number: '639002000003', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Lucao, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Daniel', last_name: 'Dispatcher', email: 'dispatcher4@rescuelink.test', phone_number: '639002000004', password: 'dispatcher123', role: ROLES.DISPATCHER, address: 'Arellano St, Dagupan City', department_code: 'pnp' },
  { first_name: 'Maria', last_name: 'DeptHead', email: 'depthead_pnp@rescuelink.test', phone_number: '639001000020', password: 'depthead123', role: ROLES.DEPARTMENT_HEAD, address: 'PNP Field Office, Dagupan City', department_code: 'pnp' },
  { first_name: 'Lucia', last_name: 'DeptHead', email: 'depthead_drrmo@rescuelink.test', phone_number: '639001000021', password: 'depthead123', role: ROLES.DEPARTMENT_HEAD, address: 'CDRRMO Operations, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Evan', last_name: 'Supervisor', email: 'supervisor@rescuelink.test', phone_number: '639004000001', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Lasip Chico, Dagupan City', department_code: 'drrmo' },
  { first_name: 'Fiona', last_name: 'Supervisor', email: 'supervisor2@rescuelink.test', phone_number: '639004000002', password: 'supervisor123', role: ROLES.SUPERVISOR, address: 'Malued, Dagupan City', department_code: 'pnp' },
  { first_name: 'John', last_name: 'Cruz', email: 'user@rescuelink.test', phone_number: '639005000001', password: 'user123', role: ROLES.USER, address: 'Bonuan Binloc, Dagupan City', department_code: null },
  { first_name: 'Jane', last_name: 'Sarmiento', email: 'user2@rescuelink.test', phone_number: '639005000002', password: 'user123', role: ROLES.USER, address: 'Tapuac, Dagupan City', department_code: null },
  { first_name: 'Miguel', last_name: 'Domingo', email: 'user3@rescuelink.test', phone_number: '639005000003', password: 'user123', role: ROLES.USER, address: 'Mangin, Dagupan City', department_code: null },
  { first_name: 'Alyssa', last_name: 'Reyes', email: 'user4@rescuelink.test', phone_number: '639005000004', password: 'user123', role: ROLES.USER, address: 'Pantal, Dagupan City', department_code: null },
  { first_name: 'Ramon', last_name: 'Velasco', email: 'user5@rescuelink.test', phone_number: '639005000005', password: 'user123', role: ROLES.USER, address: 'Bonuan Boquig, Dagupan City', department_code: null },
  { first_name: 'Katrina', last_name: 'Perez', email: 'user6@rescuelink.test', phone_number: '639005000006', password: 'user123', role: ROLES.USER, address: 'Lucao, Dagupan City', department_code: null },
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

function organizationForDepartment(departmentCode) {
  return departmentCode === 'pnp' ? 'Dagupan City Police Office' : 'Dagupan CDRRMO';
}

async function insertUser(client, user, departmentIdByCode, userColumnMeta) {
  const hashedPassword = await hashPassword(user.password);
  const normalizedPhone = validatePhone(user.phone_number);
  const encryptedFirstName = maybeEncrypt(user.first_name, userColumnMeta.first_name);
  const encryptedLastName = maybeEncrypt(user.last_name, userColumnMeta.last_name);
  const encryptedEmail = maybeEncrypt(user.email, userColumnMeta.email);
  const encryptedPhone = maybeEncrypt(normalizedPhone, userColumnMeta.phone_number);
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
  return result.rows[0].user_id;
}

async function markResponderOnline(client, userId, role) {
  if (role !== ROLES.RESPONDER) return;
  try {
    await client.query('UPDATE users SET responder_online = TRUE WHERE user_id = $1', [userId]);
  } catch (_) {}
}

async function insertResponder(client, { userId, name, organization, contactNumber, availabilityStatus, teamName, supportedIncidentTypes }) {
  try {
    const result = await client.query(
      `INSERT INTO responders (name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types, user_id)
       VALUES ($1, $2, $3, $4, 'account', $5, $6, $7)
       RETURNING responder_id`,
      [name, organization, contactNumber, availabilityStatus, teamName, supportedIncidentTypes, userId]
    );
    return result.rows[0].responder_id;
  } catch (error) {
    if (error.code === '42703' && /user_id/i.test(error.message)) {
      const fallback = await client.query(
        `INSERT INTO responders (name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types)
         VALUES ($1, $2, $3, $4, 'account', $5, $6)
         RETURNING responder_id`,
        [name, organization, contactNumber, availabilityStatus, teamName, supportedIncidentTypes]
      );
      return fallback.rows[0].responder_id;
    }
    throw error;
  }
}

function pickDispatcherId(userIdsByRole, departmentCode) {
  const dispatchers = userIdsByRole[ROLES.DISPATCHER] || [];
  if (dispatchers.length === 0) return null;
  return departmentCode === 'pnp' ? dispatchers[1] || dispatchers[0] : dispatchers[0];
}

function iso(ms) {
  return new Date(ms).toISOString();
}

async function insertDispatchRow(client, row) {
  await client.query(
    `INSERT INTO dispatches(
       report_id, responder_id, response_status, department_code, department_name,
       team_name, dispatched_at, actual_arrival_at, assigned_by_user_id, responder_source
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'account')`,
    [
      row.reportId,
      row.responderId,
      row.responseStatus || 'On Scene',
      row.departmentCode,
      row.departmentName,
      row.teamName,
      iso(row.dispatchedMs),
      row.arrivalMs ? iso(row.arrivalMs) : null,
      row.assignedByUserId,
    ]
  );
}

async function insertOnSceneHistory(client, { reportId, userId, arrivalMs }) {
  await client.query(
    `INSERT INTO responder_status_history(report_id, updated_by_user_id, old_status, new_status, updated_at)
     VALUES($1,$2,'En Route','On Scene',$3)`,
    [reportId, userId, iso(arrivalMs)]
  );
}

async function seedDepartmentUnitsAndPersonnel(client, departmentIdByCode) {
  const unitFixtures = {
    pnp: [
      { name: 'Patrol Car Alpha', type: 'vehicle', status: 'Available' },
      { name: 'Patrol Car Bravo', type: 'vehicle', status: 'Available' },
      { name: 'Traffic Motorcycle 1', type: 'motorcycle', status: 'Available' },
      { name: 'QRT Van', type: 'vehicle', status: 'Operational' },
    ],
    drrmo: [
      { name: 'Ambulance 1', type: 'ambulance', status: 'Available' },
      { name: 'Ambulance 2', type: 'ambulance', status: 'Available' },
      { name: 'Fire Engine 1', type: 'fire_truck', status: 'Available' },
      { name: 'Rescue Boat', type: 'boat', status: 'Operational' },
      { name: 'SAR Truck', type: 'vehicle', status: 'Available' },
    ],
  };
  const unitIdByDept = { pnp: [], drrmo: [] };
  for (const [code, units] of Object.entries(unitFixtures)) {
    const deptId = departmentIdByCode[code];
    if (!deptId) continue;
    for (const unit of units) {
      const res = await client.query(
        `INSERT INTO department_units(department_id, name, type, status, maintenance_status, active_task_count)
         VALUES($1,$2,$3,$4,'Operational',0)
         RETURNING unit_id`,
        [deptId, unit.name, unit.type, unit.status]
      );
      unitIdByDept[code].push(res.rows[0].unit_id);
      await client.query(
        `INSERT INTO department_personnel(department_id, unit_id, name, role, status)
         VALUES($1,$2,$3,$4,'Available')`,
        [deptId, res.rows[0].unit_id, `${unit.name} Crew`, 'Field']
      );
    }
  }
  return unitIdByDept;
}

async function seedAnalyticsIncidents(client, ctx) {
  const {
    incidentColumnMeta,
    seedUploadsDir,
    reporterIds,
    audioFiles,
    userIdsByRole,
    departmentIdByCode,
    responderIdByTeamKey,
    incidentCount,
    spanDays,
  } = ctx;

  let duplicatePrimaryId = null;
  const dispatchedReportIds = [];
  let voiceAudioIndex = 0;

  await client.query('BEGIN');
  try {
  for (let i = 0; i < incidentCount; i += 1) {
    const scenario = incidentScenarioForIndex(i, incidentCount);
    const channel = channelKindForIndex(i);
    const statusProfile = statusProfileForIndex(i);
    const isDuplicateChild = scenario === 'duplicate' && duplicatePrimaryId != null;

    let locationFixture = DAGUPAN_LOCATION_FIXTURES[i % DAGUPAN_LOCATION_FIXTURES.length];
    let template = INCIDENT_TEMPLATES[i % INCIDENT_TEMPLATES.length];
    let createdAt = seedCreatedAt(i, incidentCount, spanDays);

    if (scenario === 'duplicate') {
      locationFixture = DUPLICATE_CLUSTER_BASE;
      const clusterStart = seedCreatedAt(Math.max(0, incidentCount - 6), incidentCount, spanDays);
      createdAt = new Date(clusterStart.getTime() + (i - (incidentCount - 6)) * 2 * 60 * 1000);
      template = { type: 'police', severity: 'medium', description: 'Repeated disturbance reports at same location (duplicate cluster).' };
    }

    const reporterId = reporterIds[i % reporterIds.length];
    let incidentType = channel === 'sos' ? 'sos' : template.type;
    let baseDescription = `${template.description} Location reference: ${locationFixture.label}, ${locationFixture.barangay}, Dagupan City.`;
    if (channel === 'text') {
      baseDescription = `[Text report] ${baseDescription}`;
    } else if (channel === 'sos') {
      baseDescription = `[SOS] Emergency button activation. ${baseDescription}`;
    }

    const status = isDuplicateChild ? 'verified' : statusProfile.status;
    const verified = status !== 'pending';

    const inserted = await client.query(
      `INSERT INTO incident_reports(
        user_id, incident_type, severity_level, description, latitude, longitude, barangay,
        status, transcription, verified, ai_pending, ai_attempted, scan_status, quarantined,
        created_at, primary_confidence, is_duplicate, parent_report_id, auto_assignment_mismatch
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,FALSE,'clean',FALSE,$11,$12,$13,$14,$15)
      RETURNING report_id`,
      [
        reporterId,
        incidentType,
        template.severity,
        maybeEncrypt(baseDescription, incidentColumnMeta.description),
        maybeEncrypt(locationFixture.latitude, incidentColumnMeta.latitude),
        maybeEncrypt(locationFixture.longitude, incidentColumnMeta.longitude),
        maybeEncrypt(locationFixture.barangay, incidentColumnMeta.barangay),
        status,
        maybeEncrypt(channel === 'voice' ? 'Seeded voice transcription placeholder.' : null, incidentColumnMeta.transcription),
        verified,
        createdAt.toISOString(),
        0.55 + (i % 45) / 100,
        isDuplicateChild,
        isDuplicateChild ? duplicatePrimaryId : null,
        scenario === 'mismatch',
      ]
    );

    const reportId = inserted.rows[0].report_id;
    if (scenario === 'duplicate' && duplicatePrimaryId == null) {
      duplicatePrimaryId = reportId;
    }

    if (channel === 'voice') {
      const sourceAudio = audioFiles[voiceAudioIndex % audioFiles.length];
      voiceAudioIndex += 1;
      const copiedAudioName = `incident_${reportId}_audio${sourceAudio.ext}`;
      const copiedAudioAbsolute = path.join(seedUploadsDir, copiedAudioName);
      await fs.copyFile(sourceAudio.sourcePath, copiedAudioAbsolute);
      const audioDbPath = path.join('uploads', 'incidents', copiedAudioName).replace(/\\/g, '/');
      await client.query('UPDATE incident_reports SET audio_path = $1 WHERE report_id = $2', [audioDbPath, reportId]);
    }

    if (i % 3 === 0) {
      await client.query(
        `INSERT INTO ai_classifications(report_id, predicted_type, predicted_severity, confidence_score, low_confidence_flag, is_duplicate)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [reportId, incidentType, template.severity, 0.5 + (i % 50) / 100, i % 9 === 0, isDuplicateChild]
      );
    }

    if (i === 0) {
      const dispatcherId = pickDispatcherId(userIdsByRole, 'drrmo');
      await client.query(
        `INSERT INTO incident_coordination_notes(report_id, user_id, author_name, author_role, department, note, created_at)
         VALUES($1,$2,'Alice Dispatcher','dispatcher','CDRRMO','Seeded coordination ping for analytics first-action clock.',$3)`,
        [reportId, dispatcherId, iso(createdAt.getTime() + 90 * 1000)]
      );
    }

    if (scenario === 'unserved' || isDuplicateChild) {
      continue;
    }

    const deptCode = departmentCodeForType(incidentType === 'sos' ? 'medical' : incidentType);
    const deptName = DEPARTMENT_NAME_BY_CODE[deptCode];
    const teamName = teamNameForDepartmentAndType(deptCode, incidentType === 'sos' ? 'medical' : incidentType);
    const teamKey = `${deptCode}::${teamName}`;
    const responderId = responderIdByTeamKey[teamKey] || Object.values(responderIdByTeamKey)[0];
    const dispatcherId = pickDispatcherId(userIdsByRole, deptCode);
    const timeline = buildDispatchTimeline(createdAt.getTime(), { index: i, fastSla: i % 10 !== 3 });

    if (scenario === 'volunteer') {
      const volunteerId = reporterIds[(i + 2) % reporterIds.length];
      await client.query(
        `UPDATE incident_reports SET accepted_by_user_id = $1, accepted_at = $2 WHERE report_id = $3`,
        [volunteerId, iso(createdAt.getTime() + 120 * 1000), reportId]
      );
    }

    if (scenario === 'backup') {
      const requester = userIdsByRole[ROLES.RESPONDER]?.[0] || dispatcherId;
      await client.query(
        `INSERT INTO backup_requests(report_id, requested_by_user_id, target, notes, status, created_at)
         VALUES($1,$2,'both','Seeded backup request for analytics exceptions.','acknowledged',$3)`,
        [reportId, requester, iso(timeline.dispatchMs)]
      );
    }

    if (scenario === 'declined') {
      const fromId = departmentIdByCode.pnp;
      const toId = departmentIdByCode.drrmo;
      await client.query(
        `INSERT INTO incident_escalations(
           report_id, from_department_id, to_department_id, requested_by_user_id,
           urgency, justification_notes, status, responded_at, created_at
         ) VALUES($1,$2,$3,$4,'high','Seeded declined escalation.','declined',$5,$6)`,
        [
          reportId,
          fromId,
          toId,
          dispatcherId,
          iso(createdAt.getTime() + 15 * 60 * 1000),
          iso(createdAt.getTime() + 5 * 60 * 1000),
        ]
      );
      continue;
    }

    if (scenario === 'escalation') {
      const fromId = departmentIdByCode.pnp;
      const toId = departmentIdByCode.drrmo;
      const escCreated = createdAt.getTime() + 8 * 60 * 1000;
      await client.query(
        `INSERT INTO incident_escalations(
           report_id, from_department_id, to_department_id, requested_by_user_id,
           urgency, justification_notes, status, responded_at, created_at
         ) VALUES($1,$2,$3,$4,'critical','Seeded accepted escalation for funnel metrics.','accepted',$5,$6)`,
        [reportId, fromId, toId, dispatcherId, iso(escCreated + 4 * 60 * 1000), iso(escCreated)]
      );
      const escTeam = teamNameForDepartmentAndType('drrmo', 'medical');
      const escResponder = responderIdByTeamKey[`drrmo::${escTeam}`] || responderId;
      await insertDispatchRow(client, {
        reportId,
        responderId: escResponder,
        departmentCode: 'drrmo',
        departmentName: DEPARTMENT_NAME_BY_CODE.drrmo,
        teamName: escTeam,
        dispatchedMs: escCreated + 6 * 60 * 1000,
        arrivalMs: escCreated + 14 * 60 * 1000,
        assignedByUserId: dispatcherId,
        responseStatus: 'On Scene',
      });
      await insertOnSceneHistory(client, {
        reportId,
        userId: dispatcherId,
        arrivalMs: escCreated + 14 * 60 * 1000,
      });
      dispatchedReportIds.push({ reportId, deptCode: 'drrmo', i });
    } else if (scenario === 'reassign') {
      const teamB = deptCode === 'pnp' ? 'Patrol Bravo' : 'Medical Alpha';
      const responderB = responderIdByTeamKey[`${deptCode}::${teamB}`] || responderId;
      await insertDispatchRow(client, {
        reportId,
        responderId,
        departmentCode: deptCode,
        departmentName: deptName,
        teamName,
        dispatchedMs: timeline.dispatchMs,
        arrivalMs: null,
        assignedByUserId: dispatcherId,
        responseStatus: 'En Route',
      });
      await insertDispatchRow(client, {
        reportId,
        responderId: responderB,
        departmentCode: deptCode,
        departmentName: deptName,
        teamName: teamB,
        dispatchedMs: timeline.dispatchMs + 8 * 60 * 1000,
        arrivalMs: timeline.arrivalMs + 8 * 60 * 1000,
        assignedByUserId: dispatcherId,
        responseStatus: 'On Scene',
      });
      await insertOnSceneHistory(client, { reportId, userId: dispatcherId, arrivalMs: timeline.arrivalMs + 8 * 60 * 1000 });
      dispatchedReportIds.push({ reportId, deptCode, i });
    } else {
      await insertDispatchRow(client, {
        reportId,
        responderId,
        departmentCode: deptCode,
        departmentName: deptName,
        teamName,
        dispatchedMs: timeline.dispatchMs,
        arrivalMs: timeline.arrivalMs,
        assignedByUserId: dispatcherId,
        responseStatus: 'On Scene',
      });
      await insertOnSceneHistory(client, { reportId, userId: dispatcherId, arrivalMs: timeline.arrivalMs });
      dispatchedReportIds.push({ reportId, deptCode, i });
    }

    if (statusProfile.status === 'resolved' || statusProfile.status === 'closed') {
      await client.query(
        `UPDATE incident_reports
         SET resolved_at = $1, closed_at = $2, closure_method = $3, responder_status = 'Resolved'
         WHERE report_id = $4`,
        [
          iso(timeline.resolvedMs),
          statusProfile.status === 'closed' ? iso(timeline.closedMs) : null,
          statusProfile.closureMethod,
          reportId,
        ]
      );
    }
  }

  await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  return dispatchedReportIds;
}

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('\n🔄 Clearing existing data (maintaining referential integrity)...');

    await deleteOptional(client, 'dispatcher_login_otp');
    await deleteOptional(client, 'token_blacklist');
    await deleteOptional(client, 'dispatcher_audit_logs');
    await deleteOptional(client, 'notifications');
    await deleteOptional(client, 'backup_responses');
    await deleteOptional(client, 'backup_requests');
    await deleteOptional(client, 'incident_coordination_notes');
    await deleteOptional(client, 'incident_escalations');
    await deleteOptional(client, 'responder_status_history');
    await deleteOptional(client, 'duplicate_clusters');
    await deleteOptional(client, 'dispatches');
    await deleteOptional(client, 'incident_unit_usage');
    await deleteOptional(client, 'blockchain_records');
    await deleteOptional(client, 'ai_classifications');
    await deleteOptional(client, 'responder_team_members');
    await deleteOptional(client, 'responder_teams');
    await deleteOptional(client, 'incident_reports');
    await deleteOptional(client, 'responders');
    await deleteOptional(client, 'responder_applications');
    await deleteOptional(client, 'notification_preferences');
    await deleteOptional(client, 'department_personnel');
    await deleteOptional(client, 'department_units');
    await deleteOptional(client, 'users');
    await deleteOptional(client, 'departments');

    console.log('✅ Cleared old data\n');

    const userColumnMeta = {
      first_name: await getColumnMeta(client, 'users', 'first_name'),
      last_name: await getColumnMeta(client, 'users', 'last_name'),
      email: await getColumnMeta(client, 'users', 'email'),
      phone_number: await getColumnMeta(client, 'users', 'phone_number'),
      address: await getColumnMeta(client, 'users', 'address'),
      department_id: await getColumnMeta(client, 'users', 'department_id'),
    };

    console.log('🏢 Seeding departments...');
    const departmentIdByCode = {};
    for (const dept of DEPARTMENTS) {
      try {
        const result = await client.query(
          `INSERT INTO departments(code, name, type, color, address, latitude, longitude, status, supported_incident_types)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING department_id, code`,
          [dept.code, dept.name, dept.type, dept.color, dept.address || null, dept.latitude || null, dept.longitude || null, dept.status, dept.supported_incident_types]
        );
        departmentIdByCode[result.rows[0].code] = result.rows[0].department_id;
      } catch (error) {
        if (error.code === '42703' && /supported_incident_types/i.test(error.message)) {
          const result = await client.query(
            `INSERT INTO departments(code, name, type, color, address, latitude, longitude, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING department_id, code`,
            [dept.code, dept.name, dept.type, dept.color, dept.address || null, dept.latitude || null, dept.longitude || null, dept.status]
          );
          departmentIdByCode[result.rows[0].code] = result.rows[0].department_id;
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Seeded ${DEPARTMENTS.length} departments (with supported_incident_types for auto-dispatch)\n`);

    console.log('👥 Seeding responder teams...');
    const teamIdByKey = {};
    for (const team of TEAM_ROSTER) {
      const result = await client.query(
        `INSERT INTO responder_teams(department_code, team_name, team_status, supported_incident_types, is_active)
         VALUES($1, $2, $3, $4, TRUE)
         RETURNING team_id, department_code, team_name`,
        [team.department_code, team.team_name, team.team_status, team.supported_incident_types]
      );
      const key = `${result.rows[0].department_code}::${result.rows[0].team_name}`;
      teamIdByKey[key] = result.rows[0].team_id;
    }
    console.log(`✅ Seeded ${TEAM_ROSTER.length} teams\n`);

    console.log('👤 Seeding staff users...');
    const userIds = [];
    const userIdsByRole = {};
    Object.values(ROLES).forEach((role) => { userIdsByRole[role] = []; });

    for (const user of STAFF_USERS) {
      const newUserId = await insertUser(client, user, departmentIdByCode, userColumnMeta);
      await markResponderOnline(client, newUserId, user.role);
      userIds.push(newUserId);
      userIdsByRole[user.role].push(newUserId);
    }
    console.log(`✅ Seeded ${STAFF_USERS.length} staff users\n`);

    console.log('🚨 Seeding account-backed team roster (users + responders + memberships)...');
    const responderIds = [];
    const responderIdByTeamKey = {};
    let membershipCount = 0;

    for (const team of TEAM_ROSTER) {
      const teamKey = `${team.department_code}::${team.team_name}`;
      const teamId = teamIdByKey[teamKey];
      const organization = organizationForDepartment(team.department_code);

      for (const member of team.members) {
        const userId = await insertUser(client, {
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
          phone_number: member.phone_number,
          password: RESPONDER_PASSWORD,
          role: ROLES.RESPONDER,
          address: `${team.team_name}, Dagupan City`,
          department_code: team.department_code,
        }, departmentIdByCode, userColumnMeta);
        await markResponderOnline(client, userId, ROLES.RESPONDER);

        userIds.push(userId);
        userIdsByRole[ROLES.RESPONDER].push(userId);

        const displayName = `${member.first_name} ${member.last_name}`.trim();
        const responderId = await insertResponder(client, {
          userId,
          name: displayName,
          organization,
          contactNumber: member.contact_number,
          availabilityStatus: member.availability_status,
          teamName: team.team_name,
          supportedIncidentTypes: member.supported_incident_types,
        });
        responderIds.push(responderId);
        if (!responderIdByTeamKey[teamKey]) {
          responderIdByTeamKey[teamKey] = responderId;
        }

        await client.query(
          `INSERT INTO responder_team_members(team_id, responder_id, is_active)
           VALUES($1, $2, TRUE)`,
          [teamId, responderId]
        );
        membershipCount += 1;
      }
    }
    console.log(`✅ Seeded ${responderIds.length} account-linked responders across ${membershipCount} memberships\n`);

    console.log(`🆘 Seeding ${INCIDENT_SEED_COUNT} incident reports (${SEED_SPAN_DAYS}d span, analytics lifecycles)...`);
    const audioFiles = await collectAudioFiles();
    const reporterIds = userIdsByRole[ROLES.USER] || [];
    if (reporterIds.length === 0) {
      throw new Error('No reporter users available for incident seeding.');
    }
    if (audioFiles.length === 0) {
      throw new Error('No audio files found for voice-channel incident seeding (need at least one under RescueLink AI/test or Backend/uploads/incidents).');
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

    const dispatchedReportIds = await seedAnalyticsIncidents(client, {
      incidentColumnMeta,
      seedUploadsDir,
      reporterIds,
      audioFiles,
      userIdsByRole,
      departmentIdByCode,
      responderIdByTeamKey,
      incidentCount: INCIDENT_SEED_COUNT,
      spanDays: SEED_SPAN_DAYS,
    });
    console.log(`✅ Seeded ${INCIDENT_SEED_COUNT} incidents with dispatches/escalations for Insights\n`);

    console.log('🚒 Seeding department units, personnel, and unit usage...');
    const unitIdByDept = await seedDepartmentUnitsAndPersonnel(client, departmentIdByCode);
    let unitUsageCount = 0;
    for (const row of dispatchedReportIds) {
      if (row.i % 5 !== 0) continue;
      const units = unitIdByDept[row.deptCode] || [];
      if (!units.length) continue;
      const unitId = units[row.i % units.length];
      const deptId = departmentIdByCode[row.deptCode];
      await client.query(
        `INSERT INTO incident_unit_usage(report_id, unit_id, department_id)
         VALUES($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [row.reportId, unitId, deptId]
      );
      unitUsageCount += 1;
    }
    console.log(`✅ Seeded units/personnel; ${unitUsageCount} incident_unit_usage row(s)\n`);

    const verifyTeams = await client.query(
      `SELECT rt.department_code, rt.team_name, COUNT(r.responder_id)::int AS account_members
         FROM responder_teams rt
         JOIN responder_team_members rtm ON rtm.team_id = rt.team_id AND rtm.is_active = TRUE
         JOIN responders r ON r.responder_id = rtm.responder_id
        WHERE r.source_type = 'account'
          AND r.user_id IS NOT NULL
          AND (
            LOWER(COALESCE(r.availability_status, '')) LIKE '%available%'
            OR LOWER(COALESCE(r.availability_status, '')) LIKE '%standby%'
          )
        GROUP BY rt.team_id, rt.department_code, rt.team_name
        ORDER BY rt.department_code, rt.team_name`
    );

    const unlinked = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM responders r
         JOIN responder_team_members rtm ON rtm.responder_id = r.responder_id
        WHERE r.user_id IS NULL`
    );

    const deptTypes = await client.query(
      `SELECT code, supported_incident_types FROM departments ORDER BY code`
    ).catch(() => ({ rows: [] }));

    console.log('════════════════════════════════════════════════');
    console.log('🎉 Core data seeding completed successfully!');
    console.log('════════════════════════════════════════════════');
    console.log('\n📋 Summary:');
    console.log(`   👤  Users: ${userIds.length} (${STAFF_USERS.length} staff + ${responderIds.length} responders)`);
    console.log(`   🏢 Departments: ${DEPARTMENTS.length}`);
    console.log(`   👥 Teams: ${TEAM_ROSTER.length} (2 account members each)`);
    console.log(`   🚨 Responders: ${responderIds.length} (all account-backed with user_id)`);
    console.log(`   🔗 Team memberships: ${membershipCount}`);
    console.log(`   🆘 Incident reports: ${INCIDENT_SEED_COUNT} (${SEED_SPAN_DAYS}-day analytics window)`);
    console.log('\n✅ Auto-dispatch roster check:');
    for (const row of verifyTeams.rows) {
      console.log(`   - ${row.department_code}/${row.team_name}: ${row.account_members} eligible account member(s)`);
    }
    if (Number(unlinked.rows[0]?.count || 0) > 0) {
      console.warn(`   ⚠️  ${unlinked.rows[0].count} team member(s) missing user_id`);
    } else {
      console.log('   - All team members linked to user accounts');
    }
    if (deptTypes.rows.length > 0) {
      console.log('\n✅ Department type map:');
      for (const row of deptTypes.rows) {
        console.log(`   - ${row.code}: ${JSON.stringify(row.supported_incident_types)}`);
      }
    }
    console.log('\n🔑 Mobile login (phone + password):');
    console.log('   Sample responder: 09003000003 / responder123 (Rescue Alpha, responder3@rescuelink.test)');
    console.log('   Sample citizen:    09005000001 / user123');
    console.log('   Full list: Documentation/backend/ACCOUNTS.md');
    console.log('\n📊 Insights: log in as admin and open /insights (Last 30 / 90 days).');
    console.log('   Optional AI audio batch (may duplicate data): npm run seed-incidents -- --reset');
    console.log(`   Seed flags: --count=N --days=N (defaults ${INCIDENT_SEED_COUNT}/${SEED_SPAN_DAYS})`);
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
