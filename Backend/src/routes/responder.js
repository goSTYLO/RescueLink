const express = require('express');
const router = express.Router();
const responderController = require('../controllers/responder');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// All responder endpoints require dispatcher or admin role

// Create new responder
router.post('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.create);

// Get all responders with pagination and filters
router.get('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.getAll);

// Get responder by ID
router.get('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.getById);

// Update responder (full update)
router.put('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.update);

// Delete responder
router.delete('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.delete);

module.exports = router;
