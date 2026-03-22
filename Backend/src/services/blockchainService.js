/**
 * Blockchain Service Integration
 * Communicates with RescueLink Blockchain FastAPI service to persist finalized incidents on Ganache.
 */

const axios = require('axios');
require('dotenv').config();

const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:8001';
const REQUEST_TIMEOUT = 15000;

/**
 * Record finalized incident hash on blockchain.
 * @param {number} reportId - Incident report ID
 * @param {Object} incidentData - Incident payload (type, severity, location, etc.)
 * @returns {Promise<{ hash_value: string, tx_hash: string, block_number: number, gas_used?: number, effective_gas_price?: string, gas_cost_wei?: string, already_recorded?: boolean }>}
 */
const verifyIncidentOnBlockchain = async (reportId, incidentData, options = {}) => {
  const requestId = options.requestId || null;
  const startTime = Date.now();
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
    console.log(`[backend][blockchain][verify] request_id=${requestId || 'none'} report_id=${reportId} status=${response.status} latency_ms=${Date.now() - startTime}`);
    return {
      hash_value: response.data.hash_value,
      tx_hash: response.data.tx_hash,
      block_number: response.data.block_number,
      gas_used: response.data.gas_used,
      effective_gas_price: response.data.effective_gas_price,
      gas_cost_wei: response.data.gas_cost_wei,
      already_recorded: Boolean(response.data.already_recorded)
    };
  } catch (error) {
    console.error(`[backend][blockchain][verify] request_id=${requestId || 'none'} report_id=${reportId} status=error latency_ms=${Date.now() - startTime} error=${error.message}`);
    if (error.response) {
      const msg = error.response.data?.detail || error.response.statusText;
      throw new Error(`Blockchain service error: ${msg}`);
    }
    throw new Error(`Blockchain service unavailable: ${error.message}`);
  }
};

/**
 * Check if blockchain service is available.
 * @returns {Promise<boolean>}
 */
const checkBlockchainHealth = async () => {
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
  checkBlockchainHealth
};
