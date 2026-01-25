const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location');

// Check if coordinates are within Dagupan city boundaries
router.post('/check', locationController.checkLocation);

module.exports = router;
