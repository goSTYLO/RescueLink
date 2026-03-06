#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const { encrypt } = require('../src/utils/encryption');
const { ROLES } = require('../src/config/roles');
const { checkAiHealth, processIncidentWithAudio } = require('../src/services/aiService');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const args = new Set(process.argv.slice(2));
const shouldReset = args.has('--reset');
const requestedCountArg = process.argv.slice(2).find((arg) => arg.startsWith('--count='));
const DEFAULT_INCIDENT_COUNT = 10;
const MAX_INCIDENT_COUNT = 10;
const requestedCount = requestedCountArg ? Number(requestedCountArg.split('=')[1]) : DEFAULT_INCIDENT_COUNT;
const targetCount = Number.isFinite(requestedCount) && requestedCount > 0
  ? Math.min(requestedCount, MAX_INCIDENT_COUNT)
  : DEFAULT_INCIDENT_COUNT;

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.flac', '.ogg']);
const BARANGAYS = [
  'Poblacion Oeste',
  'Bonuan Boquig',
  'Bonuan Binloc',
  'Pantal',
  'Tapuac',
  'Lucao',
  'Lasip Chico',
  'Malued',
  'Bacayao Norte',
  'Bacayao Sur',
];

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

function maybeEncrypt(value, columnMeta) {
  if (value === null || value === undefined || !columnMeta) return value;
  if (columnMeta.data_type === 'text') return encrypt(String(value));
  if (!columnMeta.character_maximum_length) return value;
  if (estimateEncryptedHexLength(value) <= columnMeta.character_maximum_length) return encrypt(String(value));
  return value;
}

function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1 && num <= 100) return num / 100;
  if (num > 1) return 1;
  return num;
}

function coerceIncidentType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('crime') || normalized.includes('police')) return 'police';
  if (normalized.includes('fire')) return 'fire';
  if (normalized.includes('medical')) return 'medical';
  if (
    normalized.includes('accident')
    || normalized.includes('disaster')
    || normalized.includes('other')
    || normalized.includes('rescue')
    || normalized.includes('flood')
    || normalized.includes('earthquake')
    || normalized.includes('storm')
  ) {
    return 'disaster';
  }
  const allowed = new Set(['fire', 'medical', 'police', 'disaster']);
  if (allowed.has(normalized)) return normalized;
  return null;
}

function coerceSeverity(value) {
  const allowed = new Set(['low', 'medium', 'high']);
  const normalized = String(value || '').trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  return 'medium';
}

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
      entries.push({
        sourcePath: absolutePath,
        originalName: entry.name,
        ext,
      });
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
      // ignore missing dirs
    }
  }
  const uniqueMap = new Map();
  entries.forEach((entry) => {
    uniqueMap.set(entry.sourcePath, entry);
  });
  return shuffleList([...uniqueMap.values()]);
}

