/**
 * Live Supabase Storage checks. Skips when SUPABASE_SERVICE_ROLE_KEY is unset (CI / disk-only dev).
 * Run: pnpm test -- tests/storageIntegration.test.js
 * Full write test: STORAGE_INTEGRATION_ROUNDTRIP=1 pnpm test -- tests/storageIntegration.test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const {
  isConfigured,
  probeBucketConnection,
  probeStorageRoundTrip,
} = require('../src/services/storageService');

const describeIfConfigured = isConfigured() ? describe : describe.skip;

describeIfConfigured('storageService Supabase integration', () => {
  test('probeBucketConnection lists bucket', async () => {
    const result = await probeBucketConnection();
    expect(result.configured).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.bucket).toBe(process.env.STORAGE_BUCKET || 'rescuelink-media');
  });

  const roundTrip = process.env.STORAGE_INTEGRATION_ROUNDTRIP === '1' ? test : test.skip;
  roundTrip('probeStorageRoundTrip upload/download/delete', async () => {
    const result = await probeStorageRoundTrip();
    expect(result.ok).toBe(true);
    expect(result.key).toMatch(/^_healthcheck\//);
  });
});
