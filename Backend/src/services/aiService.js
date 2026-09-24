/**
 * AI Service Integration Layer
 * Handles communication with RescueLink AI module
 * Endpoints: http://localhost:8000/v1/classify-audio, /v1/transcribe
 */

const axios = require('axios');
const FormData = require('form-data');
const { normalizeAiIncidentTypes } = require('../utils/incidentTypeNormalize');
require('dotenv').config();

// Configuration. Render fromService injects hostport (no scheme); local uses a full URL.
const rawAiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_URL = /^https?:\/\//i.test(rawAiServiceUrl)
  ? rawAiServiceUrl.replace(/\/+$/, '')
  : `http://${String(rawAiServiceUrl).replace(/\/+$/, '')}`;
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || null;
const AI_CONFIDENCE_THRESHOLD = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.3;
const AI_LOW_CONFIDENCE_THRESHOLD = parseFloat(process.env.AI_LOW_CONFIDENCE_THRESHOLD) || 0.7;
const AI_REQUEST_TIMEOUT = 60000; // 60 seconds
const AI_CIRCUIT_FAILURE_THRESHOLD = parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD || '3', 10);
const AI_CIRCUIT_RESET_MS = parseInt(process.env.AI_CIRCUIT_RESET_MS || '30000', 10);
const AI_HEALTH_PRECHECK_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.AI_HEALTH_PRECHECK_ENABLED || 'false').toLowerCase());

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

/**
 * Severity mapping from AI output to database format
 * AI Output: "Red", "Yellow", "Green", "Black"
 * Database: "high", "medium", "low"
 */
const SEVERITY_MAP = {
  Red: 'high',
  Yellow: 'medium',
  Green: 'low',
  Black: 'high' // Black (deceased) mapped to high severity
};

const buildAuthHeaders = (headers = {}, requestId = null) => ({
  ...headers,
  ...(requestId ? { 'x-request-id': requestId } : {}),
  ...(AI_SERVICE_TOKEN ? { 'x-ai-service-token': AI_SERVICE_TOKEN } : {})
});

const isCircuitOpen = () => Date.now() < circuitOpenUntil;

const markFailure = () => {
  consecutiveFailures += 1;
  if (consecutiveFailures >= AI_CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + AI_CIRCUIT_RESET_MS;
    console.error(`🚫 AI circuit opened for ${AI_CIRCUIT_RESET_MS}ms after ${consecutiveFailures} failures`);
  }
};

const markSuccess = () => {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
};

const guardedRequest = async (requestFn) => {
  if (isCircuitOpen()) {
    throw new Error('AI circuit is open due to recent failures');
  }

  try {
    const result = await requestFn();
    markSuccess();
    return result;
  } catch (error) {
    markFailure();
    throw error;
  }
};

const normalizeConfidence = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numeric = Number(value);
  return numeric <= 1 ? numeric : numeric / 100;
};

const resolveConfidenceForType = (type, confidenceScores) => {
  if (!type || !confidenceScores || typeof confidenceScores !== 'object') return null;
  if (confidenceScores[type] != null) {
    return normalizeConfidence(confidenceScores[type]);
  }
  const matchedKey = Object.keys(confidenceScores).find(
    (key) => String(key).trim().toLowerCase() === String(type).trim().toLowerCase()
  );
  return matchedKey ? normalizeConfidence(confidenceScores[matchedKey]) : null;
};

const mapAiClassificationResult = (result, extras = {}) => {
  const confidenceScores = result.confidence_scores || {};
  const maxConfidence = Math.max(
    ...Object.values(confidenceScores),
    Number(result.max_confidence) || 0,
    0,
  );
  const incidentTypes = normalizeAiIncidentTypes(result.incident_types || []);
  const primaryType = incidentTypes[0] || null;
  const secondaryType = incidentTypes[1] || null;
  const mappedSeverity = SEVERITY_MAP[result.severity] || 'medium';
  const primaryConfidence = resolveConfidenceForType(primaryType, confidenceScores)
    ?? normalizeConfidence(result.primary_confidence)
    ?? maxConfidence;
  const lowConfidenceFlag = maxConfidence < AI_LOW_CONFIDENCE_THRESHOLD
    || Boolean(result.fallback_used);

  return {
    transcription: result.transcription || null,
    incidentTypes,
    severity: mappedSeverity,
    severityRaw: result.severity,
    confidenceScores,
    maxConfidence,
    primaryConfidence,
    sttConfidence: normalizeConfidence(result.stt_confidence),
    fallbackUsed: Boolean(result.fallback_used),
    fallbackReason: result.fallback_reason || null,
    lowConfidenceFlag,
    primaryType,
    secondaryType,
    secondaryConfidence: resolveConfidenceForType(secondaryType, confidenceScores),
    keywordPromoted: Boolean(result.keyword_promoted),
    ...extras,
  };
};

/**
 * Check if AI service is available
 * @returns {Promise<boolean>}
 */
const checkAiHealth = async (requestId = null) => {
  const startTime = Date.now();
  try {
    const response = await guardedRequest(() => axios.get(`${AI_SERVICE_URL}/health`, {
      headers: buildAuthHeaders({}, requestId),
      timeout: 5000
    }));
    console.log(`[backend][ai][health] request_id=${requestId || 'none'} status=${response.status} latency_ms=${Date.now() - startTime}`);
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    console.error(`[backend][ai][health] request_id=${requestId || 'none'} status=error latency_ms=${Date.now() - startTime} error=${error.message}`);
    return false;
  }
};