async function seedIncidents() {
  const client = await pool.connect();
  try {
    console.log('🎧 Seeding incidents from real audio samples...');
    console.log(`📍 Database URL: ${DATABASE_URL}`);

    const reporterRows = await client.query(
      `SELECT user_id
       FROM users
       WHERE role IN ($1, $2, $3)
       ORDER BY user_id ASC`,
      [ROLES.USER, ROLES.DISPATCHER, ROLES.SUPERVISOR]
    );
    const reporterIds = reporterRows.rows.map((row) => row.user_id);
    if (reporterIds.length === 0) {
      throw new Error('No reporter-capable users found. Run npm run seed-db first.');
    }

    const audioFiles = await collectAudioFiles();
    if (audioFiles.length === 0) {
      throw new Error('No audio files found in RescueLink AI/test or Backend/uploads/incidents.');
    }
    console.log(`🔎 Found ${audioFiles.length} audio files. Target incidents: ${targetCount}.`);

    try {
      const aiHealthy = await checkAiHealth('seed-incidents-healthcheck');
      if (!aiHealthy) {
        console.warn('⚠️ AI health check did not return healthy. Continuing and relying on per-file AI calls.');
      }
    } catch (error) {
      console.warn(`⚠️ AI health probe failed (${error.message}). Continuing and relying on per-file AI calls.`);
    }

    if (shouldReset) {
      console.log('🧹 Reset mode enabled: deleting existing incident-related records...');
      await client.query('DELETE FROM dispatches');
      await client.query('DELETE FROM blockchain_records');
      await client.query('DELETE FROM ai_classifications');
      await client.query('DELETE FROM notifications WHERE report_id IS NOT NULL');
      await client.query('DELETE FROM incident_reports');
    }

    const incidentColumnMeta = {
      description: await getColumnMeta(client, 'incident_reports', 'description'),
      latitude: await getColumnMeta(client, 'incident_reports', 'latitude'),
      longitude: await getColumnMeta(client, 'incident_reports', 'longitude'),
      barangay: await getColumnMeta(client, 'incident_reports', 'barangay'),
      transcription: await getColumnMeta(client, 'incident_reports', 'transcription'),
    };

    const uploadsDir = path.join(process.cwd(), 'uploads', 'incidents');
    await fs.mkdir(uploadsDir, { recursive: true });

    let createdCount = 0;
    let aiCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < audioFiles.length && createdCount < targetCount; i++) {
      const audio = audioFiles[i];
      const userId = reporterIds[i % reporterIds.length];
      const barangay = BARANGAYS[i % BARANGAYS.length];
      const latitude = 16.04 + ((i % 7) * 0.0017);
      const longitude = 120.33 + ((i % 7) * 0.0013);
      const status = i % 6 === 0 ? 'verified' : (i % 4 === 0 ? 'resolved' : 'pending');
      const requestId = `seed-incidents-${Date.now()}-${i}`;
      let aiResult;
      try {
        const audioBuffer = await fs.readFile(audio.sourcePath);
        aiResult = await processIncidentWithAudio(audioBuffer, audio.originalName, null, { requestId });
      } catch (error) {
        skippedCount += 1;
        console.warn(`⚠️ Skipping ${audio.originalName} (AI failed): ${error.message}`);
        continue;
      }

      const incidentType = coerceIncidentType(aiResult?.primaryType);
      const severity = coerceSeverity(aiResult?.severity);
      const secondaryType = coerceIncidentType(aiResult?.secondaryType);
      const primaryConfidence = normalizeConfidence(aiResult?.maxConfidence);
      const secondaryConfidence = normalizeConfidence(aiResult?.secondaryConfidence);
      const transcriptionText = String(aiResult?.transcription || '').trim();
      if (!incidentType) {
        skippedCount += 1;
        console.warn(`⚠️ Skipping ${audio.originalName} (unsupported AI type: ${String(aiResult?.primaryType || 'n/a')}).`);
        continue;
      }
      if (!transcriptionText) {
        skippedCount += 1;
        console.warn(`⚠️ Skipping ${audio.originalName} (empty AI transcription).`);
        continue;
      }
      const baseDescription = `Audio-reported ${incidentType} incident near ${barangay}. Source file: ${audio.originalName}`;

      const insertRes = await client.query(
        `INSERT INTO incident_reports(
           user_id,
           incident_type,
           severity_level,
           primary_classification,
           primary_confidence,
           secondary_classification,
           secondary_confidence,
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
           quarantined
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,FALSE,TRUE,'clean',FALSE)
         RETURNING report_id`,
        [
          userId,
          incidentType,
          severity,
          incidentType,
          primaryConfidence,
          secondaryType,
          secondaryConfidence,
          maybeEncrypt(baseDescription, incidentColumnMeta.description),
          maybeEncrypt(latitude, incidentColumnMeta.latitude),
          maybeEncrypt(longitude, incidentColumnMeta.longitude),
          maybeEncrypt(barangay, incidentColumnMeta.barangay),
          status,
          maybeEncrypt(transcriptionText, incidentColumnMeta.transcription),
          status !== 'pending',
        ]
      );
      const reportId = insertRes.rows[0].report_id;

      const targetFilename = `incident_${reportId}_audio${audio.ext}`;
      const targetAbsolutePath = path.join(uploadsDir, targetFilename);
      await fs.copyFile(audio.sourcePath, targetAbsolutePath);
      const audioDbPath = path.join('uploads', 'incidents', targetFilename).replace(/\\/g, '/');

      await client.query(
        `UPDATE incident_reports
         SET audio_path = $1
         WHERE report_id = $2`,
        [audioDbPath, reportId]
      );

      await client.query(
        `INSERT INTO ai_classifications(
           report_id,
           predicted_type,
           predicted_severity,
           confidence_score,
           secondary_predicted_type,
           secondary_confidence_score,
           low_confidence_flag,
           is_duplicate,
           is_override,
           retry_count
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE,0)`,
        [
          reportId,
          incidentType,
          severity,
          primaryConfidence,
          secondaryType,
          secondaryConfidence,
          Boolean(aiResult?.lowConfidenceFlag),
        ]
      );

      createdCount++;
      aiCount++;
      console.log(`✅ Seeded report_id=${reportId} file=${audio.originalName} type=${incidentType} severity=${severity}`);
    }

    if (createdCount === 0) {
      throw new Error('AI-based seeding created 0 incidents. Check AI service logs and audio files.');
    }

    console.log('════════════════════════════════════════════════');
    console.log('✅ Incident audio seeding completed!');
    console.log('════════════════════════════════════════════════');
    console.log(`   🎧 Incidents created: ${createdCount}`);
    console.log(`   🤖 AI classification rows: ${aiCount}`);
    console.log(`   ⏭️ Skipped audio files: ${skippedCount}`);
    console.log(`   🗂️ Source pools: RescueLink AI/test + Backend/uploads/incidents`);
  } catch (error) {
    console.error('❌ Incident seeding failed!');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedIncidents();
