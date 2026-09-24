const makeFile = (name, bytes) => ({
  originalname: name,
  buffer: Buffer.from(bytes),
});

describe('fileScanService quick checks', () => {
  let runUploadSecurityChecks;
  let setScanBufferForTests;
  let computeInitialScanStatus;

  const loadService = ({
    failOpen = true,
    scannerAvailable = false,
    engine = 'stub',
  } = {}) => {
    jest.resetModules();
    process.env.FILE_SCAN_FAIL_OPEN = failOpen ? 'true' : 'false';
    process.env.FILE_SCANNER_AVAILABLE = scannerAvailable ? 'true' : 'false';
    process.env.FILE_DEEP_SCAN_ENGINE = engine;
    process.env.FILE_DEEP_SCAN_ENABLED = 'true';
    ({
      runUploadSecurityChecks,
      setScanBufferForTests,
      computeInitialScanStatus,
    } = require('../src/services/fileScanService'));
  };

  afterEach(() => {
    if (setScanBufferForTests) setScanBufferForTests(null);
    delete process.env.FILE_SCAN_FAIL_OPEN;
    delete process.env.FILE_SCANNER_AVAILABLE;
    delete process.env.FILE_DEEP_SCAN_ENGINE;
    delete process.env.FILE_DEEP_SCAN_ENABLED;
  });

  it('accepts clean image/audio signatures', async () => {
    loadService();
    const result = await runUploadSecurityChecks({
      audio: [makeFile('sample.wav', [0x52, 0x49, 0x46, 0x46, 0x00])],
      media: [makeFile('img.jpg', [0xff, 0xd8, 0xff, 0xe0, 0x00])],
    });

    expect(result.quick.status).toBe('clean');
    expect(Array.isArray(result.quick.findings)).toBe(true);
  });

  it('blocks executable signatures regardless of extension', async () => {
    loadService();
    const result = await runUploadSecurityChecks({
      media: [makeFile('photo.jpg', [0x4d, 0x5a, 0x00, 0x00])], // MZ
    });

    expect(result.quick.status).toBe('blocked');
    expect(result.quick.findings[0].type).toBe('blocked_signature');
  });

  it('blocks signature mismatch for fake jpg', async () => {
    loadService();
    const result = await runUploadSecurityChecks({
      media: [makeFile('photo.jpg', [0x89, 0x50, 0x4e, 0x47])], // PNG signature with jpg extension
    });

    expect(result.quick.status).toBe('blocked');
    expect(result.quick.findings[0].type).toBe('signature_mismatch');
  });

  it('blocks infected upload when ClamAV reports threat before store', async () => {
    loadService({ failOpen: false, scannerAvailable: true, engine: 'clamav' });
    setScanBufferForTests(async () => ({
      status: 'infected',
      reason: 'threat_detected',
      signature: 'Eicar-Test-Signature',
    }));

    const result = await runUploadSecurityChecks({
      media: [makeFile('img.jpg', [0xff, 0xd8, 0xff, 0xe0, 0x00])],
    });

    expect(result.quick.status).toBe('blocked');
    expect(result.quick.findings[0].type).toBe('clamav_threat');
    expect(result.deep.status).toBe('blocked');
    expect(result.deep.scanned).toBe(true);
  });

  it('marks deep.scanned clean when ClamAV passes', async () => {
    loadService({ failOpen: false, scannerAvailable: true, engine: 'clamav' });
    setScanBufferForTests(async () => ({
      status: 'clean',
      reason: null,
      signature: null,
    }));

    const result = await runUploadSecurityChecks({
      media: [makeFile('img.jpg', [0xff, 0xd8, 0xff, 0xe0, 0x00])],
    });

    expect(result.quick.status).toBe('clean');
    expect(result.deep.status).toBe('clean');
    expect(result.deep.scanned).toBe(true);
    expect(result.requires_follow_up).toBe(false);
  });

  it('rejects with unavailable deep status when ClamAV errors and fail-closed', async () => {
    loadService({ failOpen: false, scannerAvailable: true, engine: 'clamav' });
    setScanBufferForTests(async () => {
      throw new Error('clamav_timeout');
    });

    const result = await runUploadSecurityChecks({
      media: [makeFile('img.jpg', [0xff, 0xd8, 0xff, 0xe0, 0x00])],
    });

    expect(result.deep.status).toBe('unavailable');
    expect(result.requires_follow_up).toBe(false);
    expect(result.deep.reason).toContain('clamav_timeout');
  });

  it('computeInitialScanStatus prefers pre-store ClamAV clean over queued pending', () => {
    loadService({ failOpen: false, scannerAvailable: true, engine: 'clamav' });
    const status = computeInitialScanStatus({
      uploadSecurity: {
        requires_follow_up: false,
        deep: { status: 'clean', scanned: true, engine: 'clamav' },
      },
      deepScanResult: { status: 'ready', queued: true, engine: 'clamav' },
    });

    expect(status.scan_status).toBe('clean');
    expect(status.scan_engine).toBe('clamav');
  });
});
