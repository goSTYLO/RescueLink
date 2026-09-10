/**
 * Profile avatar upload — single image field, separate from incident uploads.
 */

const multer = require('multer');
const path = require('path');
const { runUploadSecurityChecks, FILE_SCAN_FAIL_OPEN } = require('../services/fileScanService');

const MAX_AVATAR_SIZE = parseInt(process.env.MAX_PHOTO_SIZE, 10) || 1048576; // 1MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid avatar format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
  cb(null, true);
};

const avatarMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
}).single('avatar');

const avatarUploadMiddleware = (req, res, next) => {
  avatarMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Avatar file is required' });
    }
    if (req.file.size > MAX_AVATAR_SIZE) {
      return res.status(400).json({ message: 'Avatar exceeds maximum allowed size of 1MB' });
    }

    const scanResult = runUploadSecurityChecks({ avatar: [req.file] });
    if (scanResult.quick.status === 'blocked') {
      return res.status(400).json({
        message: 'File security scan blocked the upload',
        scan: scanResult,
      });
    }
    if (scanResult.deep.status === 'unavailable' && !FILE_SCAN_FAIL_OPEN) {
      return res.status(503).json({
        message: 'Upload security scanner unavailable. Please try again later.',
        scan: scanResult,
      });
    }

    req.uploadSecurity = scanResult;
    next();
  });
};

module.exports = {
  avatarUploadMiddleware,
  MAX_AVATAR_SIZE,
  ALLOWED_EXTENSIONS,
};
