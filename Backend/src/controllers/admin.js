/**
 * Admin Controller
 * Handles user management and system administration operations
 * Only accessible to users with ADMIN role
 */

const User = require('../models/user');
const Responder = require('../models/responder');
const Department = require('../models/department');
const { ROLES } = require('../config/roles');
const { hashPassword } = require('../utils/hash');
const { validateEmail, validatePhone, validateOptionalString, validatePagination } = require('../utils/validation');
const { logAdminAction } = require('../utils/auditLog');
const pool = require('../config/db');

/** Normalize incoming role from request body to canonical value (never default to supervisor). */
function normalizeRoleForAdmin(role) {
  if (role == null || String(role).trim() === '') return ROLES.USER;
  const r = String(role).toLowerCase().trim();
  if (r === 'admin' || r === 'super-admin' || r === 'superadmin') return ROLES.ADMIN;
  if (r === 'department-admin' || r === 'department admin' || r === 'dept admin') return ROLES.DEPARTMENT_ADMIN;
  if (r === 'department-head' || r === 'department head') return ROLES.DEPARTMENT_HEAD;
  if (r === 'responder' || r === 'field-responder' || r === 'field responder') return ROLES.RESPONDER;
  if (Object.values(ROLES).includes(r)) return r;
  return ROLES.USER;
}

function requiresDepartmentId(role) {
  return role === ROLES.DEPARTMENT_HEAD || role === ROLES.DEPARTMENT_ADMIN || role === ROLES.USER || role === ROLES.RESPONDER;
}

