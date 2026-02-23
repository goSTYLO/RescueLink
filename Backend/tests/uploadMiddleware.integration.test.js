const express = require('express');
const request = require('supertest');

const loadApp = ({ failOpen = true, scannerAvailable = false, engine = 'clamav' } = {}) => {
  jest.resetModules();
  process.env.FILE_SCAN_FAIL_OPEN = failOpen ? 'true' : 'false';
  process.env.FILE_SCANNER_AVAILABLE = scannerAvailable ? 'true' : 'false';
  process.env.FILE_DEEP_SCAN_ENGINE = engine;
  process.env.FILE_DEEP_SCAN_ENABLED = 'true';

  const { uploadMiddleware } = require('../src/middleware/fileUpload');
  const app = express();
  app.post('/upload', uploadMiddleware, (req, res) => {
    res.status(200).json({
      success: true,
      uploadSecurity: req.uploadSecurity || null,
    });
  });

  return app;
};

describe('upload middleware integration', () => {
  afterEach(() => {
    delete process.env.FILE_SCAN_FAIL_OPEN;
    delete process.env.FILE_SCANNER_AVAILABLE;
    delete process.env.FILE_DEEP_SCAN_ENGINE;
    delete process.env.FILE_DEEP_SCAN_ENABLED;
  });

  it('accepts clean upload and attaches security metadata', async () => {
    const app = loadApp({ failOpen: true, scannerAvailable: false });

    const res = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00]), 'sample.wav');

    expect(res.status).toBe(200);
    expect(res.body.uploadSecurity.quick.status).toBe('clean');
  });

  it('rejects blocked signature upload', async () => {
    const app = loadApp({ failOpen: true, scannerAvailable: false });

    const res = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00]), 'sample.wav')
      .attach('media', Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'photo.jpg');

    expect(res.status).toBe(400);
    expect(res.body.scan.quick.status).toBe('blocked');
  });

  it('rejects extension-signature mismatch upload', async () => {
    const app = loadApp({ failOpen: true, scannerAvailable: false });

    const res = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00]), 'sample.wav')
      .attach('media', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'photo.jpg');

    expect(res.status).toBe(400);
    expect(res.body.scan.quick.findings[0].type).toBe('signature_mismatch');
  });

  it('accepts upload in fail-open mode when scanner unavailable', async () => {
    const app = loadApp({ failOpen: true, scannerAvailable: false, engine: 'clamav' });

    const res = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00]), 'sample.wav');

    expect(res.status).toBe(200);
    expect(res.body.uploadSecurity.requires_follow_up).toBe(true);
    expect(res.body.uploadSecurity.deep.status).toBe('unavailable');
  });
});
