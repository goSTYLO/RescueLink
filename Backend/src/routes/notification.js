const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification');
const authMiddleware = require('../middleware/auth');
const { authorize, checkOwnership } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Create new notification (dispatcher/admin only)
router.post('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), notificationController.create);

// Get unread count for badge (must be before /:id)
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);

// Mark all as read
router.post('/mark-all-read', authMiddleware, notificationController.markAllAsRead);

// Get all notifications - users see own, dispatcher/admin see all
router.get('/', authMiddleware, notificationController.getAll);

// Get notification by ID - users can only view their own
router.get('/:id', authMiddleware, checkOwnership('user_id'), notificationController.getById);

// Update notification (dispatcher/admin only)
router.put('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), notificationController.update);

// Delete notification (dispatcher/admin only)
router.delete('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), notificationController.delete);

module.exports = router;
