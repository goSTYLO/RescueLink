/**
 * File Validation and Management Utilities
 * Handles file validation, renaming, saving, and deletion
 */

const path = require('path');
const { AUDIO_EXTENSIONS, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS } = require('../middleware/fileUpload');
const { compressPhoto, compressVideo } = require('../services/mediaCompressionService');
const {
  writeObject,
  readObject,
  objectExists,
  removeObject,
  moveObject,
  diskPathForKey,
} = require('../services/storageService');

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

const validateMediaFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPhoto = PHOTO_EXTENSIONS.includes(ext);
  const isVideo = VIDEO_EXTENSIONS.includes(ext);

  if (!isPhoto && !isVideo) {
    throw new Error(`Invalid media format: ${ext}`);
  }

  return { isPhoto, isVideo, ext };
};

const generateFilename = (reportId, type, extension, index = 0) => {
  if (type === 'audio') {
    return `incident_${reportId}_audio${extension}`;
  }
  return `incident_${reportId}_${type}_${index}${extension}`;
};

const saveFile = async (buffer, objectKey) => {
  try {
    return await writeObject(objectKey, buffer);
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${objectKey}`);
  }
};

const saveAudioFile = async (audioFile, reportId) => {
  if (!audioFile) {
    return null;
  }

  validateAudioFile(audioFile);

  const ext = path.extname(audioFile.originalname).toLowerCase();
  const filename = generateFilename(reportId, 'audio', ext);
  return saveFile(audioFile.buffer, `incidents/${reportId}/${filename}`);
};

const saveMediaFiles = async (mediaFiles, reportId) => {
  if (!mediaFiles || mediaFiles.length === 0) {
    return [];
  }

  const savedPaths = [];
  let photoIndex = 1;
  let videoIndex = 1;

  for (const file of mediaFiles) {
    const { isPhoto, isVideo, ext } = validateMediaFile(file);

    if (isPhoto) {
      const result = await compressPhoto(file.buffer, file.originalname);
      const filename = generateFilename(reportId, 'photo', result.outputExt || ext, photoIndex);
      photoIndex += 1;
      savedPaths.push(await saveFile(result.buffer, `incidents/${reportId}/${filename}`));
    } else if (isVideo) {
      const result = await compressVideo(file.buffer, file.originalname);
      const filename = generateFilename(reportId, 'video', result.outputExt || ext, videoIndex);
      videoIndex += 1;
      savedPaths.push(await saveFile(result.buffer, `incidents/${reportId}/${filename}`));
    }
  }

  return savedPaths;
};

const deleteFile = async (filePath) => {
  if (!filePath) {
    return false;
  }
  return removeObject(filePath);
};

const deleteIncidentFiles = async (audioPath, mediaPaths) => {
  const results = {
    audioDeleted: false,
    mediaDeleted: [],
    errors: [],
  };

  if (audioPath) {
    results.audioDeleted = await deleteFile(audioPath);
  }

  if (mediaPaths && Array.isArray(mediaPaths)) {
    for (const mediaPath of mediaPaths) {
      const deleted = await deleteFile(mediaPath);
      results.mediaDeleted.push({ path: mediaPath, deleted });
    }
  }

  return results;
};

const fileExists = async (filePath) => {
  if (!filePath) return false;
  return objectExists(filePath);
};

const getAbsolutePath = (relativePath) => diskPathForKey(relativePath);

const quarantineFile = async (relativePath, reportId) => {
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext);
  const targetKey = `quarantine/${reportId}/${base}_q_${Date.now()}${ext}`;
  const moved = await moveObject(relativePath, targetKey);
  console.warn(`File moved to quarantine: ${relativePath} -> ${moved}`);
  return moved;
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
  quarantineIncidentFiles,
  readObject,
};
