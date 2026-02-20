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

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * User Management Endpoints
 */

// List all users with pagination
// GET /api/admin/users?page=1&limit=20
// ADMIN only
router.get('/users', authorize([ROLES.ADMIN]), adminController.listUsers);

// Get specific user by ID
// GET /api/admin/users/:id
// DISPATCHER and ADMIN can view user details
router.get('/users/:id', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), adminController.getUser);

// Create new user with role assignment
// POST /api/admin/users
// Body: { email, password, phone_number?, first_name?, last_name?, role? }
// ADMIN only
router.post('/users', authorize([ROLES.ADMIN]), adminController.createUser);

// Update user role
// PUT /api/admin/users/:id/role
// Body: { role: 'user' | 'dispatcher' | 'admin' }
// ADMIN only
router.put('/users/:id/role', authorize([ROLES.ADMIN]), adminController.updateUserRole);

// Deactivate user account (soft delete)
// PUT /api/admin/users/:id/deactivate
// Body: { reason?: string }
// ADMIN only
router.put('/users/:id/deactivate', authorize([ROLES.ADMIN]), adminController.deactivateUser);

// Delete user permanently (hard delete)
// DELETE /api/admin/users/:id
// ADMIN only
router.delete('/users/:id', authorize([ROLES.ADMIN]), adminController.deleteUser);

/**
 * System Management Endpoints
 */

// Get system statistics
// GET /api/admin/stats
// ADMIN only
router.get('/stats', authorize([ROLES.ADMIN]), adminController.getStats);

module.exports = router;
