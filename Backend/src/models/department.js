const pool = require('../config/db');

let locationColumnsEnsured = false;

async function ensureDepartmentLocationColumns() {
  if (locationColumnsEnsured) return;
  await pool.query(
    `ALTER TABLE departments
       ADD COLUMN IF NOT EXISTS address VARCHAR(255),
       ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
       ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`
  );
  await pool.query('CREATE INDEX IF NOT EXISTS idx_departments_location ON departments(latitude, longitude)');
  locationColumnsEnsured = true;
}

const Department = {
  async findAll() {
    try {
      try {
        const res = await pool.query(
          `SELECT d.department_id, d.code, d.name, d.type, d.color, d.address, d.latitude, d.longitude, d.status, d.created_at,
                  COUNT(DISTINCT u.unit_id) AS units_count,
                  COUNT(DISTINCT p.personnel_id) AS personnel_count,
                  COALESCE(SUM(u.active_task_count), 0) AS active_task_count
           FROM departments d
           LEFT JOIN department_units u ON u.department_id = d.department_id
           LEFT JOIN department_personnel p ON p.department_id = d.department_id
           GROUP BY d.department_id
           ORDER BY d.name ASC`
        );
        return res.rows;
      } catch (error) {
        if (error.code !== '42703') throw error;
        await ensureDepartmentLocationColumns();
        const retry = await pool.query(
          `SELECT d.department_id, d.code, d.name, d.type, d.color, d.address, d.latitude, d.longitude, d.status, d.created_at,
                  COUNT(DISTINCT u.unit_id) AS units_count,
                  COUNT(DISTINCT p.personnel_id) AS personnel_count,
                  COALESCE(SUM(u.active_task_count), 0) AS active_task_count
           FROM departments d
           LEFT JOIN department_units u ON u.department_id = d.department_id
           LEFT JOIN department_personnel p ON p.department_id = d.department_id
           GROUP BY d.department_id
           ORDER BY d.name ASC`
        );
        return retry.rows;
      }
    } catch (error) {
      if (error.code === '42P01' || /departments|department_units|department_personnel/i.test(error.message)) {
        return [];
      }
      throw error;
    }
  },

  async findById(departmentId) {
    try {
      const res = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE department_id = $1`,
        [departmentId]
      );
      return res.rows[0] || null;
    } catch (error) {
      if (error.code !== '42703') throw error;
      await ensureDepartmentLocationColumns();
      const res = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE department_id = $1`,
        [departmentId]
      );
      return res.rows[0] || null;
    }
  },

  async findByCode(code) {
    if (!code || String(code).trim() === '') return null;
    try {
      const res = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))`,
        [String(code).trim()]
      );
      return res.rows[0] || null;
    } catch (error) {
      if (error.code !== '42703') throw error;
      await ensureDepartmentLocationColumns();
      const res = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))`,
        [String(code).trim()]
      );
      return res.rows[0] || null;
    }
  },

  async create({ code, name, type, color = 'gray', address = null, latitude = null, longitude = null, status = 'active' }) {
    try {
      const res = await pool.query(
        `INSERT INTO departments(code, name, type, color, address, latitude, longitude, status)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING department_id, code, name, type, color, address, latitude, longitude, status, created_at`,
        [code, name, type, color, address, latitude, longitude, status]
      );
      return res.rows[0];
    } catch (error) {
      if (error.code !== '42703') throw error;
      await ensureDepartmentLocationColumns();
      const res = await pool.query(
        `INSERT INTO departments(code, name, type, color, address, latitude, longitude, status)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING department_id, code, name, type, color, address, latitude, longitude, status, created_at`,
        [code, name, type, color, address, latitude, longitude, status]
      );
      return res.rows[0];
    }
  },

  async update(departmentId, { name, type, color, address, latitude, longitude, status }) {
    try {
      const res = await pool.query(
        `UPDATE departments
         SET name = $1, type = $2, color = $3, address = $4, latitude = $5, longitude = $6, status = $7
         WHERE department_id = $8
         RETURNING department_id, code, name, type, color, address, latitude, longitude, status, created_at`,
        [name, type, color, address, latitude, longitude, status, departmentId]
      );
      return res.rows[0] || null;
    } catch (error) {
      if (error.code !== '42703') throw error;
      await ensureDepartmentLocationColumns();
      const res = await pool.query(
        `UPDATE departments
         SET name = $1, type = $2, color = $3, address = $4, latitude = $5, longitude = $6, status = $7
         WHERE department_id = $8
         RETURNING department_id, code, name, type, color, address, latitude, longitude, status, created_at`,
        [name, type, color, address, latitude, longitude, status, departmentId]
      );
      return res.rows[0] || null;
    }
  },

  async delete(departmentId) {
    const res = await pool.query(
      `DELETE FROM departments
       WHERE department_id = $1
       RETURNING department_id, code, name`,
      [departmentId]
    );
    return res.rows[0] || null;
  },

  async getMetrics(departmentId) {
    let department;
    try {
      department = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE department_id = $1`,
        [departmentId]
      );
    } catch (error) {
      if (error.code !== '42703') throw error;
      await ensureDepartmentLocationColumns();
      department = await pool.query(
        `SELECT department_id, code, name, type, color, address, latitude, longitude, status, created_at
         FROM departments
         WHERE department_id = $1`,
        [departmentId]
      );
    }
    if (!department.rows[0]) return null;

    const unitsRes = await pool.query(
      `SELECT
          COUNT(*)::int AS total_units,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('available', 'operational'))::int AS available_units,
          COALESCE(SUM(active_task_count), 0)::int AS active_task_count
       FROM department_units
       WHERE department_id = $1`,
      [departmentId]
    );

    const personnelRes = await pool.query(
      `SELECT
          (SELECT COUNT(*) FROM department_personnel WHERE department_id = $1)::int AS roster_personnel,
          (SELECT COUNT(*) FROM users WHERE department_id = $1 AND is_active = true)::int AS user_personnel`,
      [departmentId]
    );

    const incidentsRes = await pool.query(
      `SELECT COUNT(*)::int AS active_incidents
       FROM dispatches d
       JOIN responders r ON r.responder_id = d.responder_id
       JOIN incident_reports i ON i.report_id = d.report_id
       WHERE LOWER(COALESCE(r.organization, '')) = LOWER($1)
         AND LOWER(COALESCE(i.status, 'pending')) IN ('pending', 'verified')`,
      [department.rows[0].name]
    );

    const unitMetrics = unitsRes.rows[0];
    const personnelMetrics = personnelRes.rows[0];

    return {
      ...department.rows[0],
      total_units: unitMetrics.total_units,
      available_units: unitMetrics.available_units,
      active_task_count: unitMetrics.active_task_count,
      personnel_count: Math.max(personnelMetrics.roster_personnel, personnelMetrics.user_personnel),
      active_incidents: incidentsRes.rows[0].active_incidents,
    };
  },

  async listUnits(departmentId) {
    const res = await pool.query(
      `SELECT unit_id, department_id, name, type, status, maintenance_status, last_maintenance,
              next_maintenance, maintenance_notes, active_task_count, assigned_report_id, created_at
       FROM department_units
       WHERE department_id = $1
       ORDER BY created_at DESC`,
      [departmentId]
    );
    return res.rows;
  },

  async createUnit(departmentId, payload) {
    const res = await pool.query(
      `INSERT INTO department_units(
          department_id, name, type, status, maintenance_status, last_maintenance,
          next_maintenance, maintenance_notes, active_task_count
       ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING unit_id, department_id, name, type, status, maintenance_status, last_maintenance,
                 next_maintenance, maintenance_notes, active_task_count, created_at`,
      [
        departmentId,
        payload.name,
        payload.type,
        payload.status,
        payload.maintenance_status,
        payload.last_maintenance,
        payload.next_maintenance,
        payload.maintenance_notes,
        payload.active_task_count,
      ]
    );
    return res.rows[0];
  },

  async updateUnit(departmentId, unitId, payload) {
    const res = await pool.query(
      `UPDATE department_units
       SET name = $1,
           type = $2,
           status = $3,
           maintenance_status = $4,
           last_maintenance = $5,
           next_maintenance = $6,
           maintenance_notes = $7,
           active_task_count = $8
       WHERE department_id = $9 AND unit_id = $10
       RETURNING unit_id, department_id, name, type, status, maintenance_status, last_maintenance,
                 next_maintenance, maintenance_notes, active_task_count, created_at`,
      [
        payload.name,
        payload.type,
        payload.status,
        payload.maintenance_status,
        payload.last_maintenance,
        payload.next_maintenance,
        payload.maintenance_notes,
        payload.active_task_count,
        departmentId,
        unitId,
      ]
    );
    return res.rows[0] || null;
  },

  async deleteUnit(departmentId, unitId) {
    const res = await pool.query(
      `DELETE FROM department_units
       WHERE department_id = $1 AND unit_id = $2
       RETURNING unit_id, department_id, name`,
      [departmentId, unitId]
    );
    return res.rows[0] || null;
  },

  /**
   * Assign a unit to an incident: set status to 'On Dispatch' and assigned_report_id to reportId.
   * Returns the updated unit or null if not found.
   */
  async assignUnitToIncident(departmentId, unitId, reportId) {
    const res = await pool.query(
      `UPDATE department_units
       SET status = 'On Dispatch', assigned_report_id = $1
       WHERE department_id = $2 AND unit_id = $3
       RETURNING unit_id, department_id, name, type, status, maintenance_status, last_maintenance,
                 next_maintenance, maintenance_notes, active_task_count, assigned_report_id, created_at`,
      [reportId, departmentId, unitId]
    );
    return res.rows[0] || null;
  },

  /**
   * Record that a unit was used for an incident (monitoring only). Does not update the unit's status or assigned_report_id.
   * Verifies the unit exists and belongs to the department. Idempotent for same (report_id, unit_id).
   * Returns the usage row or null if unit not found / not in department.
   */
  async recordUnitUsageForIncident(reportId, unitId, departmentId) {
    const check = await pool.query(
      'SELECT 1 FROM department_units WHERE unit_id = $1 AND department_id = $2',
      [unitId, departmentId]
    );
    if (!check.rows || check.rows.length === 0) return null;
    try {
      const res = await pool.query(
        `INSERT INTO incident_unit_usage (report_id, unit_id, department_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (report_id, unit_id) DO NOTHING
         RETURNING report_id, unit_id, department_id, created_at`,
        [reportId, unitId, departmentId]
      );
      if (res.rows[0]) return res.rows[0];
      const existing = await pool.query(
        'SELECT report_id, unit_id, department_id, created_at FROM incident_unit_usage WHERE report_id = $1 AND unit_id = $2',
        [reportId, unitId]
      );
      return existing.rows[0] || null;
    } catch (error) {
      if (error.code === '42P01' || /incident_unit_usage/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Release all units assigned to this report: set status to 'Available' and clear assigned_report_id.
   * Called when an incident is marked resolved.
   */
  async releaseUnitsFromReport(reportId) {
    try {
      const res = await pool.query(
        `UPDATE department_units
         SET status = 'Available', assigned_report_id = NULL
         WHERE assigned_report_id = $1`,
        [reportId]
      );
      return res.rowCount ?? 0;
    } catch (error) {
      if (error.code === '42703' || /assigned_report_id/i.test(error.message)) {
        return 0;
      }
      throw error;
    }
  },

  async listPersonnel(departmentId) {
    const res = await pool.query(
      `SELECT personnel_id, department_id, unit_id, name, role, status, special_skills, certifications, created_at
       FROM department_personnel
       WHERE department_id = $1
       ORDER BY created_at DESC`,
      [departmentId]
    );
    return res.rows;
  },

  async createPersonnel(departmentId, payload) {
    const res = await pool.query(
      `INSERT INTO department_personnel(
          department_id, unit_id, name, role, status, special_skills, certifications
       ) VALUES($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING personnel_id, department_id, unit_id, name, role, status, special_skills, certifications, created_at`,
      [
        departmentId,
        payload.unit_id,
        payload.name,
        payload.role,
        payload.status,
        payload.special_skills,
        JSON.stringify(payload.certifications || []),
      ]
    );
    return res.rows[0];
  },

  async updatePersonnel(departmentId, personnelId, payload) {
    const res = await pool.query(
      `UPDATE department_personnel
       SET unit_id = $1,
           name = $2,
           role = $3,
           status = $4,
           special_skills = $5,
           certifications = $6::jsonb
       WHERE department_id = $7 AND personnel_id = $8
       RETURNING personnel_id, department_id, unit_id, name, role, status, special_skills, certifications, created_at`,
      [
        payload.unit_id,
        payload.name,
        payload.role,
        payload.status,
        payload.special_skills,
        JSON.stringify(payload.certifications || []),
        departmentId,
        personnelId,
      ]
    );
    return res.rows[0] || null;
  },

  async deletePersonnel(departmentId, personnelId) {
    const res = await pool.query(
      `DELETE FROM department_personnel
       WHERE department_id = $1 AND personnel_id = $2
       RETURNING personnel_id, department_id, name`,
      [departmentId, personnelId]
    );
    return res.rows[0] || null;
  },
};

module.exports = Department;
