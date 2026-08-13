const pool = require('../config/db');

function normalizeIncidentType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const collapsed = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (['natural disaster', 'typhoon', 'flood', 'earthquake', 'landslide', 'storm surge', 'volcanic eruption'].includes(collapsed)) return 'disaster';
  if (['disaster', 'calamity'].includes(collapsed)) return 'disaster';
  if (['crime', 'robbery', 'theft', 'assault', 'violence', 'homicide', 'shooting', 'stabbing'].includes(collapsed)) return 'police';
  if (['police', 'law enforcement'].includes(collapsed)) return 'police';
  if (['accident', 'vehicular accident', 'road accident', 'traffic accident', 'collision', 'injury', 'trauma', 'medical emergency', 'emergency medical'].includes(collapsed)) return 'medical';
  if (['medical', 'first aid'].includes(collapsed)) return 'medical';
  if (['fire', 'blaze', 'structural fire', 'wildfire'].includes(collapsed)) return 'fire';
  if (normalized === 'natural disaster' || normalized === 'natural-disaster') return 'disaster';
  if (normalized === 'crime') return 'police';
  if (normalized === 'other') return 'other';
  if (normalized === 'sos') return 'sos';
  return normalized;
}

function shouldBypassIncidentTypeFilter(incidentType) {
  return !incidentType || incidentType === 'other' || incidentType === 'sos';
}

function normalizeIncidentTypes(values) {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(['fire', 'medical', 'police', 'disaster']);
  return [...new Set(values
    .map((value) => normalizeIncidentType(value))
    .filter((value) => allowed.has(value)))];
}

