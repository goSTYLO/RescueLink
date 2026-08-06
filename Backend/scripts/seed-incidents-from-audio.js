#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const { encrypt } = require('../src/utils/encryption');
const { ROLES } = require('../src/config/roles');
const { checkAiHealth, processIncidentWithAudio } = require('../src/services/aiService');
const { runDuplicateAnalysis } = require('../src/services/duplicateBackgroundAnalyzer');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL not set in .env file');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const args = new Set(process.argv.slice(2));
const shouldReset = args.has('--reset');
const requestedCountArg = process.argv.slice(2).find((arg) => arg.startsWith('--count='));
// Seed 30 incidents: 5 duplicates (same location, within 10 min) + 25 unique
const DEFAULT_INCIDENT_COUNT = 30;
const MAX_INCIDENT_COUNT = 30;
const DUPLICATE_CLUSTER_SIZE = 5;
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

// Base location for duplicate cluster (within 100m, 10-min window per env thresholds)
const DUPLICATE_CLUSTER_BASE = { barangay: 'Poblacion Oeste', latitude: 16.043037, longitude: 120.3323573, label: 'Dagupan City Police Station' };
// Small offsets (~5.5m each) so all 5 stay within 100m
const DUPLICATE_LOCATION_OFFSETS = [
  [0, 0], [0.00005, 0], [0, 0.00005], [-0.00005, 0], [0, -0.00005],
];

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
  { barangay: 'Mangin', latitude: 16.0482, longitude: 120.3412, label: 'Mangin District' },
  { barangay: 'Arellano-Bani', latitude: 16.0455, longitude: 120.3389, label: 'Arellano-Bani Area' },
  { barangay: 'Herrero-Perez', latitude: 16.0478, longitude: 120.3356, label: 'Herrero-Perez Area' },
  { barangay: 'Lasip Grande', latitude: 16.0521, longitude: 120.3612, label: 'Lasip Grande Barangay' },
  { barangay: 'Tambac', latitude: 16.0412, longitude: 120.3289, label: 'Tambac Area' },
  { barangay: 'Carael', latitude: 16.0398, longitude: 120.3156, label: 'Carael District' },
  { barangay: 'Calmay', latitude: 16.0375, longitude: 120.3221, label: 'Calmay Area' },
  { barangay: 'Pogo Chico', latitude: 16.0502, longitude: 120.3445, label: 'Pogo Chico Barangay' },
  { barangay: 'Pogo Grande', latitude: 16.0534, longitude: 120.3489, label: 'Pogo Grande Barangay' },
  { barangay: 'Salisay', latitude: 16.0467, longitude: 120.3523, label: 'Salisay Area' },
  { barangay: 'Tebeng', latitude: 16.0592, longitude: 120.3298, label: 'Tebeng District' },
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
       WHERE role = $1
       ORDER BY user_id ASC`,
      [ROLES.USER]
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
    const duplicateReportIds = [];
    const baseTime = new Date();

    // Phase 1: Create 5 duplicate incidents (same location within 100m, created_at within 10 min)
    const duplicateAudio = audioFiles[0];
    let duplicateAiResult;
    try {
      const audioBuffer = await fs.readFile(duplicateAudio.sourcePath);
      duplicateAiResult = await processIncidentWithAudio(audioBuffer, duplicateAudio.originalName, null, {
        requestId: `seed-incidents-${Date.now()}-dup`,
      });
    } catch (error) {
      skippedCount += DUPLICATE_CLUSTER_SIZE;
      console.warn(`⚠️ Skipping ${DUPLICATE_CLUSTER_SIZE} duplicate incidents (AI failed for ${duplicateAudio.originalName}): ${error.message}`);
    }

    if (duplicateAiResult) {
      const incidentType = coerceIncidentType(duplicateAiResult?.primaryType);
      const severity = coerceSeverity(duplicateAiResult?.severity);
      const secondaryType = coerceIncidentType(duplicateAiResult?.secondaryType);
      const primaryConfidence = normalizeConfidence(duplicateAiResult?.maxConfidence);
      const secondaryConfidence = normalizeConfidence(duplicateAiResult?.secondaryConfidence);
      const transcriptionText = String(duplicateAiResult?.transcription || '').trim();
      if (incidentType && transcriptionText) {
        const barangay = DUPLICATE_CLUSTER_BASE.barangay;
        for (let dupIdx = 0; dupIdx < DUPLICATE_CLUSTER_SIZE; dupIdx++) {
          const offset = DUPLICATE_LOCATION_OFFSETS[dupIdx];
          const latitude = DUPLICATE_CLUSTER_BASE.latitude + offset[0];
          const longitude = DUPLICATE_CLUSTER_BASE.longitude + offset[1];
          const createdAt = new Date(baseTime.getTime() - (8 - dupIdx * 2) * 60 * 1000);
          const userId = reporterIds[dupIdx % reporterIds.length];
          const statusCycle = ['pending', 'verified', 'in_progress', 'resolved', 'closed'];
          const status = statusCycle[dupIdx % statusCycle.length];
          const baseDescription = `Audio-reported ${incidentType} incident near ${barangay}. Location: ${DUPLICATE_CLUSTER_BASE.label}. Source file: ${duplicateAudio.originalName} (duplicate #${dupIdx + 1})`;

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
               quarantined,
               created_at
             )
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,FALSE,TRUE,'clean',FALSE,$15)
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
              createdAt,
            ]
          );
          const reportId = insertRes.rows[0].report_id;
          duplicateReportIds.push(reportId);

          const targetFilename = `incident_${reportId}_audio${duplicateAudio.ext}`;
          const targetAbsolutePath = path.join(uploadsDir, targetFilename);
          await fs.copyFile(duplicateAudio.sourcePath, targetAbsolutePath);
          const audioDbPath = path.join('uploads', 'incidents', targetFilename).replace(/\\/g, '/');

          await client.query(
            `UPDATE incident_reports SET audio_path = $1 WHERE report_id = $2`,
            [audioDbPath, reportId]
          );

          await client.query(
            `INSERT INTO ai_classifications(report_id, predicted_type, predicted_severity, confidence_score, secondary_predicted_type, secondary_confidence_score, low_confidence_flag, is_duplicate, is_override, retry_count)
             VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE,0)`,
            [
              reportId,
              incidentType,
              severity,
              primaryConfidence,
              secondaryType,
              secondaryConfidence,
              Boolean(duplicateAiResult?.lowConfidenceFlag),
            ]
          );

          createdCount++;
          aiCount++;
          console.log(`✅ Seeded report_id=${reportId} [duplicate ${dupIdx + 1}/5] file=${duplicateAudio.originalName} type=${incidentType} severity=${severity}`);
        }
      } else {
        skippedCount += DUPLICATE_CLUSTER_SIZE;
        console.warn(`⚠️ Skipping ${DUPLICATE_CLUSTER_SIZE} duplicate incidents (unsupported type or empty transcription).`);
      }
    }

    // Phase 2: Create unique incidents (variety of Dagupan locations, created_at 60+ min ago)
    const shuffledLocations = shuffleList([...DAGUPAN_LOCATION_FIXTURES]);
    for (let i = DUPLICATE_CLUSTER_SIZE; i < targetCount; i++) {
      const audio = audioFiles[i % audioFiles.length];
      const userId = reporterIds[i % reporterIds.length];
      const locationFixture = shuffledLocations[i % shuffledLocations.length];
      const barangay = locationFixture?.barangay || BARANGAYS[i % BARANGAYS.length];
      const latitude = Number(locationFixture?.latitude);
      const longitude = Number(locationFixture?.longitude);
      const statusCycle = ['pending', 'verified', 'in_progress', 'resolved', 'closed'];
      const status = statusCycle[i % statusCycle.length];
      const createdAt = new Date(baseTime.getTime() - (60 + (i - DUPLICATE_CLUSTER_SIZE) * 10) * 60 * 1000);
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
      const baseDescription = `Audio-reported ${incidentType} incident near ${barangay}. Location: ${locationFixture?.label || barangay}. Source file: ${audio.originalName}`;

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
           quarantined,
           created_at
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,FALSE,TRUE,'clean',FALSE,$15)
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
          createdAt,
        ]
      );
      const reportId = insertRes.rows[0].report_id;

      const targetFilename = `incident_${reportId}_audio${audio.ext}`;
      const targetAbsolutePath = path.join(uploadsDir, targetFilename);
      await fs.copyFile(audio.sourcePath, targetAbsolutePath);
      const audioDbPath = path.join('uploads', 'incidents', targetFilename).replace(/\\/g, '/');

      await client.query(
        `UPDATE incident_reports SET audio_path = $1 WHERE report_id = $2`,
        [audioDbPath, reportId]
      );

      await client.query(
        `INSERT INTO ai_classifications(report_id, predicted_type, predicted_severity, confidence_score, secondary_predicted_type, secondary_confidence_score, low_confidence_flag, is_duplicate, is_override, retry_count)
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

    // Run duplicate analysis to link the 5 duplicate incidents immediately
    if (duplicateReportIds.length > 0) {
      try {
        await runDuplicateAnalysis();
        console.log('   🔗 Duplicate analysis run (5 incidents should be linked as duplicates)');
      } catch (err) {
        console.warn(`   ⚠️ Duplicate analysis failed: ${err.message}`);
      }
    }

    console.log('════════════════════════════════════════════════');
    console.log('✅ Incident audio seeding completed!');
    console.log('════════════════════════════════════════════════');
    console.log(`   🎧 Incidents created: ${createdCount}`);
    console.log(`   🤖 AI classification rows: ${aiCount}`);
    console.log(`   ⏭️ Skipped audio files: ${skippedCount}`);
    console.log(`   🗂️ Source pools: RescueLink AI/test + Backend/uploads/incidents`);
    if (duplicateReportIds.length > 0) {
      console.log(`   🔗 Duplicate cluster (report_ids): ${duplicateReportIds.join(', ')}`);
    }
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
