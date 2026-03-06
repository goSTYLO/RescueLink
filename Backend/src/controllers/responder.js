const Responder = require('../models/responder');
const { validateInteger, validateString, validateOptionalString, validatePagination, validateAllowedValue } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');

const RESOLVER_STATUSES = ['available', 'standby', 'busy', 'off-duty'];
const INCIDENT_TASK_TYPES = ['fire', 'medical', 'police', 'disaster'];

function normalizeTaskTypes(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((entry) => String(entry || '').trim().toLowerCase())
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
      const responders = await Responder.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        organization: organization ? validateString(organization, 'organization', 1, 150) : null,
        availability_status: availability_status ? validateString(availability_status, 'availability_status', 1, 50) : null,
        source_type: source_type ? validateAllowedValue(source_type, ['account', 'directory'], 'source_type') : null,
        team_name: team_name ? validateString(team_name, 'team_name', 1, 150) : null,
        incident_type: incident_type ? validateAllowedValue(String(incident_type).toLowerCase(), INCIDENT_TASK_TYPES, 'incident_type') : null,
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
};

module.exports = responderController;
