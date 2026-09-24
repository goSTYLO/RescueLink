/**
 * File Security Scan Service
 * Hybrid scanning approach:
 * 1) Synchronous quick checks (signature + basic malware indicators)
 * 2) Asynchronous deep scan queue (placeholder for ClamAV/other engines)
 */

require('dotenv').config();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const net = require('net');
const { materializeToTemp } = require('./storageService');

const FILE_SCAN_FAIL_OPEN = String(process.env.FILE_SCAN_FAIL_OPEN || 'true').toLowerCase() === 'true';
const FILE_DEEP_SCAN_ENABLED = String(process.env.FILE_DEEP_SCAN_ENABLED || 'true').toLowerCase() === 'true';
const FILE_DEEP_SCAN_ENGINE = process.env.FILE_DEEP_SCAN_ENGINE || 'stub';
const FILE_SCANNER_AVAILABLE = String(process.env.FILE_SCANNER_AVAILABLE || 'false').toLowerCase() === 'true';
const CLAMAV_HOST = process.env.CLAMAV_HOST || '127.0.0.1';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);
const CLAMAV_TIMEOUT_MS = parseInt(process.env.CLAMAV_TIMEOUT_MS || '15000', 10);

const BLOCKED_SIGNATURES = [
  { name: 'windows_executable', bytes: Buffer.from([0x4d, 0x5a]) }, // MZ
  { name: 'elf_binary', bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) }, // ELF
  { name: 'script_shebang', bytes: Buffer.from([0x23, 0x21]) }, // #!
];

const SIGNATURES = {
  '.webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF (WEBP at offset 8)
  '.jpg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  '.png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  '.pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  '.wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
  '.flac': [Buffer.from([0x66, 0x4c, 0x61, 0x43])], // fLaC
  '.mp3': [Buffer.from([0x49, 0x44, 0x33]), Buffer.from([0xff, 0xfb]), Buffer.from([0xff, 0xf3]), Buffer.from([0xff, 0xf2])],
  '.mp4': [Buffer.from([0x66, 0x74, 0x79, 0x70], 'ascii')], // looked up at offset 4
  '.m4a': [Buffer.from([0x66, 0x74, 0x79, 0x70], 'ascii')],
  '.mov': [Buffer.from([0x66, 0x74, 0x79, 0x70], 'ascii')],
};

const startsWithSignature = (buffer, signature) => {
  if (!buffer || buffer.length < signature.length) return false;
  return buffer.subarray(0, signature.length).equals(signature);
};

const includesAtOffset = (buffer, signature, offset) => {
  if (!buffer || buffer.length < offset + signature.length) return false;
  return buffer.subarray(offset, offset + signature.length).equals(signature);
};

const validateBySignature = (file, ext) => {
  const signatures = SIGNATURES[ext];
  if (!signatures || signatures.length === 0) return true;

  if (ext === '.webp') {
    return startsWithSignature(file.buffer, Buffer.from([0x52, 0x49, 0x46, 0x46]))
      && includesAtOffset(file.buffer, Buffer.from('WEBP'), 8);
  }

  if (ext === '.mp4' || ext === '.m4a' || ext === '.mov') {
    return signatures.some((sig) => includesAtOffset(file.buffer, sig, 4));
  }

  return signatures.some((sig) => startsWithSignature(file.buffer, sig));
};

const hasBlockedSignature = (file) => {
  return BLOCKED_SIGNATURES.find((blocked) => startsWithSignature(file.buffer, blocked.bytes)) || null;
};

const runQuickScan = (files = []) => {
  const findings = [];

  for (const file of files) {
    const blocked = hasBlockedSignature(file);
    if (blocked) {
      findings.push({
        file: file.originalname,
        severity: 'high',
        type: 'blocked_signature',
        detail: blocked.name,
      });
      continue;
    }

    if (!validateBySignature(file, file.extension)) {
      findings.push({
        file: file.originalname,
        severity: 'high',
        type: 'signature_mismatch',
        detail: `${file.extension} signature mismatch`,
      });
    }
  }

  const blocked = findings.some((item) => item.severity === 'high');
    if (blocked) {
      console.warn('⛔ Quick scan flagged upload(s):', findings);
    }
  return {
    status: blocked ? 'blocked' : 'clean',
    findings,
  };
};

const isEngineConfigured = () => {
  if (FILE_DEEP_SCAN_ENGINE === 'clamav') {
    return Boolean(CLAMAV_HOST && CLAMAV_PORT > 0);
  }

  if (FILE_DEEP_SCAN_ENGINE === 'stub') {
    return false;
  }

  return false;
};

