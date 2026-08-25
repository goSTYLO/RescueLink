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

// Get all notifications - defaults to current user unless user_id query is provided
router.get('/', authMiddleware, notificationController.getAll);

// Mark single notification as read (must be before /:id)
router.post('/:id/read', authMiddleware, notificationController.markAsRead);

// Get notification by ID - users can only view their own
router.get('/:id', authMiddleware, checkOwnership('user_id'), notificationController.getById);

// Update notification (dispatcher/admin only)
router.put('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), notificationController.update);

// Delete notification (dispatcher/admin only)
router.delete('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), notificationController.delete);

// Notification preferences — allow any authenticated user to manage their push opt-in/out
router.get('/preferences', authMiddleware, notificationController.getPreferences);
router.patch('/preferences/:eventType', authMiddleware, notificationController.updatePreference);

module.exports = router;
