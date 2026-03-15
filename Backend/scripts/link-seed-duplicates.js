#!/usr/bin/env node

/**
 * One-time script to link the 5 seed duplicate incidents (Poblacion Oeste, same audio).
 * Use when runDuplicateAnalysis didn't link them (e.g. time window or encryption issues).
 * Usage: node scripts/link-seed-duplicates.js
 */

require('dotenv').config();
const pool = require('../src/config/db');
const { linkAsDuplicate } = require('../src/services/duplicateDetectionService');
const { tryDecryptValue } = require('../src/utils/encryption');

const BASE_LAT = 16.043037;
const BASE_LNG = 120.3323573;
const RADIUS_DEG = 0.001; // ~100m

async function main() {
  console.log('Finding Poblacion Oeste incidents to link as duplicates...');
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT report_id, latitude, longitude, created_at, is_duplicate, parent_report_id
       FROM incident_reports
       WHERE (is_duplicate IS NULL OR is_duplicate = FALSE)
         AND parent_report_id IS NULL
       ORDER BY created_at ASC
       LIMIT 100`
    );
    const rows = res.rows;
    const decryptIfNeeded = (v) => {
      if (v == null) return null;
      const parsed = tryDecryptValue(v);
      const num = Number(parsed);
      return Number.isFinite(num) ? num : parsed;
    };
    const withCoords = rows.map((r) => ({
      ...r,
      lat: decryptIfNeeded(r.latitude),
      lng: decryptIfNeeded(r.longitude),
    })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    const nearBase = withCoords.filter((r) => {
      const dLat = Math.abs(r.lat - BASE_LAT);
      const dLng = Math.abs(r.lng - BASE_LNG);
      return dLat <= RADIUS_DEG && dLng <= RADIUS_DEG;
    });
    if (nearBase.length < 2) {
      console.log(`Found ${nearBase.length} incident(s) near base. Need at least 2 to form a cluster.`);
      return;
    }
    const sorted = nearBase.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const primaryId = sorted[0].report_id;
    let linked = 0;
    for (let i = 1; i < sorted.length; i++) {
      const childId = sorted[i].report_id;
      const existing = await client.query('SELECT parent_report_id FROM incident_reports WHERE report_id = $1', [childId]);
      if (existing.rows[0]?.parent_report_id != null) continue;
      await linkAsDuplicate(childId, primaryId, 0.95, 'manual');
      linked++;
      console.log(`  Linked report ${childId} to primary ${primaryId}`);
    }
    console.log(`Linked ${linked} report(s). Primary: ${primaryId}. Refresh the dashboard.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
