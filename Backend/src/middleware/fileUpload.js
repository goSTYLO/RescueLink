/**
 * File Upload Middleware
 * Handles multipart/form-data file uploads for audio and media files
 * Uses multer for file handling with memory storage
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { runUploadSecurityChecks, FILE_SCAN_FAIL_OPEN } = require('../services/fileScanService');
require('dotenv').config();

// Get configuration from environment
const MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE, 10) || 26214400; // 25MB default
const MAX_PHOTO_SIZE = parseInt(process.env.MAX_PHOTO_SIZE, 10) || 1048576; // 1MB default
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE, 10) || 10485760; // 10MB default
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads/incidents';

// Allowed file extensions
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.flac'];
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi'];

// Multer memory storage configuration (files stored in memory as Buffer)
const storage = multer.memoryStorage();

/**
 * File filter function to validate file types
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'audio') {
    if (!AUDIO_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid audio format. Allowed: ${AUDIO_EXTENSIONS.join(', ')}`), false);
    }
  } else if (file.fieldname === 'media') {
    const allAllowed = [...PHOTO_EXTENSIONS, ...VIDEO_EXTENSIONS];
    if (!allAllowed.includes(ext)) {
      return cb(new Error(`Invalid media format. Allowed: ${allAllowed.join(', ')}`), false);
    }
  }
  
  cb(null, true);
};

/**
 * Custom file size validator (checks after upload completes)
 */
const validateFileSize = (req, res, next) => {
  const errors = [];
  
  // Check audio file size
  if (req.files && req.files.audio && req.files.audio.length > 0) {
    const audioFile = req.files.audio[0];
    if (audioFile.size > MAX_AUDIO_SIZE) {
      errors.push(`Audio file too large. Max size: ${MAX_AUDIO_SIZE / 1024 / 1024}MB`);
    }
  }
  
  // Check media files size
  if (req.files && req.files.media && req.files.media.length > 0) {
    req.files.media.forEach((file, index) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const isPhoto = PHOTO_EXTENSIONS.includes(ext);
      const isVideo = VIDEO_EXTENSIONS.includes(ext);
      
      if (isPhoto && file.size > MAX_PHOTO_SIZE) {
        errors.push(`Photo ${index + 1} too large. Max size: ${MAX_PHOTO_SIZE / 1024 / 1024}MB`);
      } else if (isVideo && file.size > MAX_VIDEO_SIZE) {
        errors.push(`Video ${index + 1} too large. Max size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
      }
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'File size validation failed',
      errors
    });
  }
  
  next();
};

/**
 * Quick malware/signature checks + deep scan availability checks
 */
const validateFileSecurity = (req, res, next) => {
  const scanResult = runUploadSecurityChecks(req.files || {});

  console.log('🛡️ Upload quick scan status:', scanResult.quick.status);

  if (scanResult.quick.status === 'blocked') {
    console.warn('⛔ Upload blocked by quick scan findings:', scanResult.quick.findings);
    return res.status(400).json({
      success: false,
      message: 'File security scan blocked one or more uploads',
      scan: scanResult
    });
  }

  if (scanResult.deep.status === 'unavailable' && !FILE_SCAN_FAIL_OPEN) {
    console.error('❌ Upload rejected because deep scanner is unavailable and fail-open is disabled');
    return res.status(503).json({
      success: false,
      message: 'Upload scanner unavailable. Please try again later.',
      scan: scanResult
    });
  }

  if (scanResult.deep.status === 'unavailable' && FILE_SCAN_FAIL_OPEN) {
    console.warn('⚠️ Fail-open triggered: accepting upload while deep scanner is unavailable');
  }

  if (scanResult.deep.status === 'ready') {
    console.log(`🧪 Deep scan engine ready: ${scanResult.deep.engine}`);
  }

  req.uploadSecurity = scanResult;
  next();
};

/**
 * Multer upload configuration
 * - audio: single audio file
 * - media: up to 5 photos/videos
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Maximum individual file size (use largest limit)
    files: 6 // 1 audio + 5 media files
  }
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'media', maxCount: 5 }
]);

/**
 * Middleware wrapper with error handling
 */
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      const errorMessages = {
        LIMIT_FILE_SIZE: 'File too large',
        LIMIT_FILE_COUNT: 'Too many files uploaded',
        LIMIT_UNEXPECTED_FILE: 'Unexpected file field'
      };
      
      return res.status(400).json({
        success: false,
        message: errorMessages[err.code] || 'File upload error',
        error: err.message
      });
    } else if (err) {
      // Custom errors (from fileFilter)
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        error: err.message
      });
    }
    
    // No errors, proceed to file size + security validation
    validateFileSize(req, res, (sizeError) => {
      if (sizeError) {
        return next(sizeError);
      }

      validateFileSecurity(req, res, next);
    });
  });
};

/**
 * Ensure upload directory exists
 */
const ensureUploadDir = async () => {
  try {
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
    await fs.mkdir(uploadPath, { recursive: true });
    console.log(`📁 Upload directory ready: ${uploadPath}`);
  } catch (error) {
    console.error('❌ Failed to create upload directory:', error);
    throw error;
  }
};

// Create upload directory on module load
ensureUploadDir().catch(console.error);

module.exports = {
  uploadMiddleware,
  UPLOAD_DIR,
  AUDIO_EXTENSIONS,
  PHOTO_EXTENSIONS,
  VIDEO_EXTENSIONS
};
