const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident');
const authMiddleware = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/fileUpload');
const { authorize, checkOwnership } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Create emergency incident report (fast endpoint, no AI classification)
// Allows users, dispatchers, and admins to create incidents
router.post('/emergency', authMiddleware, authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), incidentController.createEmergency);

// Create incident with audio and media files (AI-enhanced)
// Allows users, dispatchers, and admins to create incidents
router.post('/with-audio', authMiddleware, authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), uploadMiddleware, incidentController.createWithAudio);

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

// Get current user's incidents (always filtered to own)
router.get('/user/my', authMiddleware, incidentController.getMyIncidents);

// Get all incidents with pagination and filters
// Users see only own; dispatchers/admins see all
router.get('/', authMiddleware, incidentController.getAll);

// Get incident by ID
// Users can only view their own; dispatchers/admins can view any
router.get('/:id', authMiddleware, checkOwnership('user_id'), incidentController.getById);

module.exports = router;
