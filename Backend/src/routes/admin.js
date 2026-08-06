/**
 * Admin Routes
 * All routes require ADMIN role
 * Prefix: /api/admin
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware and admin role check to all routes
router.use(authMiddleware);
router.use(authorize([ROLES.ADMIN]));

/**
 * User Management Endpoints
 */

// List all users with pagination
// GET /api/admin/users?page=1&limit=20
router.get('/users', adminController.listUsers);

// Get specific user by ID
// GET /api/admin/users/:id
router.get('/users/:id', adminController.getUser);

// Create new user with role assignment
// POST /api/admin/users
// Body: { email, password, phone_number?, first_name?, last_name?, role? }
router.post('/users', adminController.createUser);

// Update user role
// PUT /api/admin/users/:id/role
// Body: { role: 'user' | 'dispatcher' | 'admin' }
router.put('/users/:id/role', adminController.updateUserRole);

// Deactivate user account (soft delete)
// PUT /api/admin/users/:id/deactivate
// Body: { reason?: string }
router.put('/users/:id/deactivate', adminController.deactivateUser);

// Delete user permanently (hard delete)
// DELETE /api/admin/users/:id
router.delete('/users/:id', adminController.deleteUser);

/**
 * System Management Endpoints
 */

// Get system statistics
// GET /api/admin/stats
router.get('/stats', adminController.getStats);

module.exports = router;
