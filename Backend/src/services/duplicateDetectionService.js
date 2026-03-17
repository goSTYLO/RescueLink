/**
 * Duplicate detection service - geospatial + time-based clustering
 * No AI required - uses distance and time window matching.
 *
 * Behavior:
 * - Never auto-links incidents; only flags for dispatcher review (flagged_for_review).
 * - findPotentialDuplicates returns decrypted description, reporter_name, status for UI display.
 * - getDuplicateInfo/getDuplicateCluster return decrypted cluster data.
 */

const pool = require('../config/db');
const { tryDecryptValue } = require('../utils/encryption');
const { calculateDistance } = require('../utils/geolocation');
const duplicateConfig = require('../config/duplicateDetection');

// Approximate degrees per meter at mid-latitudes (for bounding box)
const DEG_PER_METER_LAT = 1 / 111320;
const DEG_PER_METER_LNG = 1 / 111320; // Simplified; at 16°N it's ~1/106700

/**
 * Calculate duplicate confidence score (0-1) based on:
 * - Distance (closer = higher score)
 * - Time difference (closer = higher score)
 * - Same incident type (same = bonus)
 */
function calculateDuplicateConfidence(newReport, existingReport, radiusMeters, timeWindowMinutes) {
  const lat1 = parseFloat(newReport.latitude);
  const lng1 = parseFloat(newReport.longitude);
  const lat2 = parseFloat(existingReport.latitude);
  const lng2 = parseFloat(existingReport.longitude);

  const distanceMeters = calculateDistance(lat1, lng1, lat2, lng2);
  if (distanceMeters > radiusMeters) return 0;

  const time1 = newReport.created_at ? new Date(newReport.created_at).getTime() : Date.now();
  const time2 = existingReport.created_at ? new Date(existingReport.created_at).getTime() : time1;
  const timeDiffMinutes = Math.abs(time1 - time2) / (60 * 1000);
  if (timeDiffMinutes > timeWindowMinutes) return 0;

  // Distance score: 0 at radius, 1 at same location
  const distanceScore = Math.max(0, 1 - distanceMeters / radiusMeters);

  // Time score: 0 at window edge, 1 at same time
  const timeScore = Math.max(0, 1 - timeDiffMinutes / timeWindowMinutes);

  // Type match bonus: +0.15 if same type (or both null)
  const type1 = (newReport.incident_type || newReport.primary_classification || '').toLowerCase().trim();
  const type2 = (existingReport.incident_type || existingReport.primary_classification || '').toLowerCase().trim();
  const typeBonus = (type1 && type2 && type1 === type2) ? 0.15 : 0;

  // Weighted average: distance 50%, time 35%, base 15% + type bonus
  let score = distanceScore * 0.5 + timeScore * 0.35 + 0.15 + typeBonus;
  return Math.min(1, Math.max(0, score));
}

/**
 * Find potential duplicates based on location, time, and incident type
 * @param {Object} report - The report to check
 * @param {number} radiusMeters - Search radius (default from config)
 * @param {number} timeWindowMinutes - Time window (default from config)
 * @returns {Promise<Array>} Array of { report_id, confidence, ... } sorted by confidence desc
 */
