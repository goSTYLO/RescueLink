#!/usr/bin/env node
/**
 * Live Supabase Storage round-trip (upload → download → delete).
 * Loads Backend/.env via dotenv. Exit 0 on success, 1 on failure.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const {
  isConfigured,
  probeBucketConnection,
  probeStorageRoundTrip,
} = require('../src/services/storageService');

async function main() {
  if (!isConfigured()) {
    console.error(
      'Storage not configured: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STORAGE_BUCKET in Backend/.env',
    );
    process.exit(1);
  }

  const roundTrip = process.argv.includes('--round-trip');

  try {
    if (roundTrip) {
      const result = await probeStorageRoundTrip();
      console.log(JSON.stringify({ ...result, message: 'Supabase Storage round-trip succeeded' }));
      return;
    }
    const listProbe = await probeBucketConnection();
    if (!listProbe.ok) {
      throw new Error(listProbe.error || 'Bucket list probe failed');
    }
    console.log(JSON.stringify({ ...listProbe, message: 'Supabase Storage bucket reachable' }));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

main();
