/**
 * Admin Controller
 * Handles user management and system administration operations
 * Only accessible to users with ADMIN role
 */

const User = require('../models/user');
const { ROLES } = require('../config/roles');
const { hashPassword } = require('../utils/hash');
const { validateEmail, validatePhoneNumber, validateOptionalString, validatePagination } = require('../utils/validation');
const { logAdminAction } = require('../utils/auditLog');

const adminController = {
  /**
   * List all users (with pagination)
   * GET /api/admin/users
   */
  async listUsers(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { offset, validatedLimit } = validatePagination(page, limit);

      const result = await User.getPaginated(offset, validatedLimit);
      
      // Remove password hashes from response
      const users = result.users.map(user => ({
        ...user,
        password: undefined
      }));

      await logAdminAction(req, 'users_list', 'user', null, {
        page,
        limit: validatedLimit,
        total: result.total
      });

      res.json({
        users,
        pagination: {
          page,
          limit: validatedLimit,
          total: result.total,
          pages: Math.ceil(result.total / validatedLimit)
        }
      });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get a specific user by ID
   * GET /api/admin/users/:id
   */
  async getUser(req, res) {
    try {
      const { id } = req.params;

      // Validate ID format
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove password hash
      user.password = undefined;

      await logAdminAction(req, 'user_read', 'user', user.user_id, { user_id: user.user_id });

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Create a new user with specified role
   * POST /api/admin/users
   * 
   * Body: {
   *   email: string,
   *   phone_number: string (optional),
   *   first_name: string (optional),
   *   last_name: string (optional),
   *   password: string,
  *   role: 'user' | 'dispatcher' | 'responder' | 'supervisor' | 'admin'
   * }
   */
  async createUser(req, res) {
    try {
      const { email, phone_number, first_name, last_name, password, role } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
      }

      // Validate email format
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Validate role
      if (role && !Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` });
      }

      // Validate phone if provided
      if (phone_number && !validatePhoneNumber(phone_number)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      // Check if email already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Check if phone already exists (if provided)
      if (phone_number) {
        const existingPhone = await User.findByPhone(phone_number);
        if (existingPhone) {
          return res.status(409).json({ error: 'Phone number already exists' });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user with specified role
      const newUser = await User.create({
        email,
        phone_number: phone_number || null,
        first_name: validateOptionalString(first_name, 'first_name', 100),
        last_name: validateOptionalString(last_name, 'last_name', 100),
        password: passwordHash,
        role: role || ROLES.USER
      });

      // Remove password from response
      newUser.password = undefined;

      await logAdminAction(req, 'user_create', 'user', newUser.user_id, {
        email,
        phone_number: phone_number || null,
        role: role || ROLES.USER
      });

      res.status(201).json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Update user role
   * PUT /api/admin/users/:id/role
   * 
   * Body: {
  *   role: 'user' | 'dispatcher' | 'responder' | 'supervisor' | 'admin'
   * }
   */
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Validate ID format
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      // Validate role
      if (!role || !Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` });
      }

      // Prevent demoting the last admin
      if (role !== ROLES.ADMIN) {
        const adminCount = await User.countByRole(ROLES.ADMIN);
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last admin user' });
        }
      }

      // Check if user exists
      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const oldRole = user.role;

      // Update role
      const updatedUser = await User.updateRole(parseInt(id, 10), role);
      updatedUser.password = undefined;

      await logAdminAction(req, 'user_role_update', 'user', user.user_id, {
        user_id,
        old_role: oldRole,
        new_role: role
      });

      res.json({
        message: 'User role updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Deactivate a user account
   * PUT /api/admin/users/:id/deactivate
   */
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      // Validate ID format
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      // Check if user exists
      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deactivating the last admin
      if (user.role === ROLES.ADMIN) {
        const adminCount = await User.countByRole(ROLES.ADMIN);
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot deactivate the last admin user' });
        }
      }

      // Deactivate user (set is_active to false)
      // This requires is_active column to be added in DB migration
      const deactivatedUser = await User.deactivate(parseInt(id, 10));
      deactivatedUser.password = undefined;

      await logAdminAction(req, 'user_deactivate', 'user', user.user_id, {
        user_id: parseInt(id, 10),
        reason: req.body.reason || null
      });

      res.json({
        message: 'User deactivated successfully',
        user: deactivatedUser
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Delete a user (permanent deletion)
   * DELETE /api/admin/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Validate ID format
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      // Check if user exists
      const user = await User.findById(parseInt(id, 10));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent deleting the last admin
      if (user.role === ROLES.ADMIN) {
        const adminCount = await User.countByRole(ROLES.ADMIN);
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      // Delete user
      await User.delete(parseInt(id, 10));

      await logAdminAction(req, 'user_delete', 'user', parseInt(id, 10), {
        user_id: parseInt(id, 10),
        email: user.email
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Get system statistics and status
   * GET /api/admin/stats
   */
  async getStats(req, res) {
    try {
      const stats = await User.getStats();

      await logAdminAction(req, 'stats_view', 'system', null, {});

      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = adminController;
