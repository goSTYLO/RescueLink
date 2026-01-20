const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatch');
const authMiddleware = require('../middleware/auth');

// Create new dispatch
router.post('/', authMiddleware, dispatchController.create);

// Get all dispatches with pagination and filters
router.get('/', authMiddleware, dispatchController.getAll);

// Get dispatch by ID
router.get('/:id', authMiddleware, dispatchController.getById);

// Update dispatch (full update)
router.put('/:id', authMiddleware, dispatchController.update);

// Delete dispatch
router.delete('/:id', authMiddleware, dispatchController.delete);

module.exports = router;
