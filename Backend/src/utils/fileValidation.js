/**
 * File Validation and Management Utilities
 * Handles file validation, renaming, saving, and deletion
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const { UPLOAD_DIR, AUDIO_EXTENSIONS, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS } = require('../middleware/fileUpload');

let sharp = null;
let ffmpeg = null;
let ffmpegPath = null;

try {
  sharp = require('sharp');
} catch (_) {
  sharp = null;
}

try {
  ffmpeg = require('fluent-ffmpeg');
  ffmpegPath = require('ffmpeg-static');
  if (ffmpeg && ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (_) {
  ffmpeg = null;
  ffmpegPath = null;
}

const IMAGE_COMPRESSION_ENABLED = String(process.env.IMAGE_COMPRESSION_ENABLED || 'true').toLowerCase() === 'true';
const VIDEO_COMPRESSION_ENABLED = String(process.env.VIDEO_COMPRESSION_ENABLED || 'true').toLowerCase() === 'true';
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10);
const IMAGE_JPEG_QUALITY = parseInt(process.env.IMAGE_JPEG_QUALITY || '78', 10);
const VIDEO_CRF = parseInt(process.env.VIDEO_CRF || '30', 10);

const createTempPath = (ext) => {
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex');
  return path.join(os.tmpdir(), `rescue_${id}${ext}`);
};

const compressImageBuffer = async (buffer, ext) => {
  if (!IMAGE_COMPRESSION_ENABLED || !sharp) {
    return { buffer, ext, compressed: false };
  }

  try {
    let pipeline = sharp(buffer, { failOn: 'none' }).rotate().resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true });

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: 80 });
      return { buffer: await pipeline.toBuffer(), ext: '.png', compressed: true };
    }

    return {
      buffer: await pipeline.jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true }).toBuffer(),
      ext: '.jpg',
      compressed: true,
    };
  } catch (error) {
    console.warn('⚠️ Image compression failed, using original buffer:', error.message);
    return { buffer, ext, compressed: false };
  }
};

const transcodeVideoToMp4 = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-crf ${VIDEO_CRF}`,
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
};

const compressVideoBuffer = async (buffer, ext) => {
  if (!VIDEO_COMPRESSION_ENABLED || !ffmpeg || !ffmpegPath) {
    return { buffer, ext, compressed: false };
  }

  const inputPath = createTempPath(ext || '.mp4');
  const outputPath = createTempPath('.mp4');

  try {
    await fs.writeFile(inputPath, buffer);
    await transcodeVideoToMp4(inputPath, outputPath);
    const outputBuffer = await fs.readFile(outputPath);

    if (outputBuffer.length >= buffer.length) {
      return { buffer, ext, compressed: false };
    }

    return { buffer: outputBuffer, ext: '.mp4', compressed: true };
  } catch (error) {
    console.warn('⚠️ Video compression failed, using original buffer:', error.message);
    return { buffer, ext, compressed: false };
  } finally {
    await fs.unlink(inputPath).catch(() => null);
    await fs.unlink(outputPath).catch(() => null);
  }
};

/**
 * Validate audio file duration (optional - requires audio processing library)
 * For now, basic validation is done
 */
const validateAudioFile = (file) => {
  if (!file) {
    throw new Error('Audio file is required');
  }
  
  const ext = path.extname(file.originalname).toLowerCase();
  if (!AUDIO_EXTENSIONS.includes(ext)) {
    throw new Error(`Invalid audio format: ${ext}`);
  }
  
  return true;
};

/**
 * Validate media file (photo or video)
 */
const validateMediaFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPhoto = PHOTO_EXTENSIONS.includes(ext);
  const isVideo = VIDEO_EXTENSIONS.includes(ext);
  
  if (!isPhoto && !isVideo) {
    throw new Error(`Invalid media format: ${ext}`);
  }
  
  return { isPhoto, isVideo, ext };
};

/**
 * Generate standardized filename for uploaded files
 * Format: incident_<reportId>_<type>_<index>.<ext>
 * 
 * @param {number} reportId - Incident report ID
 * @param {string} type - File type: 'audio', 'photo', 'video'
 * @param {string} extension - File extension with dot (e.g., '.wav')
 * @param {number} index - Index for media files (0 for audio)
 * @returns {string} Generated filename
 */
const generateFilename = (reportId, type, extension, index = 0) => {
  if (type === 'audio') {
    return `incident_${reportId}_audio${extension}`;
  }
  return `incident_${reportId}_${type}_${index}${extension}`;
};

/**
 * Save file buffer to disk
 * 
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} filename - Target filename
 * @returns {Promise<string>} Relative file path
 */
