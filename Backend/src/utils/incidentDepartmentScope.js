/**
 * Shared incident↔department membership SQL.
 * Ops dashboards use open escalations only; Insights uses historical (any escalation).
 */

function departmentMembershipSql(reportIdExpr, paramIndex, { historical = false } = {}) {
  const statusClause = historical ? '' : `\n            AND ie.status IN ('pending', 'accepted')`;
  return `(
        ${reportIdExpr} IN (SELECT report_id FROM dispatches WHERE LOWER(department_code) = LOWER($${paramIndex}))
        OR
        ${reportIdExpr} IN (
          SELECT ie.report_id FROM incident_escalations ie
          JOIN departments d ON (ie.to_department_id = d.department_id OR ie.from_department_id = d.department_id)
          WHERE LOWER(d.code) = LOWER($${paramIndex})${statusClause}
        )
      )`;
}

module.exports = { departmentMembershipSql };
