const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const incidentController = require('../controllers/incident');
const authMiddleware = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/fileUpload');
const { authorize, checkOwnership } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Rate limit: incident report creation per user (prevents spam/abuse)
// 20 reports per 15 minutes per account (emergency + with-audio combined)
const incidentReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many incident reports. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.user_id;
    if (userId != null) return `user:${userId}`;
    return ipKeyGenerator(req.ip || 'unknown');
  },
});

// Create emergency incident report (fast endpoint, no AI classification)
// Allows users, dispatchers, and admins to create incidents
router.post('/emergency', authMiddleware, incidentReportLimiter, authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), incidentController.createEmergency);

// Create incident with audio and media files (AI-enhanced)
// Allows users, dispatchers, and admins to create incidents
router.post('/with-audio', authMiddleware, incidentReportLimiter, authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), uploadMiddleware, incidentController.createWithAudio);

// Download audio file from incident
// Users can only download their own; dispatchers/admins can download any
router.get('/:id/audio', authMiddleware, checkOwnership('user_id'), incidentController.downloadAudio);

// Download media file by index
// Users can only download from their own; dispatchers/admins can download from any
router.get('/:id/media/:index', authMiddleware, checkOwnership('user_id'), incidentController.downloadMedia);

// Get incident with AI classification details
// Users can only view their own; dispatchers/admins can view any
router.get('/:id/with-ai', authMiddleware, checkOwnership('user_id'), incidentController.getByIdWithAi);

// Verify incident (record on blockchain)
// Dispatcher and admin only
router.post('/:id/verify', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), incidentController.verifyIncident);

// Guarded incident status transitions (resolved is restricted in controller to department admin/head)
router.patch('/:id/status', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD]), incidentController.updateStatus);

// Reporter confirms resolution (owner-only is enforced in controller)
router.post('/:id/confirm-resolution', authMiddleware, authorize([ROLES.USER]), incidentController.confirmResolution);

// Manual reclassification with AI override audit trail
// Dispatcher/admin/supervisor including admin role aliases
router.post('/:id/reclassify', authMiddleware, authorize([
  ROLES.DISPATCHER,
  ROLES.ADMIN,
  'supervisor',
  'Supervisor',
  'super-admin',
  'superadmin',
  'Super Admin'
]), incidentController.reclassifyIncident);

// Coordination notes endpoints (must be before generic /:id routes)
// Get coordination notes for an incident
router.get('/:id/coordination-notes', authMiddleware, incidentController.getCoordinationNotes);

// Add a coordination note to an incident
router.post('/:id/coordination-notes', authMiddleware, incidentController.addCoordinationNote);

// Duplicate detection endpoints
router.get('/:id/duplicates', authMiddleware, incidentController.getDuplicates);
router.get('/:id/potential-duplicates', authMiddleware, incidentController.getPotentialDuplicates);
router.post('/:id/link-duplicate', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), incidentController.linkDuplicate);
router.post('/:id/unlink-duplicate', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), incidentController.unlinkDuplicate);

// Get current user's incidents (always filtered to own)
router.get('/user/my', authMiddleware, incidentController.getMyIncidents);

// Get all incidents with pagination and filters
// Users see only own; dispatchers/admins see all
router.get('/', authMiddleware, incidentController.getAll);

// Get incident by ID
// Users can only view their own; dispatchers/admins can view any
router.get('/:id', authMiddleware, checkOwnership('user_id'), incidentController.getById);

module.exports = router;
