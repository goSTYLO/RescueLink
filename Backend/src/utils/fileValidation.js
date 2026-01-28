/**
 * File Validation and Management Utilities
 * Handles file validation, renaming, saving, and deletion
 */

const path = require('path');
const fs = require('fs').promises;
const { UPLOAD_DIR, AUDIO_EXTENSIONS, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS } = require('../middleware/fileUpload');

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
    
    let filename;
    if (isPhoto) {
      filename = generateFilename(reportId, 'photo', ext, photoIndex);
      photoIndex++;
    } else if (isVideo) {
      filename = generateFilename(reportId, 'video', ext, videoIndex);
      videoIndex++;
    }
    
    const filePath = await saveFile(file.buffer, filename);
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
  getAbsolutePath
};
