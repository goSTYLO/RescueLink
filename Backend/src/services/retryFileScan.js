/**
 * Background Upload Scan Retry Service
 * Re-processes incidents that are pending/unscanned when scanner availability changes.
 */

const cron = require('node-cron');
const Incident = require('../models/incident');
const { performDeepScan } = require('./fileScanService');
const { quarantineIncidentFiles } = require('../utils/fileValidation');
const pool = require('../config/db');
require('dotenv').config();

const FILE_SCAN_RETRY_CRON = process.env.FILE_SCAN_RETRY_CRON || '*/10 * * * *';
const FILE_SCAN_MAX_BATCH = parseInt(process.env.FILE_SCAN_MAX_BATCH || '30', 10);

const processPendingScan = async (incident) => {
  const mediaPaths = Array.isArray(incident.media_paths) ? incident.media_paths : [];
  const filePaths = [incident.audio_path, ...mediaPaths].filter(Boolean);

  const result = await performDeepScan({ filePaths });

  if (result.status === 'quarantined') {
    const moved = await quarantineIncidentFiles({
      reportId: incident.report_id,
      audioPath: incident.audio_path,
      mediaPaths,
    });

    await pool.query(
      `UPDATE incident_reports
       SET audio_path = $1,
           media_paths = $2
       WHERE report_id = $3`,
      [moved.audioPath, JSON.stringify(moved.mediaPaths), incident.report_id]
    );

    await Incident.updateScanStatus(incident.report_id, {
      scan_status: 'quarantined',
      scan_engine: result.engine,
      scan_error: result.scan_error,
      scanned_at: result.scanned_at ? new Date(result.scanned_at) : new Date(),
      quarantined: true,
      quarantine_reason: 'threat_detected',
    });

    return { reportId: incident.report_id, status: 'quarantined' };
  }

  await Incident.updateScanStatus(incident.report_id, {
    scan_status: result.status,
    scan_engine: result.engine,
    scan_error: result.scan_error,
    scanned_at: result.scanned_at ? new Date(result.scanned_at) : null,
    quarantined: false,
    quarantine_reason: null,
  });

  return { reportId: incident.report_id, status: result.status };
};

const runFileScanRetryJob = async () => {
  try {
    const pending = await Incident.getPendingFileScans(FILE_SCAN_MAX_BATCH);
    if (pending.length === 0) {
      return;
    }

    console.log(`🛡️ File scan retry: processing ${pending.length} incident(s)`);

    for (const incident of pending) {
      try {
        const processed = await processPendingScan(incident);
        console.log(`✅ File scan updated for incident ${processed.reportId}: ${processed.status}`);
      } catch (error) {
        console.error(`❌ File scan retry failed for ${incident.report_id}:`, error.message);
        await Incident.updateScanStatus(incident.report_id, {
          scan_status: 'error',
          scan_engine: 'retry-worker',
          scan_error: error.message,
          scanned_at: null,
          quarantined: false,
          quarantine_reason: null,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('❌ Error in file scan retry job:', error.message);
  }
};

const startFileScanRetryService = () => {
  if (!cron.validate(FILE_SCAN_RETRY_CRON)) {
    console.error(`❌ Invalid FILE_SCAN_RETRY_CRON: ${FILE_SCAN_RETRY_CRON}`);
    return null;
  }

  console.log(`⏰ Starting file scan retry service on schedule: ${FILE_SCAN_RETRY_CRON}`);
  const task = cron.schedule(FILE_SCAN_RETRY_CRON, runFileScanRetryJob, {
    scheduled: true,
    timezone: 'Asia/Manila',
  });

  setTimeout(runFileScanRetryJob, 7000);
  return task;
};

const stopFileScanRetryService = (task) => {
  if (task) {
    task.stop();
  }
};

module.exports = {
  startFileScanRetryService,
  stopFileScanRetryService,
  runFileScanRetryJob,
};
