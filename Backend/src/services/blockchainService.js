/**
 * Blockchain Service Integration
 * Communicates with RescueLink Blockchain FastAPI service to persist finalized incidents on Ganache.
 *
 * Feature flag: USE_BLOCKCHAIN (Backend/.env)
 *   - true  → calls the Ganache blockchain service (default production behavior)
 *   - false → returns a synthetic audit-trail result using a UUID (no blockchain call)
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Read once at startup so the flag value is stable for the process lifetime.
const USE_BLOCKCHAIN = process.env.USE_BLOCKCHAIN === 'true';
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:8001';
const REQUEST_TIMEOUT = 15000;

/**
 * Record finalized incident hash on blockchain (or audit trail when blockchain is disabled).
 *
 * @param {number} reportId - Incident report ID
 * @param {Object} incidentData - Incident payload (type, severity, location, etc.)
 * @param {Object} [options]
 * @param {string} [options.requestId]
 * @returns {Promise<{
 *   hash_value: string,
 *   tx_hash: string|null,
 *   block_number: number|null,
 *   gas_used?: number|null,
 *   effective_gas_price?: string|null,
 *   gas_cost_wei?: string|null,
 *   already_recorded?: boolean,
 *   blockchain_disabled?: boolean
 * }>}
 */
const verifyIncidentOnBlockchain = async (reportId, incidentData, options = {}) => {
  const requestId = options.requestId || null;
  const startTime = Date.now();

  // ── Blockchain disabled: return synthetic audit-trail result ──────────────
  if (!USE_BLOCKCHAIN) {
    const auditId = crypto.randomUUID();
    console.log(
      `[backend][blockchain][disabled] request_id=${requestId || 'none'} report_id=${reportId}` +
      ` fallback_audit_id=${auditId} latency_ms=${Date.now() - startTime}`
    );
    return {
      hash_value: auditId,
      tx_hash: null,
      block_number: null,
      gas_used: null,
      effective_gas_price: null,
      gas_cost_wei: null,
      already_recorded: false,
      blockchain_disabled: true,
    };
  }

  // ── Blockchain enabled: call the Ganache FastAPI service ──────────────────
  try {
    const response = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/verify-incident`,
      { report_id: reportId, incident_data: incidentData },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(requestId ? { 'x-request-id': requestId } : {})
        },
        timeout: REQUEST_TIMEOUT
      }
    );
    console.log(
      `[backend][blockchain][verify] request_id=${requestId || 'none'} report_id=${reportId}` +
      ` status=${response.status} latency_ms=${Date.now() - startTime}`
    );
    return {
      hash_value: response.data.hash_value,
      tx_hash: response.data.tx_hash,
      block_number: response.data.block_number,
      gas_used: response.data.gas_used,
      effective_gas_price: response.data.effective_gas_price,
      gas_cost_wei: response.data.gas_cost_wei,
      already_recorded: Boolean(response.data.already_recorded),
      blockchain_disabled: false,
    };
  } catch (error) {
    console.error(
      `[backend][blockchain][verify] request_id=${requestId || 'none'} report_id=${reportId}` +
      ` status=error latency_ms=${Date.now() - startTime} error=${error.message}`
    );
    if (error.response) {
      const msg = error.response.data?.detail || error.response.statusText;
      throw new Error(`Blockchain service error: ${msg}`);
    }
    throw new Error(`Blockchain service unavailable: ${error.message}`);
  }
};

/**
 * Check if blockchain service is available.
 * Returns false immediately when USE_BLOCKCHAIN is disabled.
 * @returns {Promise<boolean>}
 */
const checkBlockchainHealth = async () => {
  if (!USE_BLOCKCHAIN) return false;
  try {
    const response = await axios.get(`${BLOCKCHAIN_SERVICE_URL}/health`, {
      timeout: 5000
    });
    return response.status === 200 && response.data.ganache_connected;
  } catch (error) {
    return false;
  }
};

module.exports = {
  verifyIncidentOnBlockchain,
  checkBlockchainHealth,
  /** Expose flag so callers can branch without re-reading env */
  USE_BLOCKCHAIN,
};
