/**
 * Background AI Classification Retry Service
 * Runs as a cron job to retry failed AI classifications
 * Schedule: Every 5 minutes (configurable via env)
 */

const cron = require('node-cron');
const Incident = require('../models/incident');
const { retryClassification } = require('./aiService');
require('dotenv').config();

// Configuration
const RETRY_CRON_SCHEDULE = process.env.RETRY_CRON_SCHEDULE || '*/5 * * * *'; // Every 5 minutes
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS, 10) || 3;

/**
 * Process a single pending incident
 */
const processPendingIncident = async (incident) => {
  const reportId = incident.report_id;
  const retryCount = incident.retry_count || 0;
  
  console.log(`🔄 Retry attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} for incident ${reportId}`);
  
  try {
    // Attempt AI classification
    const aiResult = await retryClassification(incident.audio_path);
    
    // Update incident with AI results
    await Incident.updateWithAiResults(reportId, {
      incident_type: aiResult.primaryType,
      severity_level: aiResult.severity,
      transcription: aiResult.transcription,
      ai_pending: false,
      ai_attempted: true
    });
    
    // Create or update AI classification record
    const existingClassification = await Incident.getClassificationByReportId(reportId);
    
    if (existingClassification) {
      // Update existing classification
      await Incident.updateClassificationRetryCount(reportId, retryCount + 1);
    } else {
      // Create new classification
      await Incident.createClassification({
        report_id: reportId,
        predicted_type: aiResult.primaryType,
        predicted_severity: aiResult.severity,
        confidence_score: aiResult.maxConfidence,
        low_confidence_flag: aiResult.lowConfidenceFlag,
        is_duplicate: false,
        is_override: false,
        retry_count: retryCount + 1
      });
    }
    
    console.log(`✅ Successfully classified incident ${reportId} on retry ${retryCount + 1}`);
    return { success: true, reportId };
    
  } catch (error) {
    console.error(`❌ Retry ${retryCount + 1} failed for incident ${reportId}:`, error.message);
    
    // Update retry count
    const existingClassification = await Incident.getClassificationByReportId(reportId);
    if (existingClassification) {
      await Incident.updateClassificationRetryCount(reportId, retryCount + 1);
    } else {
      // Create classification record with retry count
      await Incident.createClassification({
        report_id: reportId,
        predicted_type: null,
        predicted_severity: null,
        confidence_score: 0,
        low_confidence_flag: true,
        is_duplicate: false,
        is_override: false,
        retry_count: retryCount + 1
      });
    }
    
    // If max retries reached, mark as no longer pending
    if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
      await Incident.markAiPending(reportId, false);
      console.log(`⚠️ Max retries reached for incident ${reportId}, marked as complete (manual review required)`);
    }
    
    return { success: false, reportId, error: error.message };
  }
};

/**
 * Main retry job function
 * Processes all pending AI classifications
 */
const runRetryJob = async () => {
  try {
    console.log('\n🔄 Starting AI classification retry job...');
    const startTime = Date.now();
    
    // Get all pending incidents
    const pendingIncidents = await Incident.getPendingAiClassifications(50);
    
    if (pendingIncidents.length === 0) {
      console.log('✅ No pending AI classifications to retry');
      return;
    }
    
    console.log(`📋 Found ${pendingIncidents.length} incident(s) pending AI classification`);
    
    const results = {
      total: pendingIncidents.length,
      succeeded: 0,
      failed: 0,
      maxRetriesReached: 0
    };
    
    // Process each incident sequentially (to avoid overwhelming AI service)
    for (const incident of pendingIncidents) {
      const result = await processPendingIncident(incident);
      
      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
        
        const retryCount = incident.retry_count || 0;
        if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
          results.maxRetriesReached++;
        }
      }
      
      // Add small delay between requests (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 Retry job completed:');
    console.log(`   - Total processed: ${results.total}`);
    console.log(`   - Succeeded: ${results.succeeded}`);
    console.log(`   - Failed: ${results.failed}`);
    console.log(`   - Max retries reached: ${results.maxRetriesReached}`);
    console.log(`   - Duration: ${duration}s\n`);
    
  } catch (error) {
    console.error('❌ Error in retry job:', error);
  }
};

/**
 * Start the cron job
 */
const startRetryService = () => {
  console.log(`⏰ Starting AI classification retry service...`);
  console.log(`   - Schedule: ${RETRY_CRON_SCHEDULE}`);
  console.log(`   - Max retry attempts: ${MAX_RETRY_ATTEMPTS}`);
  
  // Validate cron schedule
  if (!cron.validate(RETRY_CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron schedule: ${RETRY_CRON_SCHEDULE}`);
    return null;
  }
  
  // Create cron job
  const task = cron.schedule(RETRY_CRON_SCHEDULE, async () => {
    await runRetryJob();
  }, {
    scheduled: true,
    timezone: 'Asia/Manila' // Adjust to your timezone
  });
  
  console.log(`✅ Retry service started successfully`);
  
  // Run immediately on startup (optional)
  setTimeout(async () => {
    console.log('🚀 Running initial retry job...');
    await runRetryJob();
  }, 5000); // Wait 5 seconds after server start
  
  return task;
};

/**
 * Stop the retry service
 */
const stopRetryService = (task) => {
  if (task) {
    task.stop();
    console.log('🛑 Retry service stopped');
  }
};

/**
 * Manual trigger for testing
 */
const manualRetry = async () => {
  console.log('🔧 Manual retry triggered');
  await runRetryJob();
};

module.exports = {
  startRetryService,
  stopRetryService,
  runRetryJob,
  manualRetry
};
