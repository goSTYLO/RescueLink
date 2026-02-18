const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const axios = require('axios');
const Web3 = require('web3');
const { expect } = require('chai');

const GANACHE_URL = process.env.GANACHE_URL || 'http://127.0.0.1:7545';
const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:8001';

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

describe('Blockchain FastAPI connection', function () {
  this.timeout(60000);

  it('should report Ganache connected via /health', async function () {
    const res = await axios.get(`${BLOCKCHAIN_SERVICE_URL}/health`, { timeout: 10000 });
    expect(res.status).to.equal(200);
    expect(res.data).to.have.property('ganache_connected');
    expect(res.data.ganache_connected).to.equal(true);
  });

  it('should POST to /verify-incident and find the tx receipt on Ganache', async function () {
    const reportId = Math.floor(Date.now() / 1000);
    const incidentData = {
      report_id: reportId,
      description: 'Automated test incident',
      latitude: 16.0,
      longitude: 120.0,
      timestamp: new Date().toISOString()
    };

    const postRes = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/verify-incident`,
      { report_id: reportId, incident_data: incidentData },
      { timeout: 30000 }
    );

    expect(postRes.status).to.equal(200);
    expect(postRes.data).to.have.property('hash_value');
    expect(postRes.data).to.have.property('tx_hash');
    expect(postRes.data).to.have.property('block_number');

    // log response to help debugging when receipts are not found
    console.log('verify-incident response:', JSON.stringify(postRes.data, null, 2));

    const txHashRaw = postRes.data.tx_hash;
    const txHash = txHashRaw.startsWith('0x') ? txHashRaw : `0x${txHashRaw}`;
    const expectedBlock = postRes.data.block_number;

    const web3 = new Web3(GANACHE_URL);

    let receipt = null;
    // poll for receipt up to ~10s
    for (let i = 0; i < 20; i++) {
      receipt = await web3.eth.getTransactionReceipt(txHash).catch(() => null);
      if (receipt) break;
      await sleep(500);
    }

    expect(receipt, `Transaction receipt for ${txHash} not found`).to.not.equal(null);
    expect(receipt).to.have.property('blockNumber');
    // If service returned block_number, compare when available
    if (expectedBlock !== undefined && expectedBlock !== null) {
      expect(receipt.blockNumber).to.equal(expectedBlock);
    }
  });
});
