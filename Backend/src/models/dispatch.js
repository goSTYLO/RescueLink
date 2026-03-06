const pool = require('../config/db');
const Responder = require('./responder');

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
          response_status,
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
          [report_id, responder_id, response_status]
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
      query += ` AND department_code = $${paramCount}`;
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
    }
    return createdDispatches;
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

  async update(dispatch_id, { report_id, responder_id, response_status }) {
    const res = await pool.query(
      'UPDATE dispatches SET report_id = $1, responder_id = $2, response_status = $3 WHERE dispatch_id = $4 RETURNING *',
      [report_id, responder_id, response_status, dispatch_id]
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

  // Helper to check if responder exists
  async responderExists(responder_id) {
    const res = await pool.query(
      'SELECT 1 FROM responders WHERE responder_id = $1',
      [responder_id]
    );
    return res.rows.length > 0;
  }
};

module.exports = Dispatch;
