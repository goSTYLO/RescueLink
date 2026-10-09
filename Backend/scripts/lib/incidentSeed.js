/** Insert a live incident keyed by incident_keys; move closed rows to archive. */

async function insertKeyedIncident(client, columnSql, valueSql, params) {
  const keyRes = await client.query('INSERT INTO incident_keys DEFAULT VALUES RETURNING report_id');
  const reportId = keyRes.rows[0].report_id;
  await client.query(
    `INSERT INTO incident_reports(report_id, ${columnSql}) VALUES($1, ${valueSql})`,
    [reportId, ...params]
  );
  return reportId;
}

async function archiveClosedSeedIncident(client, reportId, status) {
  if (status !== 'closed') return;
  await client.query(
    `WITH moved AS (
       DELETE FROM incident_reports
        WHERE report_id = $1 AND status = 'closed'
       RETURNING *
     )
     INSERT INTO archived_incident_reports
     SELECT * FROM moved`,
    [reportId]
  );
  await client.query(
    `UPDATE archived_incident_reports
        SET is_archived = TRUE,
            archived_at = COALESCE(archived_at, NOW())
      WHERE report_id = $1`,
    [reportId]
  );
}

module.exports = { insertKeyedIncident, archiveClosedSeedIncident };
