const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatch');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

// All dispatch endpoints require dispatcher or admin role

// Create new dispatch
router.post('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), dispatchController.create);

// Get all dispatches with pagination and filters
router.get('/', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), dispatchController.getAll);

// Get dispatch by ID
router.get('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), dispatchController.getById);

// Update dispatch (full update)
router.put('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), dispatchController.update);

// Delete dispatch
router.delete('/:id', authMiddleware, authorize([ROLES.DISPATCHER, ROLES.ADMIN]), dispatchController.delete);

module.exports = router;
