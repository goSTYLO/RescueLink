const Responder = require('../models/responder');
const User = require('../models/user');
const Department = require('../models/department');
const pool = require('../config/db');
const { validateInteger, validateString, validateOptionalString, validatePagination, validateAllowedValue } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');
const { ROLES } = require('../config/roles');

const RESOLVER_STATUSES = ['available', 'standby', 'busy', 'off-duty'];
const INCIDENT_TASK_TYPES = ['fire', 'medical', 'police', 'disaster'];

function normalizeTaskType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const collapsed = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (['natural disaster', 'typhoon', 'flood', 'earthquake', 'landslide', 'storm surge', 'volcanic eruption', 'disaster', 'calamity'].includes(collapsed)) return 'disaster';
  if (['crime', 'robbery', 'theft', 'assault', 'violence', 'homicide', 'shooting', 'stabbing', 'police', 'law enforcement'].includes(collapsed)) return 'police';
  if (['accident', 'vehicular accident', 'road accident', 'traffic accident', 'collision', 'injury', 'trauma', 'medical emergency', 'emergency medical', 'medical', 'first aid'].includes(collapsed)) return 'medical';
  if (['fire', 'blaze', 'structural fire', 'wildfire'].includes(collapsed)) return 'fire';
  return normalized;
}

function normalizeTaskTypes(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((entry) => normalizeTaskType(entry))
      .filter((entry) => INCIDENT_TASK_TYPES.includes(entry))
  )];
}

