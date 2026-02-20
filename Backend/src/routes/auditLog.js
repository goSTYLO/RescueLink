const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLog');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// Get audit logs - Dispatcher and Admin only
// Dispatchers see only their own; admins see all
router.get('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), auditLogController.getAll);

module.exports = router;
