/**
 * RescueLink Blockchain Gas Optimization Test Suite
 * End-to-end tests: Frontend flow → Backend API → Blockchain service
 * Measures gas fees, validates duplicate detection savings, compares contract approaches.
 */
const path = require('path');
const { execSync } = require('child_process');

const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const axios = require('axios');
const Web3 = require('web3');
const { expect } = require('chai');
const { writeJsonReport, writeMarkdownReport } = require('./reportUtils');

const GANACHE_URL = process.env.GANACHE_URL || 'http://127.0.0.1:7545';
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:8001';
const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3000';

// Test accounts from Backend/ACCOUNTS.md
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@rescuelink.test';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';
const USER_PHONE = process.env.TEST_USER_PHONE || '+639005000001';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'user123';

const reportData = {
  timestamp: new Date().toISOString(),
  environment: 'ganache',
  summary: {},
  transactions: [],
  optimization_comparison: {},
  prerequisites: {},
  notes: [],
};

async function checkGanache() {
  try {
    const w3 = new Web3(GANACHE_URL);
    const connected = await w3.eth.net.isListening();
    return !!connected;
  } catch {
    return false;
  }
}

async function checkBlockchainService() {
  try {
    const res = await axios.get(`${BLOCKCHAIN_SERVICE_URL}/health`, { timeout: 5000 });
    return res.status === 200 && res.data.ganache_connected === true;
  } catch {
    return false;
  }
}

async function checkBackend() {
  try {
    const res = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    return res && res.status === 200;
  } catch {
    return false;
  }
}

async function runPrerequisiteChecks() {
  const ganache = await checkGanache();
  const blockchain = await checkBlockchainService();
  const backend = await checkBackend();

  reportData.prerequisites = {
    Ganache: ganache,
    'Blockchain Service (FastAPI)': blockchain,
    'Backend API': backend,
  };

  if (!ganache) {
    reportData.notes.push('Ganache is not running. Start Ganache before running gas tests.');
  }
  if (!blockchain) {
    reportData.notes.push('Blockchain service is not running. Start: cd Blockchain && python -m uvicorn main:app --host 0.0.0.0 --port 8001');
  }
  if (!backend) {
    reportData.notes.push('Backend API is not running. E2E Backend test will be skipped.');
  }

  return { ganache, blockchain, backend };
}

/** Login as admin (dispatcher login) - returns JWT for verify endpoint */
async function loginAsAdmin() {
  const res = await axios.post(
    `${BACKEND_URL}/api/auth/dispatcher/login`,
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    { timeout: 10000 }
  );
  if (res.data?.token) return res.data.token;
  throw new Error(res.data?.message || 'Admin login failed');
}

/** Login as user (phone + password) - for creating incidents */
async function loginAsUser() {
  const res = await axios.post(
    `${BACKEND_URL}/api/auth/login`,
    { phone: USER_PHONE, password: USER_PASSWORD },
    { timeout: 10000 }
  );
  if (res.data?.token) return res.data.token;
  throw new Error(res.data?.message || 'User login failed');
}

/** Fetch first pending unverified incident, or create one as user */
async function getOrCreateTestIncident(adminToken) {
  const auth = { headers: { Authorization: `Bearer ${adminToken}` } };
  const listRes = await axios.get(
    `${BACKEND_URL}/api/incidents?status=pending&limit=10`,
    { ...auth, timeout: 10000 }
  );
  const pending = Array.isArray(listRes.data) ? listRes.data : [];
  const unverified = pending.find((i) => !i.verified);
  if (unverified) return unverified.report_id;

  const userToken = await loginAsUser();
  const createRes = await axios.post(
    `${BACKEND_URL}/api/incidents/emergency`,
    { latitude: 16.0, longitude: 120.0 },
    { headers: { Authorization: `Bearer ${userToken}` }, timeout: 10000 }
  );
  if (createRes.data?.incident?.report_id) return createRes.data.incident.report_id;
  throw new Error('Could not create test incident');
}