const responderController = {
  async create(req, res) {
    try {
      const { name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const validatedName = validateString(name, 'name', 1, 150);
      const validatedOrganization = validateOptionalString(organization, 'organization', 150);
      const validatedContactNumber = validateOptionalString(contact_number, 'contact_number', 20);
      const validatedAvailabilityStatus = validateAllowedValue(
        String(availability_status || 'available').toLowerCase(),
        RESOLVER_STATUSES,
        'availability_status'
      );
      const validatedSourceType = validateAllowedValue(source_type, ['account', 'directory'], 'source_type') || 'account';
      const validatedTeamName = validateOptionalString(team_name, 'team_name', 150);
      const normalizedTaskTypes = normalizeTaskTypes(supported_incident_types);

      const responder = await Responder.create({
        name: validatedName,
        organization: validatedOrganization,
        contact_number: validatedContactNumber,
        availability_status: validatedAvailabilityStatus,
        source_type: validatedSourceType,
        team_name: validatedTeamName,
        supported_incident_types: normalizedTaskTypes,
      });

      await logDispatcherAction(req, 'responder_create', 'responder', responder.responder_id, {
        name: validatedName,
        supported_incident_types: normalizedTaskTypes,
      });
      res.status(201).json(responder);
    } catch (error) {
      console.error('Error creating responder:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getById(req, res) {
    try {
      const validatedId = validateInteger(req.params.id, 'responder ID');
      const responder = await Responder.findById(validatedId);
      if (!responder) return res.status(404).json({ error: 'Responder not found' });
      res.json(responder);
    } catch (error) {
      console.error('Error fetching responder:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getAll(req, res) {
    try {
      const { limit, offset, organization, availability_status, source_type, team_name, incident_type } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      const normalizedIncidentType = incident_type ? normalizeTaskType(incident_type) : null;
      const responders = await Responder.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        organization: organization ? validateString(organization, 'organization', 1, 150) : null,
        availability_status: availability_status ? validateString(availability_status, 'availability_status', 1, 50) : null,
        source_type: source_type ? validateAllowedValue(source_type, ['account', 'directory'], 'source_type') : null,
        team_name: team_name ? validateString(team_name, 'team_name', 1, 150) : null,
        incident_type: normalizedIncidentType && INCIDENT_TASK_TYPES.includes(normalizedIncidentType) ? normalizedIncidentType : null,
      });
      res.json(responders);
    } catch (error) {
      console.error('Error fetching responders:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async update(req, res) {
    try {
      const validatedId = validateInteger(req.params.id, 'responder ID');
      const { name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types } = req.body;
      if (!name || organization === undefined || contact_number === undefined || availability_status === undefined) {
        return res.status(400).json({ error: 'Full update required: name, organization, contact_number, and availability_status must be provided' });
      }
      const existing = await Responder.findById(validatedId);
      if (!existing) return res.status(404).json({ error: 'Responder not found' });

      const updated = await Responder.update(validatedId, {
        name: validateString(name, 'name', 1, 150),
        organization: validateOptionalString(organization, 'organization', 150),
        contact_number: validateOptionalString(contact_number, 'contact_number', 20),
        availability_status: validateAllowedValue(String(availability_status || '').toLowerCase(), RESOLVER_STATUSES, 'availability_status'),
        source_type: validateAllowedValue(source_type, ['account', 'directory'], 'source_type') || 'account',
        team_name: validateOptionalString(team_name, 'team_name', 150),
        supported_incident_types: normalizeTaskTypes(supported_incident_types),
      });

      await logDispatcherAction(req, 'responder_update', 'responder', validatedId, { name: updated?.name || null });
      res.json(updated);
    } catch (error) {
      console.error('Error updating responder:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateStatus(req, res) {
    try {
      const validatedId = validateInteger(req.params.id, 'responder ID');
      const status = validateAllowedValue(String(req.body?.availability_status || '').toLowerCase(), RESOLVER_STATUSES, 'availability_status');
      const updated = await Responder.updateStatus(validatedId, status);
      if (!updated) return res.status(404).json({ error: 'Responder not found' });

      await logDispatcherAction(req, 'responder_status_update', 'responder', validatedId, { availability_status: status });
      res.json(updated);
    } catch (error) {
      console.error('Error updating responder status:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async delete(req, res) {
    try {
      const validatedId = validateInteger(req.params.id, 'responder ID');
      const deleted = await Responder.delete(validatedId);
      if (!deleted) return res.status(404).json({ error: 'Responder not found' });
      await logDispatcherAction(req, 'responder_delete', 'responder', validatedId, { name: deleted.name });
      res.json({ message: 'Responder deleted successfully', responder: deleted });
    } catch (error) {
      console.error('Error deleting responder:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async createTeam(req, res) {
    try {
      const departmentCode = validateString(req.body?.department_code, 'department_code', 1, 40).toLowerCase();
      // Department admin may only create teams for their own department
      if (req.user.role === ROLES.DEPARTMENT_ADMIN && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null) {
          return res.status(403).json({ error: 'Forbidden. Department admin must be assigned to a department to create teams.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        if (!dept || !dept.code || String(dept.code).toLowerCase() !== departmentCode) {
          return res.status(403).json({ error: 'Forbidden. You can only create teams for your own department.' });
        }
      }
      const teamName = validateString(req.body?.team_name, 'team_name', 1, 150);
      const teamStatus = validateAllowedValue(String(req.body?.team_status || 'available').toLowerCase(), RESOLVER_STATUSES, 'team_status');
      const team = await Responder.createTeam({
        department_code: departmentCode,
        team_name: teamName,
        team_status: teamStatus,
        supported_incident_types: normalizeTaskTypes(req.body?.supported_incident_types),
      });
      await logDispatcherAction(req, 'responder_team_create', 'responder_team', team.team_id, { department_code: departmentCode, team_name: teamName });
      res.status(201).json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async listTeams(req, res) {
    try {
      const { limit, offset, department_code } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      const teams = await Responder.listTeams({
        limit: validatedLimit,
        offset: validatedOffset,
        department_code: department_code ? validateString(department_code, 'department_code', 1, 40) : null,
      });
      res.json(teams);
    } catch (error) {
      console.error('Error listing teams:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getTeamById(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const team = await Responder.findTeamById(teamId);
      if (!team) return res.status(404).json({ error: 'Team not found' });
      res.json(team);
    } catch (error) {
      console.error('Error fetching team:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateTeam(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const existing = await Responder.findTeamById(teamId);
      if (!existing) return res.status(404).json({ error: 'Team not found' });
      // Department admin may only update teams in their own department
      if (req.user.role === ROLES.DEPARTMENT_ADMIN && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null) {
          return res.status(403).json({ error: 'Forbidden. Department admin must be assigned to a department to update teams.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        const existingCode = String(existing.department_code || '').toLowerCase();
        if (!dept || !dept.code || existingCode !== String(dept.code).toLowerCase()) {
          return res.status(403).json({ error: 'Forbidden. You can only update teams in your own department.' });
        }
      }
      const updated = await Responder.updateTeam(teamId, {
        team_name: validateString(req.body?.team_name, 'team_name', 1, 150),
        team_status: validateAllowedValue(String(req.body?.team_status || 'available').toLowerCase(), RESOLVER_STATUSES, 'team_status'),
        supported_incident_types: normalizeTaskTypes(req.body?.supported_incident_types),
      });
      await logDispatcherAction(req, 'responder_team_update', 'responder_team', teamId, { team_name: updated?.team_name || null });
      res.json(updated);
    } catch (error) {
      console.error('Error updating team:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateTeamStatus(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const teamStatus = validateAllowedValue(String(req.body?.team_status || '').toLowerCase(), RESOLVER_STATUSES, 'team_status');
      const updated = await Responder.updateTeamStatus(teamId, teamStatus);
      if (!updated) return res.status(404).json({ error: 'Team not found' });
      await logDispatcherAction(req, 'responder_team_status_update', 'responder_team', teamId, { team_status: teamStatus });
      res.json(updated);
    } catch (error) {
      console.error('Error updating team status:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteTeam(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const deleted = await Responder.deleteTeam(teamId);
      if (!deleted) return res.status(404).json({ error: 'Team not found' });
      await logDispatcherAction(req, 'responder_team_delete', 'responder_team', teamId, { team_name: deleted.team_name });
      res.json({ message: 'Team deleted successfully', team: deleted });
    } catch (error) {
      console.error('Error deleting team:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addTeamMember(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const responderId = validateInteger(req.body?.responder_id, 'responder ID');
      const member = await Responder.addTeamMember(teamId, responderId);
      await logDispatcherAction(req, 'responder_team_member_add', 'responder_team', teamId, { responder_id: responderId });
      res.status(201).json(member || { team_id: teamId, responder_id: responderId });
    } catch (error) {
      console.error('Error adding team member:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async removeTeamMember(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const responderId = validateInteger(req.params.responderId, 'responder ID');
      await Responder.removeTeamMember(teamId, responderId);
      await logDispatcherAction(req, 'responder_team_member_remove', 'responder_team', teamId, { responder_id: responderId });
      res.json({ message: 'Team member removed' });
    } catch (error) {
      console.error('Error removing team member:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async listTeamMembers(req, res) {
    try {
      const teamId = validateInteger(req.params.teamId, 'team ID');
      const members = await Responder.listTeamMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error('Error listing team members:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ── Phase 3: Responder self-service ──────────────────────────────

  /** PATCH /api/responders/me/online-status — toggle responder availability */
  async updateOnlineStatus(req, res) {
    try {
      const userId = req.user.user_id;
      const { online } = req.body;
      if (typeof online !== 'boolean') {
        return res.status(400).json({ error: '"online" must be a boolean.' });
      }
      await pool.query(
        'UPDATE users SET responder_online = $1 WHERE user_id = $2',
        [online, userId]
      );
      res.json({ online, user_id: userId });
    } catch (err) {
      console.error('updateOnlineStatus error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },

  /** GET /api/responders/me/profile — get own responder profile */
  async getSelfProfile(req, res) {
    try {
      const userId = req.user.user_id;
      const row = await pool.query(
        `SELECT u.user_id, u.first_name, u.last_name, u.phone_number, u.address,
                u.responder_online, u.latitude, u.longitude,
                r.responder_id, r.organization, r.availability_status,
                r.team_name, r.supported_incident_types
           FROM users u
           LEFT JOIN responders r ON r.user_id = u.user_id
          WHERE u.user_id = $1`,
        [userId]
      );
      if (!row.rows[0]) return res.status(404).json({ error: 'Responder profile not found.' });
      res.json(row.rows[0]);
    } catch (err) {
      console.error('getSelfProfile error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  },
};

module.exports = responderController;
