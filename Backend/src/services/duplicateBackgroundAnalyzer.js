/**
 * Background Duplicate Detection Analyzer
 * Runs every 2 minutes to cluster duplicates that real-time may have missed
 */

const cron = require('node-cron');
const pool = require('../config/db');
const duplicateConfig = require('../config/duplicateDetection');
const {
  findPotentialDuplicates,
} = require('./duplicateDetectionService');

const CRON_SCHEDULE = '*/2 * * * *'; // Every 2 minutes

/**
 * Find reports from last N minutes not yet analyzed for duplicates
 */
async function getRecentReportsToAnalyze(minutes = 30) {
  const since = new Date();
  since.setMinutes(since.getMinutes() - minutes);

  const res = await pool.query(
    `SELECT report_id, user_id, incident_type, primary_classification, latitude, longitude, created_at
     FROM incident_reports
     WHERE created_at >= $1
       AND (is_duplicate IS NULL OR is_duplicate = FALSE)
       AND parent_report_id IS NULL
     ORDER BY created_at ASC
     LIMIT 100`,
    [since]
  );
  return res.rows;
}

/**
 * Run background duplicate analysis
 * @param {Object} [options]
 * @param {number} [options.extendedWindowMinutes] - When set (e.g. 10080 = 7 days), analyze all unlinked reports from this window. Use for manual runs on older data.
 */
async function runDuplicateAnalysis(options = {}) {
  if (!duplicateConfig.enabled) return;

  try {
    const radius = duplicateConfig.background.radiusMeters;
    const timeWindow = duplicateConfig.background.timeWindowMinutes;
    const analysisWindow = options.extendedWindowMinutes ?? timeWindow;

    const reports = await getRecentReportsToAnalyze(analysisWindow);
    if (reports.length === 0) return;

    let linked = 0;
    const flagThreshold = duplicateConfig.realTime.flagThreshold;

    // Only flag for review; never auto-link. Dispatcher verifies and marks as duplicate manually.
    for (const report of reports) {
      const duplicates = await findPotentialDuplicates(report, radius, timeWindow);
      for (const dup of duplicates) {
        if (dup.confidence < flagThreshold) continue;
        const dupCheck = await pool.query('SELECT flagged_for_review FROM incident_reports WHERE report_id = $1', [dup.report_id]);
        if (dupCheck.rows[0]?.flagged_for_review) continue;
        await pool.query('UPDATE incident_reports SET flagged_for_review = TRUE WHERE report_id = $1', [dup.report_id]);
        linked++;
      }
      const reportCheck = await pool.query('SELECT flagged_for_review FROM incident_reports WHERE report_id = $1', [report.report_id]);
      if (duplicates.some((d) => d.confidence >= flagThreshold) && !reportCheck.rows[0]?.flagged_for_review) {
        await pool.query('UPDATE incident_reports SET flagged_for_review = TRUE WHERE report_id = $1', [report.report_id]);
        linked++;
      }
    }

    if (linked > 0) {
      console.log(`[DuplicateAnalyzer] Flagged ${linked} report(s) for possible duplicate review`);
    }
  } catch (err) {
    console.error('[DuplicateAnalyzer] Error:', err.message);
  }
}

/**
 * Start the background analyzer cron job
 */
function startDuplicateAnalyzer() {
  if (!duplicateConfig.enabled) {
    console.log('[DuplicateAnalyzer] Disabled via DUPLICATE_DETECTION_ENABLED');
    return null;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error('[DuplicateAnalyzer] Invalid cron schedule');
    return null;
  }

  const task = cron.schedule(CRON_SCHEDULE, runDuplicateAnalysis, {
    scheduled: true,
    timezone: 'Asia/Manila',
  });

  console.log('[DuplicateAnalyzer] Started (every 2 minutes)');
  return task;
}

module.exports = {
  startDuplicateAnalyzer,
  runDuplicateAnalysis,
};