async function ensureFieldResponderProfile(user, departmentId) {
  try {
    await pool.query('UPDATE users SET responder_online = TRUE WHERE user_id = $1', [user.user_id]);
  } catch (_) {}
  const existing = await pool.query('SELECT responder_id FROM responders WHERE user_id = $1 LIMIT 1', [user.user_id]);
  if (existing.rows[0]) return;
  let organization = null;
  if (departmentId) {
    try {
      const dept = await Department.findById(departmentId);
      organization = dept?.name || null;
    } catch (_) {}
  }
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Responder ${user.user_id}`;
  await Responder.create({
    name,
    organization,
    contact_number: user.phone_number || null,
    availability_status: 'available',
    source_type: 'account',
    user_id: user.user_id,
  });
}

const adminController = {
  /**
   * List all users (with pagination)
   * GET /api/admin/users
   */
  async listUsers(req, res) {
    try {
      const { page = 1, limit = 20, exclude_role } = req.query;
      const safePage = Math.max(1, parseInt(page, 10) || 1);
      const rawLimit = parseInt(limit, 10) || 20;
      const computedOffset = (safePage - 1) * Math.min(rawLimit, 100);
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, computedOffset);

      const options = {};
      if (typeof exclude_role === 'string' && exclude_role.trim() !== '') {
        options.excludeRole = exclude_role.split(',').map((r) => r.trim()).filter(Boolean);
      }

      const result = await User.getPaginated(validatedOffset, validatedLimit, options);

      // Remove password hashes from response
      const users = result.users.map(user => ({
        ...user,
        password: undefined
      }));

      await logAdminAction(req, 'users_list', 'user', null, {
        page,
        limit: validatedLimit,
        total: result.total,
        exclude_role: options.excludeRole || null
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
   * Body: email, password, first_name, last_name, role, department_id (required when role is department-head or department-admin)
   */
  async createUser(req, res) {
    try {
      const { email, phone_number, first_name, last_name, password, role, department_id } = req.body;

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

      // Normalize role (aliases → canonical) then validate
      const effectiveRole = normalizeRoleForAdmin(role);
      if (!Object.values(ROLES).includes(effectiveRole)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` });
      }

      // department_id required for department-head, department-admin, and user (Personnel)
      if (requiresDepartmentId(effectiveRole)) {
        if (department_id == null || department_id === '' || isNaN(parseInt(department_id, 10))) {
          return res.status(400).json({ error: 'department_id is required for department-head, department-admin, user (Personnel), and responder roles' });
        }
      }

      if (effectiveRole === ROLES.RESPONDER && !phone_number) {
        return res.status(400).json({ error: 'phone_number is required for field responder accounts (mobile login)' });
      }

      // Validate and normalize phone if provided (stored as 09XXXXXXXXX)
      let normalizedPhone = null;
      if (phone_number) {
        try {
          normalizedPhone = validatePhone(String(phone_number));
        } catch (err) {
          return res.status(400).json({ error: err.message || 'Invalid phone number format' });
        }
      }

      // Check if email already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Check if phone already exists (if provided)
      if (normalizedPhone) {
        const existingPhone = await User.findByPhone(normalizedPhone);
        if (existingPhone) {
          return res.status(409).json({ error: 'Phone number already exists' });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      const departmentIdValue = requiresDepartmentId(effectiveRole)
        ? parseInt(department_id, 10)
        : null;

      const newUser = await User.create({
        email,
        phone_number: normalizedPhone,
        first_name: validateOptionalString(first_name, 'first_name', 100),
        last_name: validateOptionalString(last_name, 'last_name', 100),
        password: passwordHash,
        role: effectiveRole,
        department_id: departmentIdValue
      });

      if (effectiveRole === ROLES.RESPONDER) {
        await ensureFieldResponderProfile(newUser, departmentIdValue);
      }

      // Remove password from response
      newUser.password = undefined;

      await logAdminAction(req, 'user_create', 'user', newUser.user_id, {
        email,
        phone_number: normalizedPhone,
        role: effectiveRole,
        department_id: departmentIdValue
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
   * Update user role (and department_id when role is department-head or department-admin), and optional first_name, last_name
   * PUT /api/admin/users/:id/role
   * Body: { role, department_id (required when role is department-head or department-admin), first_name?, last_name? }
   */
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role: roleParam, department_id, first_name: first_nameParam, last_name: last_nameParam, phone_number } = req.body;

      // Validate ID format
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      // Normalize role (aliases → canonical) then validate
      if (roleParam == null || String(roleParam).trim() === '') {
        return res.status(400).json({ error: 'role is required' });
      }
      const role = normalizeRoleForAdmin(roleParam);
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` });
      }

      // department_id required for department-head, department-admin, and user (Personnel)
      if (requiresDepartmentId(role)) {
        if (department_id == null || department_id === '' || isNaN(parseInt(department_id, 10))) {
          return res.status(400).json({ error: 'department_id is required for department-head, department-admin, user (Personnel), and responder roles' });
        }
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

      if (role === ROLES.RESPONDER) {
        let phone = user.phone_number;
        if (phone_number) {
          try {
            phone = validatePhone(String(phone_number));
          } catch (err) {
            return res.status(400).json({ error: err.message || 'Invalid phone number format' });
          }
          await pool.query('UPDATE users SET phone_number = $1 WHERE user_id = $2', [phone, user.user_id]);
          user.phone_number = phone;
        }
        if (!user.phone_number) {
          return res.status(400).json({ error: 'phone_number is required before promoting a user to field responder' });
        }
      }

      const oldRole = user.role;
      const userId = parseInt(id, 10);
      const departmentIdValue = requiresDepartmentId(role)
        ? parseInt(department_id, 10)
        : null;

      const first_nameValidated = (first_nameParam !== undefined && first_nameParam !== null && String(first_nameParam).trim() !== '')
        ? validateOptionalString(first_nameParam, 'first_name', 100)
        : null;
      const first_name = first_nameValidated !== null ? first_nameValidated : (user.first_name ?? null);
      const last_nameValidated = (last_nameParam !== undefined && last_nameParam !== null && String(last_nameParam).trim() !== '')
        ? validateOptionalString(last_nameParam, 'last_name', 100)
        : null;
      const last_name = last_nameValidated !== null ? last_nameValidated : (user.last_name ?? null);

      const updatedUser = await User.updateRoleDepartmentAndName(userId, role, departmentIdValue, first_name, last_name);
      updatedUser.password = undefined;

      if (role === ROLES.RESPONDER) {
        await ensureFieldResponderProfile(updatedUser, departmentIdValue);
      }

      await logAdminAction(req, 'user_role_update', 'user', user.user_id, {
        user_id: userId,
        old_role: oldRole,
        new_role: role,
        department_id: departmentIdValue
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
