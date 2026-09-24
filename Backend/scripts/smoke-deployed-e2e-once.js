#!/usr/bin/env node
/**
 * One-shot deployed smoke: login + POST /api/incidents/with-audio.
 * Usage (from Backend/):
 *   set API_BASE_URL=https://resquelink-backend.onrender.com
 *   node scripts/smoke-deployed-e2e-once.js
 */
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.API_BASE_URL || 'https://resquelink-backend.onrender.com').replace(/\/+$/, '');
const PHONE = process.env.SMOKE_TEST_PHONE || '09005000001';
const PASSWORD = process.env.SMOKE_TEST_PASSWORD || 'user123';
const REPO_ROOT = path.join(__dirname, '..', '..');
const AUDIO_CANDIDATES = [
  path.join(REPO_ROOT, 'RescueLink AI', 'test', 'test_report_1.m4a'),
  path.join(REPO_ROOT, 'RescueLink AI', 'test_audio_45sec.wav'),
];

function findAudio() {
  for (const p of AUDIO_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No audio sample found for smoke test');
}

async function main() {
  const login = await axios.post(`${API_BASE}/api/auth/login`, {
    phone: PHONE,
    password: PASSWORD,
  });
  const token = login.data?.token;
  if (!token) {
    console.error('Login failed:', login.data);
    process.exit(1);
  }
  console.log('Login OK');

  const audioPath = findAudio();
  const form = new FormData();
  form.append('latitude', '16.0433');
  form.append('longitude', '120.3333');
  form.append('location_description', 'Deploy smoke test — Dagupan City');
  form.append('description', 'Automated deployed AI integration smoke test');
  form.append('audio', fs.createReadStream(audioPath), path.basename(audioPath));

  const started = Date.now();
  const upload = await axios.post(`${API_BASE}/api/incidents/with-audio`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
    validateStatus: () => true,
  });

  console.log(`with-audio status=${upload.status} latency_ms=${Date.now() - started}`);
  const body = upload.data;
  const reportId = body?.incident?.report_id;
  const ai = body?.ai_classification;
  const pending = body?.ai_pending;

  if (reportId) console.log('report_id', reportId);
  if (ai) {
    console.log('ai_classification', JSON.stringify({
      incident_types: ai.incident_types,
      severity: ai.severity,
      primary_type: ai.primary_type,
      confidence: ai.confidence,
    }));
  } else {
    console.log('ai_classification missing; ai_pending=', pending);
    console.log(JSON.stringify(body, null, 2).slice(0, 2000));
  }

  const pass = upload.status >= 200 && upload.status < 300 && reportId && ai && !pending;
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
