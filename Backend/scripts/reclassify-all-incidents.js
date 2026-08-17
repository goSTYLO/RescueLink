#!/usr/bin/env node

/**
 * Re-run AI audio classification for all incidents with stored audio.
 *
 * Usage:
 *   node scripts/reclassify-all-incidents.js [--dry-run] [--include-overrides]
 *   node scripts/reclassify-all-incidents.js --report-id=821
 *   node scripts/reclassify-all-incidents.js --limit=50 --delay-ms=500
 *
 * Requires RescueLink AI service to be running and DATABASE_URL + AI env configured.
 */

require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const pool = require('../src/config/db');
const Incident = require('../src/models/incident');
const { checkAiHealth, retryClassification } = require('../src/services/aiService');

function parseArgs(argv) {
  const flags = new Set();
  const options = {
    dryRun: false,
    includeOverrides: false,
    reportId: null,
    limit: null,
    offset: 0,
    delayMs: 300,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--include-overrides') {
      options.includeOverrides = true;
    } else if (arg.startsWith('--report-id=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --report-id value: ${arg}`);
      }
      options.reportId = value;
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      options.limit = value;
    } else if (arg.startsWith('--offset=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid --offset value: ${arg}`);
      }
      options.offset = value;
    } else if (arg.startsWith('--delay-ms=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid --delay-ms value: ${arg}`);
      }
      options.delayMs = value;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Reclassify all incidents with stored audio via RescueLink AI.

Options:
  --dry-run              List targets only; do not call AI or update DB
  --include-overrides    Also reclassify incidents with manual is_override=true
  --report-id=<n>        Process a single report (e.g. --report-id=821)
  --limit=<n>            Max incidents to process
  --offset=<n>           Skip first N incidents (with audio), ordered by report_id
  --delay-ms=<n>         Pause between AI calls (default: 300)
  -h, --help             Show this help
`);
}

async function audioFileExists(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTypes(types) {
  if (Array.isArray(types) && types.length > 0) {
    return types.join(', ');
  }
  return '—';
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  console.log('🔁 RescueLink bulk incident reclassification');
  console.log(`   dry_run=${options.dryRun}`);
  console.log(`   include_overrides=${options.includeOverrides}`);
  if (options.reportId) console.log(`   report_id=${options.reportId}`);
  if (options.limit != null) console.log(`   limit=${options.limit} offset=${options.offset}`);
  console.log(`   delay_ms=${options.delayMs}`);

  if (!options.dryRun) {
    const healthy = await checkAiHealth('reclassify-all');
    if (!healthy) {
      console.error('❌ AI service is not reachable. Start RescueLink AI and retry.');
      process.exitCode = 1;
      return;
    }
    console.log('✅ AI service health check passed');
  }

  const incidents = await Incident.listIncidentsWithAudio({
    reportId: options.reportId,
    limit: options.limit,
    offset: options.offset,
  });

  if (incidents.length === 0) {
    console.log('ℹ️  No incidents with audio found for the given filters.');
    return;
  }

  const targets = options.includeOverrides
    ? incidents
    : incidents.filter((row) => !row.is_override);

  const skippedOverrides = incidents.length - targets.length;

  console.log(`📋 Found ${incidents.length} incident(s) with audio`);
  if (skippedOverrides > 0) {
    console.log(`   Skipping ${skippedOverrides} manual override(s) (use --include-overrides to include)`);
  }
  console.log(`   Will process ${targets.length} incident(s)\n`);

  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    missingAudio: 0,
    skipped: skippedOverrides,
  };

  for (const row of targets) {
    summary.processed += 1;
    const label = `#${row.report_id}`;
    const beforeTypes = formatTypes(row.incident_types || row.incident_type);

    if (!(await audioFileExists(row.audio_path))) {
      summary.missingAudio += 1;
      console.log(`⚠️  ${label} missing audio file: ${row.audio_path}`);
      continue;
    }

    if (options.dryRun) {
      console.log(`DRY  ${label}  audio=${row.audio_path}  current_types=${beforeTypes}`);
      continue;
    }

    try {
      const aiResult = await retryClassification(row.audio_path);
      await Incident.applyAiClassificationResult(row.report_id, aiResult, {
        is_override: false,
        retry_count: 0,
      });

      summary.succeeded += 1;
      const afterTypes = formatTypes(aiResult.incidentTypes);
      console.log(
        `✅ ${label}  ${beforeTypes} → ${afterTypes}`
        + `  primary_conf=${((aiResult.primaryConfidence ?? 0) * 100).toFixed(1)}%`
        + `  keyword_promoted=${aiResult.keywordPromoted}`
      );
    } catch (error) {
      summary.failed += 1;
      console.error(`❌ ${label}  ${error.message}`);
    }

    if (options.delayMs > 0 && summary.processed < targets.length) {
      await sleep(options.delayMs);
    }
  }

  console.log('\n📊 Reclassification summary');
  console.log(`   Processed: ${summary.processed}`);
  console.log(`   Succeeded: ${summary.succeeded}`);
  console.log(`   Failed: ${summary.failed}`);
  console.log(`   Missing audio: ${summary.missingAudio}`);
  console.log(`   Skipped overrides: ${summary.skipped}`);
  if (options.dryRun) {
    console.log('   (dry run — no DB or AI changes made)');
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