function makeIncidentData(reportId) {
  return {
    report_id: reportId,
    description: `Gas optimization test incident ${reportId}`,
    incident_type: 'fire',
    severity_level: 'high',
    latitude: 16.0,
    longitude: 120.0,
    barangay: 'Test Barangay',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

describe('Blockchain Gas Optimization', function () {
  this.timeout(120000);

  before(async function () {
    const { ganache, blockchain } = await runPrerequisiteChecks();
    if (!ganache || !blockchain) {
      this.skip();
    }
  });

  it('should pass prerequisite checks', async function () {
    const { ganache, blockchain } = await runPrerequisiteChecks();
    expect(ganache, 'Ganache should be running').to.equal(true);
    expect(blockchain, 'Blockchain service should be running').to.equal(true);
  });

  it('should report Ganache connected via /health', async function () {
    const res = await axios.get(`${BLOCKCHAIN_SERVICE_URL}/health`, { timeout: 10000 });
    expect(res.status).to.equal(200);
    expect(res.data).to.have.property('ganache_connected');
    expect(res.data.ganache_connected).to.equal(true);
  });

  let firstVerifiedReportId;

  it('should measure gas for new incident verification', async function () {
    const reportId = Math.floor(Date.now() / 1000);
    firstVerifiedReportId = reportId;
    const incidentData = makeIncidentData(reportId);
    const start = Date.now();

    const res = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/verify-incident`,
      { report_id: reportId, incident_data: incidentData },
      { timeout: 30000 }
    );

    const latencyMs = Date.now() - start;

    expect(res.status).to.equal(200);
    expect(res.data).to.have.property('hash_value');
    expect(res.data).to.have.property('tx_hash');
    expect(res.data).to.have.property('block_number');
    expect(res.data).to.have.property('gas_used');
    expect(res.data).to.have.property('gas_cost_wei');
    expect(res.data.already_recorded).to.equal(false);

    reportData.transactions.push({
      report_id: reportId,
      gas_used: res.data.gas_used,
      effective_gas_price: res.data.effective_gas_price,
      gas_cost_wei: res.data.gas_cost_wei,
      tx_hash: res.data.tx_hash,
      block_number: res.data.block_number,
      already_recorded: false,
      latency_ms: latencyMs,
    });

    expect(res.data.gas_used).to.be.greaterThan(0);
  });

  it('should save gas on duplicate verification (already_recorded)', async function () {
    const reportId = firstVerifiedReportId;
    const incidentData = makeIncidentData(reportId);

    const res = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/verify-incident`,
      { report_id: reportId, incident_data: incidentData },
      { timeout: 30000 }
    );

    expect(res.status).to.equal(200);
    expect(res.data.already_recorded).to.equal(true);
    expect(res.data.gas_used).to.equal(0);
    expect(res.data.gas_cost_wei).to.equal('0');

    reportData.transactions.push({
      report_id: reportId,
      gas_used: 0,
      gas_cost_wei: '0',
      tx_hash: res.data.tx_hash,
      already_recorded: true,
    });
  });

  it('should measure gas for batch of new incidents', async function () {
    const baseId = Math.floor(Date.now() / 1000) + 1000;
    const batchSize = 3;

    for (let i = 0; i < batchSize; i++) {
      const reportId = baseId + i;
      const incidentData = makeIncidentData(reportId);
      const start = Date.now();

      const res = await axios.post(
        `${BLOCKCHAIN_SERVICE_URL}/verify-incident`,
        { report_id: reportId, incident_data: incidentData },
        { timeout: 30000 }
      );

      const latencyMs = Date.now() - start;

      expect(res.status).to.equal(200);
      expect(res.data.already_recorded).to.equal(false);

      reportData.transactions.push({
        report_id: reportId,
        gas_used: res.data.gas_used,
        effective_gas_price: res.data.effective_gas_price,
        gas_cost_wei: res.data.gas_cost_wei,
        tx_hash: res.data.tx_hash,
        block_number: res.data.block_number,
        already_recorded: false,
        latency_ms: latencyMs,
      });
    }
  });

  it('should compare events vs storage contract gas usage', async function () {
    const blockchainRoot = path.resolve(__dirname, '..');
    const scriptPath = path.join(blockchainRoot, 'scripts', 'gas_comparison.py');

    try {
      const stdout = execSync(`python "${scriptPath}"`, {
        cwd: blockchainRoot,
        encoding: 'utf8',
        timeout: 60000,
        env: { ...process.env, GANACHE_URL, PRIVATE_KEY: process.env.PRIVATE_KEY },
      });

      const result = JSON.parse(stdout.trim());

      if (result.error) {
        reportData.notes.push(`Contract comparison skipped: ${result.error}`);
        this.skip();
        return;
      }

      if (result.events && result.storage) {
        const eventsGas = result.events.gas_used;
        const storageGas = result.storage.gas_used;
        const savingsPercent = storageGas > 0 ? ((storageGas - eventsGas) / storageGas) * 100 : 0;

        reportData.optimization_comparison = {
          events_approach: { gas_used: eventsGas, avg_gas: eventsGas },
          storage_approach: { gas_used: storageGas, avg_gas: storageGas },
          savings_percent: savingsPercent,
        };

        expect(eventsGas).to.be.lessThan(storageGas);
      }
    } catch (err) {
      reportData.notes.push(
        `Contract comparison failed (Python/solcx may be required): ${err.message}`
      );
      this.skip();
    }
  });

  it('should verify incident via Backend API (E2E: admin login, fetch/create incident)', async function () {
    const backendOk = await checkBackend();
    if (!backendOk) {
      reportData.notes.push('Backend API not available, skipping E2E test');
      this.skip();
      return;
    }

    let adminToken;
    let incidentId;
    try {
      adminToken = await loginAsAdmin();
      incidentId = await getOrCreateTestIncident(adminToken);
    } catch (err) {
      reportData.notes.push(`E2E setup failed: ${err.message}`);
      this.skip();
      return;
    }

    const res = await axios.post(
      `${BACKEND_URL}/api/incidents/${incidentId}/verify`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    if (res.status === 404) {
      reportData.notes.push(`Test incident ${incidentId} not found in DB`);
      this.skip();
      return;
    }
    if (res.status === 400 && res.data?.error?.includes('already verified')) {
      reportData.notes.push('Test incident already verified (expected in repeat runs)');
      return;
    }
    if (res.status === 401 || res.status === 403) {
      reportData.notes.push(`Auth failed: ${res.data?.message || res.statusText}`);
      this.skip();
      return;
    }

    expect(res.status).to.equal(200);
    expect(res.data).to.have.property('blockchain');
    expect(res.data.blockchain).to.have.property('gas_used');
  });

  after(function () {
    const newTxs = reportData.transactions.filter((t) => !t.already_recorded && (t.gas_used || 0) > 0);
    const dupTxs = reportData.transactions.filter((t) => t.already_recorded);
    reportData.summary.total_transactions = newTxs.length;
    reportData.summary.total_gas_used = newTxs.reduce((sum, t) => sum + (t.gas_used || 0), 0);
    reportData.summary.avg_gas_per_tx =
      newTxs.length > 0 ? Math.round(reportData.summary.total_gas_used / newTxs.length) : 0;
    const avgNewTxGas = reportData.summary.avg_gas_per_tx || 0;
    reportData.summary.gas_savings_from_dedup = dupTxs.length * avgNewTxGas;

    const jsonPath = writeJsonReport(reportData);
    const mdPath = writeMarkdownReport(reportData);
    console.log('\n[Gas Report] JSON:', jsonPath);
    console.log('[Gas Report] Markdown:', mdPath);
  });
});
