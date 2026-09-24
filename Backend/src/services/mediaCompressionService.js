/**
 * Media Compression Service
 * Compresses photos to max 1MB and videos to max 10MB for incident reports.
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');

let sharp;
let ffmpeg;
let ffmpegPath;
try {
  sharp = require('sharp');
  ffmpeg = require('fluent-ffmpeg');
  ffmpegPath = require('ffmpeg-static');
  if (ffmpeg && ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (_) {
  sharp = null;
  ffmpeg = null;
  ffmpegPath = null;
}

const MAX_PHOTO_SIZE = 1048576; // 1MB
const TARGET_PHOTO_SIZE = 819200; // ~800KB
const MAX_VIDEO_SIZE = 10485760; // 10MB
const TARGET_VIDEO_SIZE = 8388608; // ~8MB

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi'];

const createTempPath = (ext) => {
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex');
  return path.join(os.tmpdir(), `rescue_compress_${id}${ext}`);
};

/**
 * Compress photo to max 1MB (target ~800KB).
 * Maintains aspect ratio.
 *
 * @param {Buffer} buffer - Photo buffer
 * @param {string} filename - Original filename (for extension detection)
 * @returns {Promise<{buffer: Buffer, width: number, height: number, size: number}>}
 */
async function compressPhoto(buffer, filename) {
  if (!sharp) {
    const ext = path.extname(filename || '').toLowerCase() || '.jpg';
    return { buffer, width: 0, height: 0, size: buffer.length, outputExt: ext };
  }

  try {
    let quality = 80;
    let width = 1920;
    let output;

    for (let attempt = 0; attempt < 8; attempt++) {
      output = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

      if (output.length <= MAX_PHOTO_SIZE) {
        const meta = await sharp(output, { failOn: 'none' }).metadata();
        return {
          buffer: output,
          width: meta.width || 0,
          height: meta.height || 0,
          size: output.length,
          outputExt: '.webp',
        };
      }

      quality = Math.max(40, quality - 12);
      width = Math.max(640, Math.floor(width * 0.8));
    }

    output = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer();
    const meta = await sharp(output, { failOn: 'none' }).metadata();
    return {
      buffer: output,
      width: meta.width || 0,
      height: meta.height || 0,
      size: output.length,
      outputExt: '.webp',
    };
  } catch (err) {
    console.warn('Photo compression failed, using original:', err.message);
    const meta = await sharp(buffer, { failOn: 'none' }).metadata().catch(() => ({}));
    const ext = path.extname(filename || '').toLowerCase() || '.jpg';
    return {
      buffer,
      width: meta.width || 0,
      height: meta.height || 0,
      size: buffer.length,
      outputExt: ext,
    };
  }
}

/**
 * Compress video to max 10MB (target ~8MB).
 *
 * @param {Buffer} buffer - Video buffer
 * @param {string} filename - Original filename (for extension detection)
 * @returns {Promise<{buffer: Buffer, duration: number, width: number, height: number, size: number}>}
 */
async function compressVideo(buffer, filename) {
  if (!ffmpeg || !ffmpegPath) {
    const ext = path.extname(filename || '').toLowerCase() || '.mp4';
    return {
      buffer,
      duration: 0,
      width: 0,
      height: 0,
      size: buffer.length,
      outputExt: ext,
    };
  }

  const ext = path.extname(filename || '').toLowerCase() || '.mp4';
  const inputPath = createTempPath(ext);
  const outputPath = createTempPath('.mp4');

  try {
    await fs.writeFile(inputPath, buffer);

    if (buffer.length <= MAX_VIDEO_SIZE) {
      const meta = await getVideoMetadata(inputPath);
      return {
        buffer,
        duration: meta.duration || 0,
        width: meta.width || 0,
        height: meta.height || 0,
        size: buffer.length,
        outputExt: ext,
      };
    }

    let crf = 28;
    let outputBuffer = buffer;

    for (let attempt = 0; attempt < 5; attempt++) {
      await transcodeVideo(inputPath, outputPath, crf);
      outputBuffer = await fs.readFile(outputPath);

      if (outputBuffer.length <= MAX_VIDEO_SIZE) {
        const meta = await getVideoMetadata(outputPath);
        return {
          buffer: outputBuffer,
          duration: meta.duration || 0,
          width: meta.width || 0,
          height: meta.height || 0,
          size: outputBuffer.length,
          outputExt: '.mp4',
        };
      }

      crf = Math.min(40, crf + 4);
    }

    const meta = await getVideoMetadata(outputPath);
    return {
      buffer: outputBuffer,
      duration: meta.duration || 0,
      width: meta.width || 0,
      height: meta.height || 0,
      size: outputBuffer.length,
      outputExt: '.mp4',
    };
  } catch (err) {
    console.warn('Video compression failed, using original:', err.message);
    const meta = await getVideoMetadata(inputPath).catch(() => ({}));
    const ext = path.extname(filename || '').toLowerCase() || '.mp4';
    return {
      buffer,
      duration: meta.duration || 0,
      width: meta.width || 0,
      height: meta.height || 0,
      size: buffer.length,
      outputExt: ext,
    };
  } finally {
    await fs.unlink(inputPath).catch(() => null);
    await fs.unlink(outputPath).catch(() => null);
  }
}

function getVideoMetadata(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        resolve({ duration: 0, width: 0, height: 0 });
        return;
      }
      const stream = (data.streams || []).find((s) => s.codec_type === 'video') || {};
      resolve({
        duration: (data.format && data.format.duration) || 0,
        width: stream.width || 0,
        height: stream.height || 0,
      });
    });
  });
}

function transcodeVideo(inputPath, outputPath, crf = 30) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-crf ${crf}`,
        '-preset veryfast',
        '-movflags +faststart',
        '-c:v libx264',
        '-c:a aac',
      ])
      .format('mp4')
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
}

module.exports = {
  compressPhoto,
  compressVideo,
  MAX_PHOTO_SIZE,
  MAX_VIDEO_SIZE,
  TARGET_PHOTO_SIZE,
  TARGET_VIDEO_SIZE,
};
