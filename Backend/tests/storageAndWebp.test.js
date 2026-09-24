const { compressPhoto } = require('../src/services/mediaCompressionService');
const { writeObject, readObject, removeObject, isConfigured } = require('../src/services/storageService');

describe('compressPhoto', () => {
  test('converts jpeg buffer to webp under 1MB', async () => {
    const sharp = require('sharp');
    const jpeg = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 20, g: 80, b: 160 } },
    }).jpeg().toBuffer();

    const result = await compressPhoto(jpeg, 'shot.jpg');
    expect(result.outputExt).toBe('.webp');
    expect(result.buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(result.buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(result.size).toBeLessThanOrEqual(1048576);
  });
});

describe('storageService disk fallback', () => {
  const key = `incidents/test/${Date.now()}.bin`;

  afterAll(async () => {
    await removeObject(key);
  });

  test('write/read/remove without Storage env', async () => {
    expect(isConfigured()).toBe(false);
    const payload = Buffer.from('rescuelink-storage-check');
    await writeObject(key, payload, 'application/octet-stream');
    const got = await readObject(key);
    expect(got.equals(payload)).toBe(true);
    await removeObject(key);
    expect(await readObject(key)).toBeNull();
  });
});
