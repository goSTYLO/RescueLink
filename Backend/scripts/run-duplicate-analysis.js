#!/usr/bin/env node

/**
 * Run duplicate analysis on existing incidents.
 * Use after seeding or when incidents were created before duplicate detection ran.
 * Usage: node scripts/run-duplicate-analysis.js
 */

require('dotenv').config();
const pool = require('../src/config/db');
const { runDuplicateAnalysis } = require('../src/services/duplicateBackgroundAnalyzer');

async function main() {
  console.log('Running duplicate analysis on existing incidents (last 7 days)...');
  try {
    const before = await pool.query(
      'SELECT COUNT(*)::int AS n FROM incident_reports WHERE is_duplicate = TRUE'
    );
    await runDuplicateAnalysis({ extendedWindowMinutes: 10080 });
    const after = await pool.query(
      'SELECT COUNT(*)::int AS n FROM incident_reports WHERE is_duplicate = TRUE'
    );
    const linked = (after.rows[0]?.n ?? 0) - (before.rows[0]?.n ?? 0);
    console.log(`Linked ${linked} report(s) as duplicates. Total duplicates now: ${after.rows[0]?.n ?? 0}`);
    console.log('Done. Refresh the dashboard to see badges and Related Reports.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
