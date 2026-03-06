const pool = require('../config/db');

const Department = {
  async findAll() {
    try {
      const res = await pool.query(
        `SELECT d.department_id, d.code, d.name, d.type, d.color, d.status, d.created_at,
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
      if (error.code === '42P01' || /departments|department_units|department_personnel/i.test(error.message)) {
        return [];
      }
      throw error;
    }
  },

  async findById(departmentId) {
    const res = await pool.query(
      `SELECT department_id, code, name, type, color, status, created_at
       FROM departments
       WHERE department_id = $1`,
      [departmentId]
    );
    return res.rows[0] || null;
  },

  async create({ code, name, type, color = 'gray', status = 'active' }) {
    const res = await pool.query(
      `INSERT INTO departments(code, name, type, color, status)
       VALUES($1, $2, $3, $4, $5)
       RETURNING department_id, code, name, type, color, status, created_at`,
      [code, name, type, color, status]
    );
    return res.rows[0];
  },

  async update(departmentId, { name, type, color, status }) {
    const res = await pool.query(
      `UPDATE departments
       SET name = $1, type = $2, color = $3, status = $4
       WHERE department_id = $5
       RETURNING department_id, code, name, type, color, status, created_at`,
      [name, type, color, status, departmentId]
    );
    return res.rows[0] || null;
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
    const department = await pool.query(
      `SELECT department_id, code, name, type, color, status, created_at
       FROM departments
       WHERE department_id = $1`,
      [departmentId]
    );
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
              next_maintenance, maintenance_notes, active_task_count, created_at
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
