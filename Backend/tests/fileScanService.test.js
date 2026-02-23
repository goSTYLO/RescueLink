const { runUploadSecurityChecks } = require('../src/services/fileScanService');

const makeFile = (name, bytes) => ({
  originalname: name,
  buffer: Buffer.from(bytes),
});

describe('fileScanService quick checks', () => {
  it('accepts clean image/audio signatures', () => {
    const result = runUploadSecurityChecks({
      audio: [makeFile('sample.wav', [0x52, 0x49, 0x46, 0x46, 0x00])],
      media: [makeFile('img.jpg', [0xff, 0xd8, 0xff, 0xe0, 0x00])],
    });

    expect(result.quick.status).toBe('clean');
    expect(Array.isArray(result.quick.findings)).toBe(true);
  });

  it('blocks executable signatures regardless of extension', () => {
    const result = runUploadSecurityChecks({
      media: [makeFile('photo.jpg', [0x4d, 0x5a, 0x00, 0x00])], // MZ
    });

    expect(result.quick.status).toBe('blocked');
    expect(result.quick.findings[0].type).toBe('blocked_signature');
  });

  it('blocks signature mismatch for fake jpg', () => {
    const result = runUploadSecurityChecks({
      media: [makeFile('photo.jpg', [0x89, 0x50, 0x4e, 0x47])], // PNG signature with jpg extension
    });

    expect(result.quick.status).toBe('blocked');
    expect(result.quick.findings[0].type).toBe('signature_mismatch');
  });
});
