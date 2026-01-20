const express = require('express');
const router = express.Router();
const responderController = require('../controllers/responder');
const authMiddleware = require('../middleware/auth');

// Create new responder
router.post('/', authMiddleware, responderController.create);

// Get all responders with pagination and filters
router.get('/', authMiddleware, responderController.getAll);

// Get responder by ID
router.get('/:id', authMiddleware, responderController.getById);

// Update responder (full update)
router.put('/:id', authMiddleware, responderController.update);

// Delete responder
router.delete('/:id', authMiddleware, responderController.delete);

module.exports = router;
