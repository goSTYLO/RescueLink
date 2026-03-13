const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Check if coordinates are within Dagupan city boundaries
router.post('/check', locationController.checkLocation);

// Dagupan-scoped geocoding endpoints (used by admin/dispatcher UIs)
router.get('/search', authMiddleware, authorize([ROLES.ADMIN, ROLES.DISPATCHER]), locationController.search);
router.get('/reverse', authMiddleware, authorize([ROLES.ADMIN, ROLES.DISPATCHER]), locationController.reverse);

// Geospatial intelligence endpoints for dispatcher/admin workflows
router.post('/closest-units', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.closestUnits);
router.post('/geofence-alerts', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.geofenceAlerts);
router.get('/heatmap', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.heatmap);

module.exports = router;
