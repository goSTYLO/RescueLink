const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident');
const authMiddleware = require('../middleware/auth');

// Create emergency incident report (fast endpoint, no AI classification)
router.post('/emergency', authMiddleware, incidentController.createEmergency);

// Get current user's incidents
router.get('/user/my', authMiddleware, incidentController.getMyIncidents);

// Get all incidents with pagination and filters
router.get('/', authMiddleware, incidentController.getAll);

// Get incident by ID
router.get('/:id', authMiddleware, incidentController.getById);

module.exports = router;
