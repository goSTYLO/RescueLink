/**
 * Document Upload Middleware for Responder Applications
 * Handles multipart/form-data file uploads for IDs, certificates, and supporting documents
 * Uses multer memoryStorage with file size, extension, and security validation
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { runUploadSecurityChecks, FILE_SCAN_FAIL_OPEN } = require('../services/fileScanService');

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB per document
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  let ext = path.extname(file.originalname || '').toLowerCase();
  if (!ext && file.mimetype) {
    if (file.mimetype === 'application/pdf') ext = '.pdf';
    else if (file.mimetype === 'image/png') ext = '.png';
    else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') ext = '.jpg';
    if (ext && file.originalname && !file.originalname.endsWith(ext)) {
      file.originalname = `${file.originalname}${ext}`;
    }
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file type '${ext || 'unknown'}'. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
  cb(null, true);
};

const validateDocumentSizes = (req, res, next) => {
  if (!req.files) return next();

  const errors = [];
  const allFiles = [
    ...(req.files.gov_id || []),
    ...(req.files.certificates || []),
    ...(req.files.other_docs || []),
  ];

  for (const file of allFiles) {
    if (file.size > MAX_DOC_SIZE) {
      errors.push(`File "${file.originalname}" exceeds maximum allowed size of 5MB.`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'File size validation failed',
      errors,
    });
  }

  next();
};

const validateDocumentSecurity = (req, res, next) => {
  if (!req.files) return next();
  const scanResult = runUploadSecurityChecks(req.files);

  if (scanResult.quick.status === 'blocked') {
    return res.status(400).json({
      success: false,
      message: 'File security scan blocked one or more uploads',
      scan: scanResult,
    });
  }

  if (scanResult.deep.status === 'unavailable' && !FILE_SCAN_FAIL_OPEN) {
    return res.status(503).json({
      success: false,
      message: 'Upload security scanner unavailable. Please try again later.',
      scan: scanResult,
    });
  }

  req.uploadSecurity = scanResult;
  next();
};

const documentMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_DOC_SIZE,
    files: 10,
  },
}).fields([
  { name: 'gov_id', maxCount: 1 },
  { name: 'certificates', maxCount: 5 },
  { name: 'other_docs', maxCount: 3 },
]);

const documentUploadMiddleware = (req, res, next) => {
  documentMulter(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        error: err.message,
      });
    }

    validateDocumentSizes(req, res, (sizeErr) => {
      if (sizeErr) return next(sizeErr);
      validateDocumentSecurity(req, res, next);
    });
  });
};

module.exports = {
  documentUploadMiddleware,
  ALLOWED_EXTENSIONS,
  MAX_DOC_SIZE,
};