const saveFile = async (buffer, filename) => {
  try {
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
    const filePath = path.join(uploadPath, filename);
    
    await fs.writeFile(filePath, buffer);
    
    // Return relative path for database storage
    return path.join(UPLOAD_DIR, filename).replace(/\\/g, '/');
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${filename}`);
  }
};

/**
 * Save audio file and return path
 * 
 * @param {Object} audioFile - Multer file object
 * @param {number} reportId - Incident report ID
 * @returns {Promise<string>} Relative file path
 */
const saveAudioFile = async (audioFile, reportId) => {
  if (!audioFile) {
    return null;
  }
  
  validateAudioFile(audioFile);
  
  const ext = path.extname(audioFile.originalname).toLowerCase();
  const filename = generateFilename(reportId, 'audio', ext);
  
  return await saveFile(audioFile.buffer, filename);
};

/**
 * Save multiple media files (photos/videos)
 * 
 * @param {Array} mediaFiles - Array of multer file objects
 * @param {number} reportId - Incident report ID
 * @returns {Promise<Array>} Array of relative file paths
 */
const saveMediaFiles = async (mediaFiles, reportId) => {
  if (!mediaFiles || mediaFiles.length === 0) {
    return [];
  }
  
  const savedPaths = [];
  let photoIndex = 1;
  let videoIndex = 1;
  
  for (const file of mediaFiles) {
    const { isPhoto, isVideo, ext } = validateMediaFile(file);
    let payloadBuffer = file.buffer;
    let payloadExt = ext;
    
    let filename;
    if (isPhoto) {
      const compressed = await compressImageBuffer(file.buffer, ext);
      payloadBuffer = compressed.buffer;
      payloadExt = compressed.ext;
      filename = generateFilename(reportId, 'photo', payloadExt, photoIndex);
      photoIndex++;
    } else if (isVideo) {
      const compressed = await compressVideoBuffer(file.buffer, ext);
      payloadBuffer = compressed.buffer;
      payloadExt = compressed.ext;
      filename = generateFilename(reportId, 'video', payloadExt, videoIndex);
      videoIndex++;
    }

    const filePath = await saveFile(payloadBuffer, filename);
    savedPaths.push(filePath);
  }
  
  return savedPaths;
};

/**
 * Delete a single file
 * 
 * @param {string} filePath - Relative file path (from database)
 * @returns {Promise<boolean>} Success status
 */
const deleteFile = async (filePath) => {
  if (!filePath) {
    return false;
  }
  
  try {
    const fullPath = path.join(process.cwd(), filePath);
    await fs.unlink(fullPath);
    console.log(`🗑️ Deleted file: ${filePath}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ File not found (already deleted?): ${filePath}`);
      return false;
    }
    console.error(`❌ Error deleting file ${filePath}:`, error);
    return false;
  }
};

/**
 * Delete all files associated with an incident
 * 
 * @param {string} audioPath - Audio file path
 * @param {Array} mediaPaths - Array of media file paths
 * @returns {Promise<Object>} Deletion results
 */
const deleteIncidentFiles = async (audioPath, mediaPaths) => {
  const results = {
    audioDeleted: false,
    mediaDeleted: [],
    errors: []
  };
  
  // Delete audio file
  if (audioPath) {
    results.audioDeleted = await deleteFile(audioPath);
  }
  
  // Delete media files
  if (mediaPaths && Array.isArray(mediaPaths)) {
    for (const mediaPath of mediaPaths) {
      const deleted = await deleteFile(mediaPath);
      results.mediaDeleted.push({ path: mediaPath, deleted });
    }
  }
  
  return results;
};

/**
 * Check if file exists
 * 
 * @param {string} filePath - Relative file path
 * @returns {Promise<boolean>} True if file exists
 */
const fileExists = async (filePath) => {
  if (!filePath) {
    return false;
  }
  
  try {
    const fullPath = path.join(process.cwd(), filePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file absolute path for serving
 * 
 * @param {string} relativePath - Relative file path from database
 * @returns {string} Absolute file path
 */
const getAbsolutePath = (relativePath) => {
  return path.join(process.cwd(), relativePath);
};

const ensureQuarantineDir = async () => {
  const quarantinePath = path.join(process.cwd(), process.env.QUARANTINE_DIR || 'uploads/quarantine');
  await fs.mkdir(quarantinePath, { recursive: true });
  return quarantinePath;
};

const quarantineFile = async (relativePath, reportId) => {
  const quarantineDir = await ensureQuarantineDir();
  const sourcePath = path.join(process.cwd(), relativePath);
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext);
  const targetName = `${base}_q_${reportId}_${Date.now()}${ext}`;
  const targetPath = path.join(quarantineDir, targetName);

  await fs.rename(sourcePath, targetPath);
  const quarantineRelativeRoot = process.env.QUARANTINE_DIR || 'uploads/quarantine';
  return path.join(quarantineRelativeRoot, targetName).replace(/\\/g, '/');
};

const quarantineIncidentFiles = async ({ reportId, audioPath = null, mediaPaths = [] }) => {
  const moved = {
    audioPath: null,
    mediaPaths: [],
  };

  if (audioPath) {
    moved.audioPath = await quarantineFile(audioPath, reportId);
  }

  for (const mediaPath of mediaPaths) {
    moved.mediaPaths.push(await quarantineFile(mediaPath, reportId));
  }

  return moved;
};

module.exports = {
  validateAudioFile,
  validateMediaFile,
  generateFilename,
  saveFile,
  saveAudioFile,
  saveMediaFiles,
  deleteFile,
  deleteIncidentFiles,
  fileExists,
  getAbsolutePath,
  quarantineIncidentFiles
};
