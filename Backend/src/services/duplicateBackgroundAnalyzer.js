/**
 * Background Duplicate Detection Analyzer
 * Runs every 2 minutes to cluster duplicates that real-time may have missed
 */

const cron = require('node-cron');
const pool = require('../config/db');
const duplicateConfig = require('../config/duplicateDetection');
const {
  findPotentialDuplicates,
  linkAsDuplicate,
  getPrimaryReportId,
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
 */
async function runDuplicateAnalysis() {
  if (!duplicateConfig.enabled) return;

  try {
    const radius = duplicateConfig.background.radiusMeters;
    const timeWindow = duplicateConfig.background.timeWindowMinutes;
    const minClusterSize = duplicateConfig.background.minClusterSize;
    const autoLinkThreshold = duplicateConfig.realTime.autoLinkThreshold;

    const reports = await getRecentReportsToAnalyze(timeWindow);
    if (reports.length === 0) return;

    let linked = 0;

    for (const report of reports) {
      const duplicates = await findPotentialDuplicates(report, radius, timeWindow);
      const best = duplicates[0];
      if (best && best.confidence >= autoLinkThreshold) {
        const primaryId = await getPrimaryReportId(best.report_id);
        if (primaryId !== report.report_id) {
          await linkAsDuplicate(report.report_id, primaryId, best.confidence, 'background_analysis');
          linked++;
        }
      }
    }

    if (linked > 0) {
      console.log(`[DuplicateAnalyzer] Linked ${linked} report(s) as duplicates`);
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