/**
 * Transcribe audio file using Whisper AI
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} { transcription, duration, confidence, language }
 */
const transcribeAudio = async (audioBuffer, filename, requestId = null) => {
  const startTime = Date.now();
  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename }); // FastAPI expects 'file', not 'audio'
    
    const response = await guardedRequest(() => axios.post(
      `${AI_SERVICE_URL}/v1/transcribe`,
      formData,
      {
        headers: buildAuthHeaders(formData.getHeaders()),
        timeout: AI_REQUEST_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    ));
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    return {
      transcription: response.data.transcription,
      duration: response.data.duration,
      confidence: response.data.confidence,
      language: response.data.language,
      latency: response.data.latency
    };
  } catch (error) {
    console.error(`[backend][ai][transcribe] request_id=${requestId || 'none'} filename=${filename} status=error latency_ms=${Date.now() - startTime} error=${error.message}`);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

/**
 * Classify incident from audio (transcription + classification).
 * Expects WAV from the app (no server-side conversion).
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename (e.g. recording.wav)
 * @returns {Promise<Object>} Classification result
 */
const classifyAudio = async (audioBuffer, filename, requestId = null) => {
  const startTime = Date.now();
  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename });
    
    const response = await guardedRequest(() => axios.post(
      `${AI_SERVICE_URL}/v1/classify-audio`,
      formData,
      {
        headers: buildAuthHeaders(formData.getHeaders(), requestId),
        timeout: AI_REQUEST_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    ));
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    const result = response.data;

    const resultPayload = mapAiClassificationResult(result, {
      duration: result.duration,
      language: result.language,
      latency: result.latency,
    });
    console.log(`[backend][ai][classify] request_id=${requestId || 'none'} filename=${filename} status=success latency_ms=${Date.now() - startTime} severity=${resultPayload.severity} types=${(resultPayload.incidentTypes || []).join(',') || 'none'} low_confidence=${resultPayload.lowConfidenceFlag}`);
    return resultPayload;
  } catch (error) {
    console.error(`[backend][ai][classify] request_id=${requestId || 'none'} filename=${filename} status=error latency_ms=${Date.now() - startTime} error=${error.message}`);
    throw new Error(`Classification failed: ${error.message}`);
  }
};

/**
 * Classify text description (for incidents without audio)
 * @param {string} text - Incident description text
 * @returns {Promise<Object>} Classification result
 */
const classifyText = async (text) => {
  try {
    const response = await guardedRequest(() => axios.post(
      `${AI_SERVICE_URL}/classify`,
      { text },
      {
        headers: buildAuthHeaders({
          'Content-Type': 'application/json',
        }),
        timeout: AI_REQUEST_TIMEOUT
      }
    ));
    
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    
    const result = response.data;
    return mapAiClassificationResult(result);
  } catch (error) {
    console.error('❌ Text classification failed:', error.message);
    throw new Error(`Classification failed: ${error.message}`);
  }
};

/**
 * Process incident with audio and optional text description
 * Main integration function used by controllers
 * 
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @param {string} description - Optional text description
 * @returns {Promise<Object>} Complete classification result
 */
const processIncidentWithAudio = async (audioBuffer, filename, description = null, options = {}) => {
  const requestId = options.requestId || null;
  const startTime = Date.now();
  try {
    console.log(`[backend][ai][process] request_id=${requestId || 'none'} filename=${filename} status=start`);
    
    if (AI_HEALTH_PRECHECK_ENABLED) {
      const isHealthy = await checkAiHealth(requestId);
      if (!isHealthy) {
        throw new Error('AI service is unavailable');
      }
    }
    
    // Classify audio (includes transcription)
    const aiResult = await classifyAudio(audioBuffer, filename, requestId);
    
    console.log(`[backend][ai][process] request_id=${requestId || 'none'} status=success latency_ms=${Date.now() - startTime} primary_type=${aiResult.primaryType || 'unknown'} severity=${aiResult.severity}`);
    
    return aiResult;
  } catch (error) {
    console.error(`[backend][ai][process] request_id=${requestId || 'none'} status=error latency_ms=${Date.now() - startTime} error=${error.message}`);
    
    // Return null to indicate AI processing should be retried later
    throw error;
  }
};

/**
 * Retry failed classification for an incident
 * Used by background retry service
 * 
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Classification result
 */
const retryClassification = async (audioPath) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Read audio file from disk
    const fullPath = path.join(process.cwd(), audioPath);
    const audioBuffer = await fs.readFile(fullPath);
    const filename = path.basename(audioPath);
    
    console.log(`🔄 Retrying classification for: ${audioPath}`);
    
    // Attempt classification
    return await processIncidentWithAudio(audioBuffer, filename, null, { requestId: `retry-${Date.now()}` });
  } catch (error) {
    console.error(`❌ Retry failed for ${audioPath}:`, error.message);
    throw error;
  }
};

module.exports = {
  checkAiHealth,
  transcribeAudio,
  classifyAudio,
  classifyText,
  processIncidentWithAudio,
  retryClassification,
  SEVERITY_MAP,
  AI_CONFIDENCE_THRESHOLD,
  AI_LOW_CONFIDENCE_THRESHOLD,
  _internal: {
    buildAuthHeaders,
    guardedRequest,
    markFailure,
    markSuccess,
    isCircuitOpen,
    mapAiClassificationResult,
    normalizeConfidence,
    resolveConfidenceForType,
  }
};
