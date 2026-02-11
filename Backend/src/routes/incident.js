const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident');
const authMiddleware = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/fileUpload');

// Create emergency incident report (fast endpoint, no AI classification)
router.post('/emergency', authMiddleware, incidentController.createEmergency);

// Create incident with audio and media files (AI-enhanced)
router.post('/with-audio', authMiddleware, uploadMiddleware, incidentController.createWithAudio);

// Download audio file from incident
router.get('/:id/audio', authMiddleware, incidentController.downloadAudio);

// Download media file by index
router.get('/:id/media/:index', authMiddleware, incidentController.downloadMedia);

// Get incident with AI classification details
router.get('/:id/with-ai', authMiddleware, incidentController.getByIdWithAi);

// Verify incident (record on blockchain)
router.post('/:id/verify', authMiddleware, incidentController.verifyIncident);

// Get current user's incidents
router.get('/user/my', authMiddleware, incidentController.getMyIncidents);

// Get all incidents with pagination and filters
router.get('/', authMiddleware, incidentController.getAll);

// Get incident by ID
router.get('/:id', authMiddleware, incidentController.getById);

module.exports = router;
