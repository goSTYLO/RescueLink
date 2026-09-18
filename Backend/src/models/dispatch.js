const pool = require('../config/db');
const Responder = require('./responder');

function normalizeResponseStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return {
    assigned: 'Assigned',
    'en route': 'En Route',
    'on scene': 'On Scene',
    resolved: 'Resolved',
  }[key] || value;
}

const Dispatch = {
  async create({
    report_id,
    responder_id,
    response_status = null,
    assignment_group_id = null,
    department_code = null,
    department_name = null,
    team_name = null,
    default_department_code = null,
    was_default_department = null,
    responder_source = 'account',
    responder_name = null,
    assigned_by_user_id = null,
  }) {
    try {
      const res = await pool.query(
        `INSERT INTO dispatches(
           report_id, responder_id, response_status, assignment_group_id, department_code, department_name,
           team_name, default_department_code, was_default_department, responder_source, responder_name, assigned_by_user_id
         ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          report_id,
          responder_id,
          normalizeResponseStatus(response_status),
          assignment_group_id,
          department_code,
          department_name,
          team_name,
          default_department_code,
          was_default_department,
          responder_source,
          responder_name,
          assigned_by_user_id,
        ]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /assignment_group_id|department_code|responder_source|assigned_by_user_id/i.test(error.message)) {
        const fallback = await pool.query(
          'INSERT INTO dispatches(report_id, responder_id, response_status) VALUES($1, $2, $3) RETURNING *',
          [report_id, responder_id, normalizeResponseStatus(response_status)]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async findById(dispatch_id) {
    const res = await pool.query(
      'SELECT * FROM dispatches WHERE dispatch_id = $1',
      [dispatch_id]
    );
    return res.rows[0];
  },

  async findAll({
    limit = 20,
    offset = 0,
    report_id = null,
    responder_id = null,
    response_status = null,
    assignment_group_id = null,
    department_code = null,
  } = {}) {
    // Cap limit at 100
    const cappedLimit = Math.min(limit, 100);
    
    let query = 'SELECT * FROM dispatches WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (report_id) {
      paramCount++;
      query += ` AND report_id = $${paramCount}`;
      params.push(report_id);
    }

    if (responder_id) {
      paramCount++;
      query += ` AND responder_id = $${paramCount}`;
      params.push(responder_id);
    }

    if (response_status) {
      paramCount++;
      query += ` AND response_status = $${paramCount}`;
      params.push(response_status);
    }

    if (assignment_group_id) {
      paramCount++;
      query += ` AND assignment_group_id = $${paramCount}`;
      params.push(assignment_group_id);
    }

    if (department_code) {
      paramCount++;
      query += ` AND LOWER(department_code) = LOWER($${paramCount})`;
      params.push(department_code);
    }

    query += ` ORDER BY dispatched_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, offset);

    const res = await pool.query(query, params);
    return res.rows;
  },

  async createAssignmentGroup({
    report_id,
    department_code = null,
    department_name = null,
    team_name = null,
    default_department_code = null,
    was_default_department = null,
    responders = [],
    response_status = 'assigned',
    assignment_group_id,
    assigned_by_user_id = null,
  }) {
    const createdDispatches = [];
    for (const responderInput of responders) {
      const sourceType = String(responderInput?.source || 'account').toLowerCase() === 'directory' ? 'directory' : 'account';
      let responderId = responderInput?.responder_id ?? null;
      let responderName = null;

      if (sourceType === 'directory') {
        const directoryResponder = await Responder.findOrCreateDirectory({
          name: String(responderInput?.responder_name || responderInput?.name || '').trim(),
          organization: responderInput?.organization || department_name || null,
          contact_number: responderInput?.contact_number || null,
          team_name: responderInput?.team_name || team_name || null,
        });
        responderId = directoryResponder?.responder_id;
        responderName = directoryResponder?.name || null;
      } else {
        responderName = responderInput?.responder_name || null;
      }

      const dispatch = await this.create({
        report_id,
        responder_id: responderId,
        response_status,
        assignment_group_id,
        department_code,
        department_name,
        team_name,
        default_department_code,
        was_default_department,
        responder_source: sourceType,
        responder_name: responderName,
        assigned_by_user_id,
      });
      createdDispatches.push(dispatch);
      // Set assigned personnel status to busy so Personnel management shows them as busy
      if (responderId) {
        try {
          await Responder.updateStatus(responderId, 'busy');
        } catch (err) {
          console.error('Failed to update responder status to busy:', err.message);
        }
      }
    }
    // Set team status to busy when department + team are present
    if (createdDispatches.length > 0 && department_code && team_name) {
      try {
        const team = await Responder.findTeamByDepartmentAndName(department_code, team_name);
        if (team && team.team_id) {
          await Responder.updateTeamStatus(team.team_id, 'busy');
        }
      } catch (err) {
        console.error('Failed to update team status to busy:', err.message);
      }
    }
    return createdDispatches;
  },

  /**
   * Create a single department-only dispatch (no responder, no team).
   * Used when dispatcher notifies a department; department admin selects team later.
   */
  async createDepartmentOnly({
    report_id,
    department_code,
    department_name = null,
    default_department_code = null,
    was_default_department = null,
    response_status = 'assigned',
    assignment_group_id,
    assigned_by_user_id = null,
  }) {
    try {
      const res = await pool.query(
        `INSERT INTO dispatches(
           report_id, responder_id, response_status, assignment_group_id, department_code, department_name,
           team_name, default_department_code, was_default_department, responder_source, responder_name, assigned_by_user_id
         ) VALUES($1, NULL, $2, $3, $4, $5, NULL, $6, $7, 'account', NULL, $8) RETURNING *`,
        [
          report_id,
          response_status,
          assignment_group_id,
          department_code,
          department_name,
          default_department_code,
          was_default_department,
          assigned_by_user_id,
        ]
      );
      return res.rows[0];
    } catch (error) {
      const responderIdIsRequired = error.code === '23502' && /responder_id/i.test(error.message || '');
      if (!responderIdIsRequired) {
        throw error;
      }

      // Legacy schema fallback: create a directory responder placeholder for department-only assignment.
      const placeholder = await Responder.findOrCreateDirectory({
        name: `${department_name || String(department_code || 'Department').toUpperCase()} Duty Desk`,
        organization: department_name || String(department_code || 'Operations').toUpperCase(),
        contact_number: null,
        team_name: null,
      });

      return this.create({
        report_id,
        responder_id: placeholder?.responder_id,
        response_status,
        assignment_group_id,
        department_code,
        department_name,
        team_name: null,
        default_department_code,
        was_default_department,
        responder_source: 'directory',
        responder_name: placeholder?.name || null,
        assigned_by_user_id,
      });
    }
  },

  async createAutoAssignmentGroup({
    report_id,
    department_code,
    department_name = null,
    team_name,
    incident_type = null,
    default_department_code = null,
    was_default_department = null,
    response_status = 'assigned',
    assignment_group_id,
    assigned_by_user_id = null,
  }) {
    const eligibleResponders = await Responder.findEligibleByTeam({
      department_code,
      team_name,
      incident_type,
      limit: 100,
    });

    if (!Array.isArray(eligibleResponders) || eligibleResponders.length === 0) {
      return {
        dispatches: [],
        assignment_summary: {
          requested_department_code: department_code || null,
          requested_team_name: team_name || null,
          requested_incident_type: incident_type || null,
          attempted_count: 0,
          assigned_count: 0,
          unassigned_reason: 'no_available_team_members',
        },
      };
    }

    const responders = eligibleResponders.map((responder) => ({
      source: responder.source_type || 'account',
      responder_id: responder.responder_id,
      responder_name: responder.name || null,
      team_name: responder.team_name || team_name || null,
    }));

    const dispatches = await this.createAssignmentGroup({
      report_id,
      department_code,
      department_name,
      team_name,
      default_department_code,
      was_default_department,
      responders,
      response_status,
      assignment_group_id,
      assigned_by_user_id,
    });

    // Set team status to busy when assignment succeeded
    if (dispatches.length > 0 && department_code && team_name) {
      try {
        const team = await Responder.findTeamByDepartmentAndName(department_code, team_name);
        if (team && team.team_id) {
          await Responder.updateTeamStatus(team.team_id, 'busy');
        }
      } catch (err) {
        console.error('Failed to update team status to busy:', err.message);
      }
    }

    return {
      dispatches,
      assignment_summary: {
        requested_department_code: department_code || null,
        requested_team_name: team_name || null,
        requested_incident_type: incident_type || null,
        attempted_count: responders.length,
        assigned_count: dispatches.length,
        unassigned_reason: null,
      },
    };
  },

  async update(dispatch_id, {
    report_id,
    responder_id,
    response_status,
    estimated_eta_minutes = null,
    estimated_arrival_at = null,
    actual_arrival_at = null,
  }) {
    const res = await pool.query(
      'UPDATE dispatches SET report_id = $1, responder_id = $2, response_status = $3, estimated_eta_minutes = $4, estimated_arrival_at = $5, actual_arrival_at = $6 WHERE dispatch_id = $7 RETURNING *',
      [report_id, responder_id, response_status, estimated_eta_minutes, estimated_arrival_at, actual_arrival_at, dispatch_id]
    );
    return res.rows[0];
  },

  async delete(dispatch_id) {
    const res = await pool.query(
      'DELETE FROM dispatches WHERE dispatch_id = $1 RETURNING *',
      [dispatch_id]
    );
    return res.rows[0];
  },

  // Helper to check if report exists
  async reportExists(report_id) {
    const res = await pool.query(
      'SELECT 1 FROM incident_reports WHERE report_id = $1',
      [report_id]
    );
    return res.rows.length > 0;
  },

  async getIncidentType(report_id) {
    const res = await pool.query(
      'SELECT incident_type FROM incident_reports WHERE report_id = $1 LIMIT 1',
      [report_id]
    );
    return res.rows?.[0]?.incident_type ? String(res.rows[0].incident_type).toLowerCase() : null;
  },

  async countByReportId(report_id) {
    const res = await pool.query(
      'SELECT COUNT(*)::int AS total FROM dispatches WHERE report_id = $1',
      [report_id]
    );
    return Number(res.rows?.[0]?.total || 0);
  },

  // Helper to check if responder exists
  async responderExists(responder_id) {
    const res = await pool.query(
      'SELECT 1 FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    return res.rows.length > 0;
  },

  isEscalationSource(row) {
    return String(row?.responder_source || '').toLowerCase() === 'escalation';
  },

  hasTeamName(row) {
    return String(row?.team_name || '').trim() !== '';
  },

  async findPrimaryTeamDispatches(report_id) {
    const rows = await this.findAll({ report_id, limit: 200, offset: 0 });
    return (rows || []).filter((row) => this.hasTeamName(row) && !this.isEscalationSource(row));
  },

  async hasPrimaryTeamAssignment(report_id) {
    const rows = await this.findPrimaryTeamDispatches(report_id);
    return rows.length > 0;
  },

  async getPrimaryTeamDepartment(report_id) {
    const rows = await this.findPrimaryTeamDispatches(report_id);
    const code = rows[0]?.department_code;
    return code ? String(code).trim().toLowerCase() : null;
  },

  async departmentHasDispatch(report_id, department_code) {
    const rows = await this.findAll({ report_id, department_code, limit: 20, offset: 0 });
    return Array.isArray(rows) && rows.length > 0;
  },

  async departmentHasTeam(report_id, department_code) {
    const rows = await this.findAll({ report_id, department_code, limit: 50, offset: 0 });
    return (rows || []).some((row) => this.hasTeamName(row));
  },

  async isAssistingDepartment(report_id, department_code) {
    const rows = await this.findAll({ report_id, department_code, limit: 50, offset: 0 });
    return (rows || []).some((row) => this.isEscalationSource(row));
  },

  async updateResponseStatus(dispatch_id, response_status) {
    const onScene = String(response_status || '').trim().toLowerCase() === 'on scene';
    const sql = onScene
      ? `UPDATE dispatches SET response_status = $1, actual_arrival_at = COALESCE(actual_arrival_at, CURRENT_TIMESTAMP) WHERE dispatch_id = $2 RETURNING *`
      : 'UPDATE dispatches SET response_status = $1 WHERE dispatch_id = $2 RETURNING *';
    const res = await pool.query(sql, [response_status, dispatch_id]);
    return res.rows[0] || null;
  },

  async findByReportAndUser(report_id, user_id) {
    const res = await pool.query(
      `SELECT d.*
         FROM dispatches d
         INNER JOIN responders r ON r.responder_id = d.responder_id
        WHERE d.report_id = $1 AND r.user_id = $2
        ORDER BY d.dispatched_at DESC
        LIMIT 1`,
      [report_id, user_id]
    );
    return res.rows[0] || null;
  },

  async findAssignedIncidentsForUser(user_id, { limit = 50, offset = 0 } = {}) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const res = await pool.query(
      `SELECT DISTINCT ON (ir.report_id) ir.*, d.team_name AS assigned_team_name,
              d.department_code AS assigned_department_code, d.response_status AS my_response_status,
              d.dispatch_id AS my_dispatch_id
         FROM dispatches d
         INNER JOIN responders r ON r.responder_id = d.responder_id
         INNER JOIN incident_reports ir ON ir.report_id = d.report_id
        WHERE r.user_id = $1
          AND COALESCE(d.team_name, '') <> ''
        ORDER BY ir.report_id, d.dispatched_at DESC
        LIMIT $2 OFFSET $3`,
      [user_id, cappedLimit, Number(offset) || 0]
    );
    return res.rows;
  },

  async releaseTeamAssignment(report_id, department_code = null) {
    const rows = department_code
      ? await this.findAll({ report_id, department_code, limit: 200, offset: 0 })
      : await this.findPrimaryTeamDispatches(report_id);
    const teamRows = (rows || []).filter((row) => this.hasTeamName(row));
    const seenTeams = new Set();
    const deleted = [];

    for (const row of teamRows) {
      const key = `${String(row.department_code || '').toLowerCase()}::${String(row.team_name || '').toLowerCase()}`;
      if (!seenTeams.has(key) && row.department_code && row.team_name) {
        seenTeams.add(key);
        try {
          const team = await Responder.findTeamByDepartmentAndName(row.department_code, row.team_name);
          if (team?.team_id) await Responder.updateTeamStatus(team.team_id, 'available');
        } catch (err) {
          console.error('Failed to release team status:', err.message);
        }
      }
      if (row.responder_id) {
        try {
          await Responder.updateStatus(row.responder_id, 'available');
        } catch (err) {
          console.error('Failed to release responder status:', err.message);
        }
      }
      const removed = await this.delete(row.dispatch_id);
      if (removed) deleted.push(removed);
    }
    return deleted;
  },

  async deleteEscalationDispatches(report_id, department_code) {
    const res = await pool.query(
      `DELETE FROM dispatches
        WHERE report_id = $1
          AND LOWER(department_code) = LOWER($2)
          AND LOWER(COALESCE(responder_source, '')) = 'escalation'
        RETURNING *`,
      [report_id, department_code]
    );
    return res.rows;
  },
};

module.exports = Dispatch;