const getDeepScanStatus = () => {
  if (!FILE_DEEP_SCAN_ENABLED) {
    return {
      status: 'disabled',
      engine: FILE_DEEP_SCAN_ENGINE,
      fail_open: false,
      reason: 'deep_scan_disabled',
    };
  }

  if (!FILE_SCANNER_AVAILABLE || !isEngineConfigured()) {
    return {
      status: 'unavailable',
      engine: FILE_DEEP_SCAN_ENGINE,
      fail_open: FILE_SCAN_FAIL_OPEN,
      reason: 'scanner_not_configured',
    };
  }

  return {
    status: 'ready',
    engine: FILE_DEEP_SCAN_ENGINE,
    fail_open: false,
    reason: null,
  };
};

const parseClamAvResponse = (responseBuffer) => {
  const message = responseBuffer.toString('utf8').replace(/\0/g, '').trim();

  if (!message) {
    return { status: 'error', reason: 'empty_response', signature: null };
  }

  if (message.includes('FOUND')) {
    const signature = message.replace(/^.*:\s*/g, '').replace(/\s+FOUND$/g, '').trim();
    return { status: 'infected', reason: 'threat_detected', signature };
  }

  if (message.endsWith('OK') || message.includes(' OK')) {
    return { status: 'clean', reason: null, signature: null };
  }

  return { status: 'error', reason: message, signature: null };
};

const scanFileWithClamAv = async (absolutePath) => {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
    const readStream = fsSync.createReadStream(absolutePath, { highWaterMark: 8192 });
    const responseChunks = [];
    let streamFinished = false;
    let rejected = false;

    const fail = (error) => {
      if (rejected) return;
      rejected = true;
      readStream.destroy();
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(CLAMAV_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0', 'utf8'));
      readStream.resume();
    });

    socket.on('timeout', () => fail(new Error('clamav_timeout')));
    socket.on('error', (error) => fail(error));
    readStream.on('error', (error) => fail(error));

    readStream.pause();
    readStream.on('data', (chunk) => {
      if (rejected) return;
      readStream.pause();

      const size = Buffer.alloc(4);
      size.writeUInt32BE(chunk.length, 0);

      socket.write(Buffer.concat([size, chunk]), (error) => {
        if (error) {
          fail(error);
          return;
        }
        readStream.resume();
      });
    });

    readStream.on('end', () => {
      if (rejected) return;
      const endMarker = Buffer.alloc(4);
      endMarker.writeUInt32BE(0, 0);
      socket.write(endMarker, (error) => {
        if (error) {
          fail(error);
          return;
        }
        streamFinished = true;
      });
    });

    socket.on('data', (chunk) => {
      responseChunks.push(chunk);
    });

    socket.on('end', () => {
      if (rejected || !streamFinished) return;
      const parsed = parseClamAvResponse(Buffer.concat(responseChunks));
      if (parsed.status === 'error') {
        reject(new Error(`clamav_scan_error:${parsed.reason}`));
        return;
      }
      if (parsed.status === 'infected') {
        console.warn(`☣️ ClamAV detected threat in ${absolutePath}: ${parsed.signature || 'unknown-signature'}`);
      } else {
        console.log(`✅ ClamAV clean result for ${absolutePath}`);
      }
      resolve(parsed);
    });
  });
};

const normalizeIncomingFiles = (filesObj = {}) => {
  if (Array.isArray(filesObj)) {
    return filesObj.map((file) => ({
      ...file,
      extension: path.extname(file.originalname || '').toLowerCase(),
    }));
  }
  const allFiles = [];
  for (const fieldName of Object.keys(filesObj)) {
    const list = Array.isArray(filesObj[fieldName]) ? filesObj[fieldName] : [filesObj[fieldName]];
    for (const file of list) {
      if (file && file.originalname) {
        allFiles.push({
          ...file,
          extension: path.extname(file.originalname).toLowerCase(),
        });
      }
    }
  }
  return allFiles;
};

const runUploadSecurityChecks = (filesObj = {}) => {
  const files = normalizeIncomingFiles(filesObj);
  const quick = runQuickScan(files);
  const deep = getDeepScanStatus();

  if (deep.status === 'unavailable') {
    console.warn(`⚠️ Deep scan unavailable (engine=${deep.engine}, fail_open=${deep.fail_open})`);
  }

  return {
    quick,
    deep,
    requires_follow_up: deep.status === 'unavailable' && deep.fail_open,
  };
};

