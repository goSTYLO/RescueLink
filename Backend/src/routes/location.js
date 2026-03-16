const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Check if coordinates are within Dagupan city boundaries
router.post('/check', locationController.checkLocation);

// Barangay lookup from coordinates (for mobile incident report UI)
router.get('/barangay', authMiddleware, authorize([ROLES.USER, ROLES.DISPATCHER, ROLES.ADMIN]), locationController.getBarangay);

// Dagupan-scoped geocoding endpoints (admin/dispatcher UIs + mobile user address)
router.get('/search', authMiddleware, authorize([ROLES.USER, ROLES.ADMIN, ROLES.DISPATCHER]), locationController.search);
router.get('/reverse', authMiddleware, authorize([ROLES.USER, ROLES.ADMIN, ROLES.DISPATCHER]), locationController.reverse);

// Geospatial intelligence endpoints for dispatcher/admin workflows
router.post('/closest-units', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.closestUnits);
router.post('/geofence-alerts', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.geofenceAlerts);
router.get('/heatmap', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), locationController.heatmap);

module.exports = router;
