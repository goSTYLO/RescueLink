/**
 * Object store for uploads. Uses Supabase Storage when env is set; else local disk.
 * ponytail: two backends (bucket vs uploads/); drop disk once every environment has Storage env.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let createClient = null;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (_) {
  createClient = null;
}

const MIME_BY_EXT = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
};

function isConfigured() {
  return Boolean(
    process.env.SUPABASE_URL
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && createClient
  );
}

function bucketName() {
  return process.env.STORAGE_BUCKET || 'rescuelink-media';
}

function normalizeKey(storedPath) {
  return String(storedPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function contentTypeForPath(storedPath) {
  const ext = path.extname(normalizeKey(storedPath)).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function diskPathForKey(storedPath) {
  const key = normalizeKey(storedPath);
  if (!key) return null;
  if (key.startsWith('uploads/')) {
    return path.join(process.cwd(), key);
  }
  return path.join(process.cwd(), 'uploads', key);
}

function getClient() {
  if (!isConfigured()) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function writeObject(objectKey, buffer, contentType) {
  const key = normalizeKey(objectKey);
  if (!key) throw new Error('Missing storage object key');
  const type = contentType || contentTypeForPath(key);

  if (isConfigured()) {
    const client = getClient();
    const { error } = await client.storage.from(bucketName()).upload(key, buffer, {
      contentType: type,
      upsert: true,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return key;
  }

  const diskPath = diskPathForKey(key);
  await fs.mkdir(path.dirname(diskPath), { recursive: true });
  await fs.writeFile(diskPath, buffer);
  return key;
}

async function readObject(storedPath) {
  const key = normalizeKey(storedPath);
  if (!key) return null;

  if (isConfigured() && !key.startsWith('uploads/')) {
    const client = getClient();
    const { data, error } = await client.storage.from(bucketName()).download(key);
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer());
    }
  }

  try {
    return await fs.readFile(diskPathForKey(key));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function objectExists(storedPath) {
  const buf = await readObject(storedPath);
  return Boolean(buf && buf.length);
}

async function removeObject(storedPath) {
  const key = normalizeKey(storedPath);
  if (!key) return false;

  let removed = false;
  if (isConfigured() && !key.startsWith('uploads/')) {
    const client = getClient();
    const { error } = await client.storage.from(bucketName()).remove([key]);
    if (!error) removed = true;
  }

  try {
    await fs.unlink(diskPathForKey(key));
    removed = true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error deleting disk object ${key}:`, err.message);
    }
  }
  return removed;
}

async function moveObject(fromPath, toPath) {
  const buf = await readObject(fromPath);
  if (!buf) throw new Error(`Source object not found: ${fromPath}`);
  await writeObject(toPath, buf, contentTypeForPath(toPath));
  await removeObject(fromPath);
  return normalizeKey(toPath);
}

async function materializeToTemp(storedPath) {
  const buf = await readObject(storedPath);
  if (!buf) return null;
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  const tmp = path.join(os.tmpdir(), `rl_obj_${id}${path.extname(storedPath) || ''}`);
  await fs.writeFile(tmp, buf);
  return tmp;
}

function sendObject(res, buffer, storedPath, disposition = 'inline') {
  const filename = path.basename(normalizeKey(storedPath));
  res.setHeader('Content-Type', contentTypeForPath(storedPath));
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.send(buffer);
}

module.exports = {
  isConfigured,
  bucketName,
  contentTypeForPath,
  diskPathForKey,
  writeObject,
  readObject,
  objectExists,
  removeObject,
  moveObject,
  materializeToTemp,
  sendObject,
};