async function findPotentialDuplicates(report, radiusMeters = null, timeWindowMinutes = null) {
  if (!duplicateConfig.enabled) return [];

  const radius = radiusMeters ?? duplicateConfig.realTime.radiusMeters;
  const timeWindow = timeWindowMinutes ?? duplicateConfig.realTime.timeWindowMinutes;

  const lat = parseFloat(report.latitude);
  const lng = parseFloat(report.longitude);
  const reportId = report.report_id ?? report.reportId;
  const createdAt = report.created_at || new Date();

  if (isNaN(lat) || isNaN(lng)) return [];

  // Bounding box: ~radius in degrees (approximate)
  const deltaDeg = (radius / 1000) * 0.01; // ~100m = 0.001 degrees
  const latMin = lat - deltaDeg;
  const latMax = lat + deltaDeg;
  const lngMin = lng - deltaDeg;
  const lngMax = lng + deltaDeg;

  const timeStart = new Date(createdAt);
  timeStart.setMinutes(timeStart.getMinutes() - timeWindow);
  const timeEnd = new Date(createdAt);
  timeEnd.setMinutes(timeEnd.getMinutes() + timeWindow);

  const res = await pool.query(
    `SELECT ir.report_id, ir.user_id, ir.incident_type, ir.primary_classification, ir.status, ir.description,
            ir.latitude, ir.longitude, ir.created_at,
            u.first_name AS reporter_first_name, u.last_name AS reporter_last_name
     FROM incident_reports ir
     LEFT JOIN users u ON ir.user_id = u.user_id
     WHERE ir.report_id != $1
       AND ir.latitude BETWEEN $2 AND $3
       AND ir.longitude BETWEEN $4 AND $5
       AND ir.created_at BETWEEN $6 AND $7
       AND (ir.is_duplicate IS NULL OR ir.is_duplicate = FALSE)
     ORDER BY ir.created_at DESC
     LIMIT 50`,
    [reportId || -1, latMin, latMax, lngMin, lngMax, timeStart, timeEnd]
  );

  const candidates = res.rows.map((row) => {
    const confidence = calculateDuplicateConfidence(report, row, radius, timeWindow);
    return {
      report_id: row.report_id,
      user_id: row.user_id,
      incident_type: row.incident_type,
      primary_classification: row.primary_classification,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      created_at: row.created_at,
      description: tryDecryptValue(row.description) || row.description,
      reporter_name: [tryDecryptValue(row.reporter_first_name), tryDecryptValue(row.reporter_last_name)].filter(Boolean).join(' ').trim() || `User #${row.user_id}`,
      confidence,
    };
  }).filter((c) => c.confidence > 0);

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Link a report as duplicate of another
 * @param {number} reportId - The duplicate report
 * @param {number} parentReportId - The original report
 * @param {number} confidence - Confidence score
 * @param {string} method - 'geospatial_time', 'manual', 'background_analysis'
 */
async function linkAsDuplicate(reportId, parentReportId, confidence, method = 'geospatial_time') {
  await pool.query(
    `UPDATE incident_reports
     SET parent_report_id = $1, duplicate_confidence_score = $2, duplicate_detected_at = CURRENT_TIMESTAMP,
         duplicate_detection_method = $3, is_duplicate = TRUE
     WHERE report_id = $4`,
    [parentReportId, confidence, method, reportId]
  );
}

/**
 * Get all reports in a duplicate cluster (primary + all duplicates)
 */
async function getDuplicateCluster(primaryReportId) {
  const res = await pool.query(
    `SELECT ir.report_id, ir.user_id, ir.incident_type, ir.severity_level, ir.status, ir.description, ir.latitude, ir.longitude,
            ir.created_at, ir.duplicate_confidence_score, ir.duplicate_detection_method, ir.is_duplicate, ir.parent_report_id,
            u.first_name AS reporter_first_name, u.last_name AS reporter_last_name
     FROM incident_reports ir
     LEFT JOIN users u ON ir.user_id = u.user_id
     WHERE ir.report_id = $1 OR ir.parent_report_id = $1
     ORDER BY ir.created_at ASC`,
    [primaryReportId]
  );
  return res.rows;
}

/**
 * Get the primary report for a cluster (follow parent_report_id chain)
 */
async function getPrimaryReportId(reportId) {
  const res = await pool.query(
    'SELECT report_id, parent_report_id FROM incident_reports WHERE report_id = $1',
    [reportId]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.parent_report_id) return getPrimaryReportId(row.parent_report_id);
  return row.report_id;
}

/**
 * Unlink a report (if falsely marked as duplicate)
 */
async function unlinkDuplicate(reportId) {
  await pool.query(
    `UPDATE incident_reports
     SET parent_report_id = NULL, duplicate_confidence_score = NULL, duplicate_detected_at = NULL,
         duplicate_detection_method = NULL, is_duplicate = FALSE, flagged_for_review = FALSE
     WHERE report_id = $1`,
    [reportId]
  );
}

/**
 * Clear the duplicate-review flag (when dispatcher confirms "Not a Duplicate")
 */
async function clearDuplicateFlag(reportId) {
  await pool.query(
    'UPDATE incident_reports SET flagged_for_review = FALSE WHERE report_id = $1',
    [reportId]
  );
}

/**
 * Get duplicate info for a report (for API response)
 */
async function getDuplicateInfo(reportId) {
  const res = await pool.query(
    'SELECT report_id, parent_report_id, is_duplicate, duplicate_confidence_score FROM incident_reports WHERE report_id = $1',
    [reportId]
  );
  const row = res.rows[0];
  if (!row) return null;

  const primaryId = row.parent_report_id ? await getPrimaryReportId(reportId) : reportId;
  const cluster = primaryId ? await getDuplicateCluster(primaryId) : [];

  return {
    is_duplicate: Boolean(row.is_duplicate),
    parent_report_id: row.parent_report_id,
    duplicate_confidence: row.duplicate_confidence_score,
    cluster: cluster.map((r) => ({
      report_id: r.report_id,
      status: r.status,
      created_at: r.created_at,
      description: tryDecryptValue(r.description) || r.description,
      reporter_name: [tryDecryptValue(r.reporter_first_name), tryDecryptValue(r.reporter_last_name)].filter(Boolean).join(' ').trim() || `User #${r.user_id}`,
      confidence: r.duplicate_confidence_score,
    })),
  };
}

module.exports = {
  calculateDuplicateConfidence,
  findPotentialDuplicates,
  linkAsDuplicate,
  getDuplicateCluster,
  getPrimaryReportId,
  unlinkDuplicate,
  clearDuplicateFlag,
  getDuplicateInfo,
};