const queueDeepScanJob = async ({ reportId, filePaths = [] }) => {
  const deep = getDeepScanStatus();

  if (deep.status === 'disabled') {
    return { ...deep, queued: false, job_id: null };
  }

  if (deep.status === 'unavailable') {
    return { ...deep, queued: false, job_id: null };
  }

  console.log(`🛡️ Deep scan queued for report ${reportId}:`, filePaths);
  const jobId = `deep-scan-${reportId}-${Date.now()}`;
  console.log(`🛡️ Deep scan queued (${jobId}) for report ${reportId}:`, filePaths);

  return {
    ...deep,
    queued: true,
    job_id: jobId,
    file_count: filePaths.length,
  };
};

const computeInitialScanStatus = ({ uploadSecurity, deepScanResult }) => {
  if (!uploadSecurity) {
    return {
      scan_status: 'pending',
      scan_engine: deepScanResult?.engine || FILE_DEEP_SCAN_ENGINE,
      scan_error: null,
    };
  }

  if (uploadSecurity.requires_follow_up) {
    return {
      scan_status: 'unscanned',
      scan_engine: deepScanResult?.engine || FILE_DEEP_SCAN_ENGINE,
      scan_error: deepScanResult?.reason || 'scanner_unavailable',
    };
  }

  if (deepScanResult?.status === 'ready' && deepScanResult?.queued) {
    return {
      scan_status: 'pending',
      scan_engine: deepScanResult.engine,
      scan_error: null,
    };
  }

  return {
    scan_status: 'clean',
    scan_engine: deepScanResult?.engine || FILE_DEEP_SCAN_ENGINE,
    scan_error: null,
  };
};

const detectSimulatedThreat = async (absolutePath) => {
  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    return { infected: false, reason: null };
  }

  const basename = path.basename(absolutePath).toLowerCase();
  if (basename.includes('eicar') || basename.includes('virus') || basename.includes('malware')) {
    return { infected: true, reason: 'simulated_threat_name_match' };
  }

  return { infected: false, reason: null };
};

const performDeepScan = async ({ filePaths = [] }) => {
  const deep = getDeepScanStatus();
  console.log(`🛡️ Performing deep scan using engine=${deep.engine} for ${filePaths.length} file(s)`);

  if (deep.status === 'disabled') {
    return {
      status: 'clean',
      engine: deep.engine,
      scan_error: null,
      scanned_at: new Date().toISOString(),
      infected_files: [],
    };
  }

  if (deep.status === 'unavailable') {
    console.warn(`⚠️ Deep scan unavailable during execution (engine=${deep.engine}, fail_open=${deep.fail_open})`);
    return {
      status: deep.fail_open ? 'unscanned' : 'error',
      engine: deep.engine,
      scan_error: deep.reason,
      scanned_at: null,
      infected_files: [],
    };
  }

  const infectedFiles = [];
  for (const relativePath of filePaths) {
    let tempPath = null;
    try {
      tempPath = await materializeToTemp(relativePath);
      if (!tempPath) {
        continue;
      }
      const result = FILE_DEEP_SCAN_ENGINE === 'clamav'
        ? await scanFileWithClamAv(tempPath)
        : await detectSimulatedThreat(tempPath);

      const infected = FILE_DEEP_SCAN_ENGINE === 'clamav'
        ? result.status === 'infected'
        : result.infected;

      if (infected) {
        infectedFiles.push({
          path: relativePath,
          reason: result.reason,
          signature: result.signature || null,
        });
      }
    } catch (error) {
      return {
        status: 'error',
        engine: deep.engine,
        scan_error: `scan_failed:${error.message}`,
        scanned_at: null,
        infected_files: [],
      };
    } finally {
      if (tempPath) {
        await fs.unlink(tempPath).catch(() => null);
      }
    }
  }

  if (infectedFiles.length > 0) {
    return {
      status: 'quarantined',
      engine: deep.engine,
      scan_error: 'threat_detected',
      scanned_at: new Date().toISOString(),
      infected_files: infectedFiles,
    };
  }

  return {
    status: 'clean',
    engine: deep.engine,
    scan_error: null,
    scanned_at: new Date().toISOString(),
    infected_files: [],
  };
};

module.exports = {
  runUploadSecurityChecks,
  queueDeepScanJob,
  performDeepScan,
  computeInitialScanStatus,
  FILE_SCAN_FAIL_OPEN,
};
