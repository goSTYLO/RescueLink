const Department = require('../models/department');
const User = require('../models/user');
const {
  validateInteger,
  validateString,
  validateOptionalString,
  validateAllowedValue,
} = require('../utils/validation');
const { ROLES } = require('../config/roles');

function toDepartmentCode(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40) || `dept-${Date.now()}`;
}

function normalizeDepartmentPayload(body = {}) {
  return {
    name: validateString(body.name, 'name', 2, 150),
    type: validateString(body.type || 'Community', 'type', 2, 50),
    color: validateOptionalString(body.color, 'color', 30) || 'gray',
    status: validateAllowedValue(body.status, ['active', 'inactive'], 'status') || 'active',
  };
}

function normalizeUnitPayload(body = {}) {
  return {
    name: validateString(body.name, 'name', 2, 150),
    type: validateOptionalString(body.type, 'type', 100),
    status: validateOptionalString(body.status, 'status', 50) || 'Available',
    maintenance_status: validateOptionalString(body.maintenance_status, 'maintenance_status', 50) || 'Operational',
    last_maintenance: body.last_maintenance || null,
    next_maintenance: body.next_maintenance || null,
    maintenance_notes: validateOptionalString(body.maintenance_notes, 'maintenance_notes', 2000),
    active_task_count: body.active_task_count != null ? validateInteger(body.active_task_count, 'active_task_count') : 0,
  };
}

function normalizePersonnelPayload(body = {}) {
  let parsedSkills = [];
  if (Array.isArray(body.special_skills)) {
    parsedSkills = body.special_skills
      .map((skill) => String(skill || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  const certifications = Array.isArray(body.certifications) ? body.certifications : [];

  return {
    unit_id: body.unit_id != null && body.unit_id !== '' ? validateInteger(body.unit_id, 'unit_id') : null,
    name: validateString(body.name, 'name', 2, 150),
    role: validateOptionalString(body.role, 'role', 100),
    status: validateOptionalString(body.status, 'status', 50) || 'Available',
    special_skills: parsedSkills,
    certifications,
  };
}

const departmentController = {
  async getAll(req, res) {
    try {
      const rows = await Department.findAll();
      const withMetrics = await Promise.all(
        rows.map(async (row) => {
          const metrics = await Department.getMetrics(row.department_id);
          return {
            ...row,
            available_units: metrics?.available_units ?? 0,
            active_incidents: metrics?.active_incidents ?? 0,
          };
        })
      );
      res.json(withMetrics);
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getById(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }
      // Department admin and department head may only access their own department
      const deptRole = req.user.role === ROLES.DEPARTMENT_ADMIN || req.user.role === ROLES.DEPARTMENT_HEAD;
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null || fullUser.department_id !== departmentId) {
          return res.status(403).json({ error: 'Forbidden. You can only access your own department.' });
        }
      }
      res.json(department);
    } catch (error) {
      console.error('Error fetching department:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      const body = req.body || {};
      const payload = normalizeDepartmentPayload(body);
      const created = await Department.create({
        ...payload,
        code: toDepartmentCode(payload.name),
      });

      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating department:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      if (String(error.message || '').toLowerCase().includes('duplicate') || String(error.detail || '').includes('already exists')) {
        return res.status(409).json({ error: 'Department name or code already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async update(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const payload = normalizeDepartmentPayload(req.body);

      const updated = await Department.update(departmentId, payload);
      if (!updated) {
        return res.status(404).json({ error: 'Department not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating department:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async remove(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const removed = await Department.delete(departmentId);
      if (!removed) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json({ message: 'Department deleted successfully', department: removed });
    } catch (error) {
      console.error('Error deleting department:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async metrics(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const metrics = await Department.getMetrics(departmentId);
      if (!metrics) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching department metrics:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async listUnits(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const deptRole = req.user.role === ROLES.DEPARTMENT_ADMIN || req.user.role === ROLES.DEPARTMENT_HEAD;
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null || fullUser.department_id !== departmentId) {
          return res.status(403).json({ error: 'You can only manage units for your own department.' });
        }
      }
      const rows = await Department.listUnits(departmentId);
      res.json(rows);
    } catch (error) {
      console.error('Error listing units:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createUnit(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      if (req.user.role === ROLES.DEPARTMENT_ADMIN && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null || fullUser.department_id !== departmentId) {
          return res.status(403).json({ error: 'You can only manage units for your own department.' });
        }
      }
      const payload = normalizeUnitPayload(req.body);
      const created = await Department.createUnit(departmentId, payload);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating unit:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateUnit(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const unitId = validateInteger(req.params.unitId, 'unit_id');
      const payload = normalizeUnitPayload(req.body);
      const updated = await Department.updateUnit(departmentId, unitId, payload);
      if (!updated) {
        return res.status(404).json({ error: 'Unit not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating unit:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async assignUnit(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const unitId = validateInteger(req.params.unitId, 'unit_id');
      const reportId = validateInteger(req.body.report_id, 'report_id');
      if (req.user.role === ROLES.DEPARTMENT_ADMIN && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null || fullUser.department_id !== departmentId) {
          return res.status(403).json({ error: 'You can only assign units for your own department.' });
        }
      }
      const usage = await Department.recordUnitUsageForIncident(reportId, unitId, departmentId);
      if (!usage) {
        return res.status(404).json({ error: 'Unit not found' });
      }
      res.status(201).json(usage);
    } catch (error) {
      console.error('Error assigning unit:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteUnit(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const unitId = validateInteger(req.params.unitId, 'unit_id');
      const deleted = await Department.deleteUnit(departmentId, unitId);
      if (!deleted) {
        return res.status(404).json({ error: 'Unit not found' });
      }
      res.json({ message: 'Unit deleted successfully', unit: deleted });
    } catch (error) {
      console.error('Error deleting unit:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async listPersonnel(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const rows = await Department.listPersonnel(departmentId);
      res.json(rows);
    } catch (error) {
      console.error('Error listing personnel:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createPersonnel(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const payload = normalizePersonnelPayload(req.body);
      const created = await Department.createPersonnel(departmentId, payload);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating personnel:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updatePersonnel(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const personnelId = validateInteger(req.params.personnelId, 'personnel_id');
      const payload = normalizePersonnelPayload(req.body);
      const updated = await Department.updatePersonnel(departmentId, personnelId, payload);
      if (!updated) {
        return res.status(404).json({ error: 'Personnel not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating personnel:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deletePersonnel(req, res) {
    try {
      const departmentId = validateInteger(req.params.id, 'department_id');
      const personnelId = validateInteger(req.params.personnelId, 'personnel_id');
      const deleted = await Department.deletePersonnel(departmentId, personnelId);
      if (!deleted) {
        return res.status(404).json({ error: 'Personnel not found' });
      }
      res.json({ message: 'Personnel deleted successfully', personnel: deleted });
    } catch (error) {
      console.error('Error deleting personnel:', error);
      if (error.message.includes('must')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = departmentController;
