const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification');
const authMiddleware = require('../middleware/auth');

// Create new notification
router.post('/', authMiddleware, notificationController.create);

// Get all notifications with pagination and filters
router.get('/', authMiddleware, notificationController.getAll);

// Get notification by ID
router.get('/:id', authMiddleware, notificationController.getById);

// Update notification (full update)
router.put('/:id', authMiddleware, notificationController.update);

// Delete notification
router.delete('/:id', authMiddleware, notificationController.delete);

module.exports = router;