const Responder = {
  async create({
    name,
    organization = null,
    contact_number = null,
    availability_status = null,
    source_type = 'account',
    team_name = null,
    supported_incident_types = [],
    user_id = null,
  }) {
    const normalizedTaskTypes = normalizeIncidentTypes(supported_incident_types);
    try {
      const res = await pool.query(
        `INSERT INTO responders(name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types, user_id)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, organization, contact_number, availability_status, source_type, team_name, normalizedTaskTypes, user_id]
      );
      return res.rows[0];
    } catch (error) {
      // Fallback for DBs without user_id column yet (pre-migration)
      if (error.code === '42703' && /user_id/i.test(error.message)) {
        const res2 = await pool.query(
          `INSERT INTO responders(name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types)
           VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [name, organization, contact_number, availability_status, source_type, team_name, normalizedTaskTypes]
        );
        return res2.rows[0];
      }
      if (error.code === '42703' || /source_type|team_name|supported_incident_types/i.test(error.message)) {
        const fallback = await pool.query(
          'INSERT INTO responders(name, organization, contact_number, availability_status) VALUES($1, $2, $3, $4) RETURNING *',
          [name, organization, contact_number, availability_status]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async findById(responder_id) {
    const res = await pool.query('SELECT * FROM responders WHERE responder_id = $1', [responder_id]);
    return res.rows[0];
  },

  async findAll({
    limit = 20,
    offset = 0,
    organization = null,
    availability_status = null,
    source_type = null,
    team_name = null,
    incident_type = null,
  } = {}) {
    const cappedLimit = Math.min(Number(limit) || 20, 100);
    const normalizedIncidentType = normalizeIncidentType(incident_type);

    let query = 'SELECT * FROM responders WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (organization) {
      paramCount++;
      query += ` AND organization = $${paramCount}`;
      params.push(organization);
    }
    if (availability_status) {
      paramCount++;
      query += ` AND availability_status = $${paramCount}`;
      params.push(availability_status);
    }
    if (source_type) {
      paramCount++;
      query += ` AND source_type = $${paramCount}`;
      params.push(source_type);
    }
    if (team_name) {
      paramCount++;
      query += ` AND team_name = $${paramCount}`;
      params.push(team_name);
    }
    if (normalizedIncidentType) {
      paramCount++;
      query += ` AND (COALESCE(array_length(supported_incident_types, 1), 0) = 0 OR $${paramCount} = ANY(supported_incident_types))`;
      params.push(normalizedIncidentType);
    }

    query += ` ORDER BY responder_id DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, Number(offset) || 0);

    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name|supported_incident_types/i.test(error.message)) {
        let fallbackQuery = 'SELECT * FROM responders WHERE 1=1';
        const fallbackParams = [];
        let fallbackCount = 0;
        if (organization) {
          fallbackCount++;
          fallbackQuery += ` AND organization = $${fallbackCount}`;
          fallbackParams.push(organization);
        }
        if (availability_status) {
          fallbackCount++;
          fallbackQuery += ` AND availability_status = $${fallbackCount}`;
          fallbackParams.push(availability_status);
        }
        if (team_name) {
          fallbackCount++;
          fallbackQuery += ` AND team_name = $${fallbackCount}`;
          fallbackParams.push(team_name);
        }
        fallbackQuery += ` ORDER BY responder_id DESC LIMIT $${fallbackCount + 1} OFFSET $${fallbackCount + 2}`;
        fallbackParams.push(cappedLimit, Number(offset) || 0);
        const fallback = await pool.query(fallbackQuery, fallbackParams);
        return fallback.rows;
      }
      throw error;
    }
  },

  async update(responder_id, { name, organization, contact_number, availability_status, source_type, team_name, supported_incident_types = [] }) {
    const normalizedTaskTypes = normalizeIncidentTypes(supported_incident_types);
    try {
      const res = await pool.query(
        `UPDATE responders
         SET name = $1, organization = $2, contact_number = $3, availability_status = $4, source_type = $5, team_name = $6, supported_incident_types = $7
         WHERE responder_id = $8 RETURNING *`,
        [name, organization, contact_number, availability_status, source_type, team_name, normalizedTaskTypes, responder_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name|supported_incident_types/i.test(error.message)) {
        const fallback = await pool.query(
          'UPDATE responders SET name = $1, organization = $2, contact_number = $3, availability_status = $4, team_name = $5 WHERE responder_id = $6 RETURNING *',
          [name, organization, contact_number, availability_status, team_name, responder_id]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async updateStatus(responder_id, availability_status) {
    const res = await pool.query(
      'UPDATE responders SET availability_status = $1 WHERE responder_id = $2 RETURNING *',
      [availability_status, responder_id]
    );
    return res.rows[0];
  },

  async findOrCreateDirectory({ name, organization = null, contact_number = null, team_name = null }) {
    let existing;
    try {
      existing = await pool.query(
        `SELECT *
         FROM responders
         WHERE source_type = 'directory'
           AND LOWER(name) = LOWER($1)
           AND COALESCE(LOWER(organization), '') = COALESCE(LOWER($2), '')
           AND COALESCE(LOWER(team_name), '') = COALESCE(LOWER($3), '')
         LIMIT 1`,
        [name, organization, team_name]
      );
    } catch (error) {
      if (error.code === '42703' || /source_type|team_name/i.test(error.message)) {
        existing = await pool.query(
          `SELECT *
           FROM responders
           WHERE LOWER(name) = LOWER($1)
             AND COALESCE(LOWER(organization), '') = COALESCE(LOWER($2), '')
           LIMIT 1`,
          [name, organization]
        );
      } else {
        throw error;
      }
    }
    if (existing.rows[0]) {
      return existing.rows[0];
    }
    return this.create({
      name,
      organization,
      contact_number,
      availability_status: 'Available',
      source_type: 'directory',
      team_name,
    });
  },

  async createTeam({ department_code, team_name, team_status = 'available', supported_incident_types = [] }) {
    const normalizedTaskTypes = normalizeIncidentTypes(supported_incident_types);
    try {
      const res = await pool.query(
        `INSERT INTO responder_teams(department_code, team_name, team_status, supported_incident_types)
         VALUES($1, $2, $3, $4)
         ON CONFLICT (department_code, team_name)
         DO UPDATE SET team_status = EXCLUDED.team_status, supported_incident_types = EXCLUDED.supported_incident_types
         RETURNING *`,
        [department_code, team_name, team_status, normalizedTaskTypes]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /team_status|supported_incident_types/i.test(error.message)) {
        const fallback = await pool.query(
          `INSERT INTO responder_teams(department_code, team_name)
           VALUES($1, $2)
           ON CONFLICT (department_code, team_name)
           DO UPDATE SET team_name = EXCLUDED.team_name
           RETURNING *`,
          [department_code, team_name]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async findTeamById(team_id) {
    const res = await pool.query('SELECT * FROM responder_teams WHERE team_id = $1', [team_id]);
    return res.rows[0];
  },

  async findTeamByDepartmentAndName(department_code, team_name) {
    if (!department_code || !team_name) return null;
    const res = await pool.query(
      'SELECT * FROM responder_teams WHERE LOWER(department_code) = LOWER($1) AND LOWER(team_name) = LOWER($2) LIMIT 1',
      [String(department_code).trim(), String(team_name).trim()]
    );
    return res.rows[0] || null;
  },

  async listTeams({ department_code = null, limit = 100, offset = 0 } = {}) {
    const cappedLimit = Math.min(Number(limit) || 100, 200);
    let query = 'SELECT * FROM responder_teams WHERE 1=1';
    const params = [];
    let paramCount = 0;
    if (department_code) {
      paramCount++;
      query += ` AND LOWER(department_code) = LOWER($${paramCount})`;
      params.push(department_code);
    }
    query += ` ORDER BY department_code ASC, team_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(cappedLimit, Number(offset) || 0);
    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (error) {
      if (error.code === '42P01' || /responder_teams/i.test(error.message)) {
        return [];
      }
      throw error;
    }
  },

  async updateTeam(team_id, { team_name, team_status, supported_incident_types = [] }) {
    const normalizedTaskTypes = normalizeIncidentTypes(supported_incident_types);
    try {
      const res = await pool.query(
        `UPDATE responder_teams
         SET team_name = $1, team_status = $2, supported_incident_types = $3
         WHERE team_id = $4 RETURNING *`,
        [team_name, team_status, normalizedTaskTypes, team_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /team_status|supported_incident_types/i.test(error.message)) {
        const fallback = await pool.query(
          'UPDATE responder_teams SET team_name = $1 WHERE team_id = $2 RETURNING *',
          [team_name, team_id]
        );
        return fallback.rows[0];
      }
      throw error;
    }
  },

  async updateTeamStatus(team_id, team_status) {
    try {
      const res = await pool.query(
        'UPDATE responder_teams SET team_status = $1 WHERE team_id = $2 RETURNING *',
        [team_status, team_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42703' || /team_status/i.test(error.message)) {
        return this.findTeamById(team_id);
      }
      throw error;
    }
  },

  async deleteTeam(team_id) {
    const res = await pool.query('DELETE FROM responder_teams WHERE team_id = $1 RETURNING *', [team_id]);
    return res.rows[0];
  },

  async addTeamMember(team_id, responder_id) {
    try {
      const res = await pool.query(
        `INSERT INTO responder_team_members(team_id, responder_id, is_active)
         VALUES($1, $2, TRUE)
         ON CONFLICT (team_id, responder_id)
         DO UPDATE SET is_active = TRUE
         RETURNING *`,
        [team_id, responder_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42P01' || /responder_team_members/i.test(error.message)) return null;
      throw error;
    }
  },

  async removeTeamMember(team_id, responder_id) {
    try {
      const res = await pool.query(
        `UPDATE responder_team_members
         SET is_active = FALSE
         WHERE team_id = $1 AND responder_id = $2
         RETURNING *`,
        [team_id, responder_id]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code === '42P01' || /responder_team_members/i.test(error.message)) return null;
      throw error;
    }
  },

  async listTeamMembers(team_id) {
    try {
      const res = await pool.query(
        `SELECT r.*, rtm.team_id, rtm.is_active AS member_active
         FROM responder_team_members rtm
         INNER JOIN responders r ON r.responder_id = rtm.responder_id
         WHERE rtm.team_id = $1
         ORDER BY r.responder_id ASC`,
        [team_id]
      );
      return res.rows;
    } catch (error) {
      if (error.code === '42P01' || /responder_team_members/i.test(error.message)) return [];
      throw error;
    }
  },

  async findEligibleByTeam({ department_code = null, team_name = null, incident_type = null, limit = 50 } = {}) {
    const normalizedDepartmentCode = String(department_code || '').trim().toLowerCase();
    const normalizedTeamName = String(team_name || '').trim();
    const normalizedIncidentType = normalizeIncidentType(incident_type);
    const incidentFilterBypass = shouldBypassIncidentTypeFilter(normalizedIncidentType);
    const incidentTypeFilterValue = incidentFilterBypass ? '' : normalizedIncidentType;
    const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const eligibleStatuses = ['available', 'standby'];

    if (!normalizedDepartmentCode || !normalizedTeamName) return [];

    const rankCase = `CASE
      WHEN LOWER(COALESCE(r.availability_status, '')) LIKE '%available%' THEN 2
      WHEN LOWER(COALESCE(r.availability_status, '')) LIKE '%standby%' THEN 1
      ELSE 0
    END`;

    try {
      const preferred = await pool.query(
        `SELECT r.*, rt.team_status, rt.supported_incident_types AS team_supported_incident_types
         FROM responders r
         INNER JOIN responder_team_members rtm ON rtm.responder_id = r.responder_id
         INNER JOIN responder_teams rt ON rt.team_id = rtm.team_id
         WHERE LOWER(rt.department_code) = LOWER($1)
           AND LOWER(rt.team_name) = LOWER($2)
           AND rt.is_active = TRUE
           AND rtm.is_active = TRUE
           AND (
             LOWER(COALESCE(rt.team_status, 'available')) LIKE '%available%'
             OR LOWER(COALESCE(rt.team_status, 'available')) LIKE '%standby%'
           )
           AND (
             $3 = ''
             OR COALESCE(array_length(rt.supported_incident_types, 1), 0) = 0
             OR $3 = ANY(rt.supported_incident_types)
           )
           AND (${eligibleStatuses.map((_, idx) => `LOWER(COALESCE(r.availability_status, '')) LIKE '%' || $${idx + 4} || '%'`).join(' OR ')})
           AND (
             $3 = ''
             OR COALESCE(array_length(r.supported_incident_types, 1), 0) = 0
             OR $3 = ANY(r.supported_incident_types)
           )
         ORDER BY ${rankCase} DESC, r.responder_id ASC
         LIMIT $${eligibleStatuses.length + 4}`,
        [normalizedDepartmentCode, normalizedTeamName, incidentTypeFilterValue, ...eligibleStatuses, cappedLimit]
      );
      if (preferred.rows.length > 0) {
        return preferred.rows;
      }
    } catch (error) {
      if (!(error.code === '42P01' || /responder_team_members|responder_teams/i.test(error.message))) {
        throw error;
      }
    }

    const fallbackDepartmentMatcher = normalizedDepartmentCode === 'pnp'
      ? /(police|pnp|crime)/i
      : /(drrmo|cdrmmo|disaster|fire|medical|rescue|accident)/i;

    const fallback = await this.findAll({
      limit: cappedLimit,
      offset: 0,
      team_name: normalizedTeamName,
      incident_type: incidentFilterBypass ? null : (normalizedIncidentType || null),
    });
    return fallback
      .filter((responder) => {
        const availability = String(responder?.availability_status || '').toLowerCase();
        if (!(availability.includes('available') || availability.includes('standby'))) return false;
        const haystack = `${responder?.organization || ''} ${responder?.name || ''}`;
        return fallbackDepartmentMatcher.test(haystack);
      })
      .sort((a, b) => {
        const aStatus = String(a?.availability_status || '').toLowerCase();
        const bStatus = String(b?.availability_status || '').toLowerCase();
        const aRank = aStatus.includes('available') ? 2 : aStatus.includes('standby') ? 1 : 0;
        const bRank = bStatus.includes('available') ? 2 : bStatus.includes('standby') ? 1 : 0;
        return bRank - aRank;
      });
  },

  async delete(responder_id) {
    const res = await pool.query('DELETE FROM responders WHERE responder_id = $1 RETURNING *', [responder_id]);
    return res.rows[0];
  },

  async deleteByUserId(user_id, source_type = 'account') {
    const res = await pool.query(
      'DELETE FROM responders WHERE user_id = $1 AND source_type = $2 RETURNING *',
      [user_id, source_type]
    );
    return res.rows;
  },
};

module.exports = Responder;
