const pool = require('../config/db');
const { departmentMembershipSql } = require('../utils/incidentDepartmentScope');

const TZ = 'Asia/Manila';
const DISPATCH_TARGET_SECONDS = 8 * 60;
const ARRIVAL_TARGET_SECONDS = 10 * 60;
const OVERDUE_SECONDS = 30 * 60;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const EXPORT_ROW_CAP = 10000;
const SORT_COLUMNS = {
  created_at: 'ir.created_at',
  incident_type: 'ir.incident_type',
  severity_level: 'ir.severity_level',
  status: 'ir.status',
  barangay: 'ir.barangay',
};

function parseTimeRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('from and to must be valid ISO dates');
  }
  if (start > end) throw new Error('from must be before to');
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new Error('date range must not exceed 366 days');
  }
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    durationMs: end.getTime() - start.getTime(),
  };
}

function buildWhere(filters, alias = 'ir') {
  const params = [];
  const clauses = ['1=1'];
  const col = (name) => (alias ? `${alias}.${name}` : name);

  params.push(filters.from);
  clauses.push(`${col('created_at')} >= $${params.length}`);
  params.push(filters.to);
  clauses.push(`${col('created_at')} <= $${params.length}`);

  if (filters.volunteer_scope) {
    clauses.push(`${col('accepted_by_user_id')} IS NOT NULL`);
  } else if (filters.department_code) {
    params.push(filters.department_code);
    clauses.push(departmentMembershipSql(col('report_id'), params.length, { historical: true }));
  }
  if (filters.incident_type) {
    if (/^unknown$/i.test(String(filters.incident_type).trim())) {
      clauses.push(`NULLIF(BTRIM(${col('incident_type')}), '') IS NULL`);
    } else {
      params.push(filters.incident_type);
      clauses.push(`LOWER(${col('incident_type')}) = LOWER($${params.length})`);
    }
  }
  if (filters.severity_level) {
    if (/^unknown$/i.test(String(filters.severity_level).trim())) {
      clauses.push(`NULLIF(BTRIM(${col('severity_level')}), '') IS NULL`);
    } else {
      params.push(filters.severity_level);
      clauses.push(`${col('severity_level')} = $${params.length}`);
    }
  }
  if (filters.status) {
    if (/^unknown$/i.test(String(filters.status).trim())) {
      clauses.push(`NULLIF(BTRIM(${col('status')}), '') IS NULL`);
    } else {
      params.push(filters.status);
      clauses.push(`${col('status')} = $${params.length}`);
    }
  }
  if (filters.barangay) {
    if (/^unknown$/i.test(String(filters.barangay).trim())) {
      clauses.push(`NULLIF(BTRIM(${col('barangay')}), '') IS NULL`);
    } else {
      params.push(filters.barangay);
      clauses.push(`${col('barangay')} = $${params.length}`);
    }
  }
  if (filters.exclude_duplicates) {
    clauses.push(`(${col('is_duplicate')} IS NULL OR ${col('is_duplicate')} = FALSE)`);
  }
  if (filters.include_archived === false) {
    clauses.push(`${col('is_archived')} = FALSE`);
  }
  return { where: clauses.join(' AND '), params };
}

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rate(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function clockShape(p50, p90, p95, n, extra = {}) {
  const count = num(n);
  return {
    p50_seconds: count ? num(p50) : null,
    p90_seconds: count ? num(p90) : null,
    p95_seconds: count ? num(p95) : null,
    n: count,
    ...extra,
  };
}

function clockSql(filters) {
  const { where, params } = buildWhere(filters);
  let deptFilter = '';
  if (filters.department_code) {
    params.push(filters.department_code);
    deptFilter = ` AND LOWER(d.department_code) = LOWER($${params.length})`;
  }
  const firstDispatch = `(SELECT MIN(d.dispatched_at) FROM dispatches d WHERE d.report_id = ir.report_id${deptFilter})`;
  const arrival = `COALESCE(
  (SELECT MIN(h.updated_at) FROM responder_status_history h
    WHERE h.report_id = ir.report_id AND LOWER(COALESCE(h.new_status, '')) = 'on scene'),
  (SELECT MIN(d.actual_arrival_at) FROM dispatches d
    WHERE d.report_id = ir.report_id AND d.actual_arrival_at IS NOT NULL${deptFilter})
)`;
  const firstAction = `(SELECT MIN(ts) FROM (
    SELECT ${firstDispatch} AS ts
    UNION ALL SELECT ir.accepted_at
    UNION ALL SELECT MIN(ie.created_at) FROM incident_escalations ie WHERE ie.report_id = ir.report_id
    UNION ALL SELECT MIN(n.created_at) FROM incident_coordination_notes n WHERE n.report_id = ir.report_id
  ) fa WHERE ts IS NOT NULL)`;
  return { where, params, firstDispatch, arrival, firstAction };
}

async function countFiltered(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT COUNT(*)::int AS total FROM incident_reports ir WHERE ${where}`,
    params
  );
  return num(res.rows[0]?.total);
}

async function queryVolume(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT
        COUNT(*)::int AS incidents,
        COUNT(*) FILTER (
          WHERE COALESCE(ir.resolved_at, ir.closed_at) IS NULL
             OR COALESCE(ir.resolved_at, ir.closed_at) > $2::timestamptz
        )::int AS open_count,
        COUNT(*) FILTER (
          WHERE COALESCE(ir.resolved_at, ir.closed_at) IS NOT NULL
            AND COALESCE(ir.resolved_at, ir.closed_at) <= $2::timestamptz
        )::int AS closed_count,
        COUNT(*) FILTER (WHERE ir.is_duplicate IS TRUE)::int AS duplicate_count,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(ir.severity_level, '')) IN ('high', 'critical')
        )::int AS critical_count,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.report_id = ir.report_id)
            AND NOT EXISTS (SELECT 1 FROM incident_escalations ie WHERE ie.report_id = ir.report_id)
            AND ir.accepted_at IS NULL
        )::int AS unserved_count,
        COUNT(*) FILTER (
          WHERE (COALESCE(ir.resolved_at, ir.closed_at) IS NULL OR COALESCE(ir.resolved_at, ir.closed_at) > $2::timestamptz)
            AND EXTRACT(EPOCH FROM ($2::timestamptz - ir.created_at)) > ${OVERDUE_SECONDS}
        )::int AS overdue_count,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.report_id = ir.report_id)
            AND NOT EXISTS (SELECT 1 FROM incident_escalations ie WHERE ie.report_id = ir.report_id)
        )::int AS unassigned_count,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.report_id = ir.report_id)
        )::int AS never_dispatched_count,
        COUNT(*) FILTER (
          WHERE EXISTS (SELECT 1 FROM backup_requests br WHERE br.report_id = ir.report_id)
        )::int AS backup_count,
        COUNT(*) FILTER (WHERE ir.accepted_by_user_id IS NOT NULL)::int AS volunteer_count,
        COUNT(*) FILTER (WHERE ir.auto_assignment_mismatch IS TRUE)::int AS mismatch_count,
        AVG(ir.primary_confidence) FILTER (WHERE ir.primary_confidence IS NOT NULL) AS mean_ai_confidence,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.incident_type, '')) = 'sos')::int AS sos_count,
        COUNT(*) FILTER (
          WHERE ir.audio_path IS NOT NULL AND BTRIM(ir.audio_path) <> ''
            AND LOWER(COALESCE(ir.incident_type, '')) <> 'sos'
        )::int AS voice_count
     FROM incident_reports ir
     WHERE ${where}`,
    params
  );
  return res.rows[0] || {};
}

async function queryClocks(filters) {
  const { where, params, firstDispatch, arrival, firstAction } = clockSql(filters);
  const res = await pool.query(
    `SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY first_action_s) FILTER (WHERE first_action_s >= 0) AS first_action_p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY first_action_s) FILTER (WHERE first_action_s >= 0) AS first_action_p90,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY first_action_s) FILTER (WHERE first_action_s >= 0) AS first_action_p95,
        COUNT(*) FILTER (WHERE first_action_s IS NOT NULL AND first_action_s >= 0)::int AS first_action_n,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY dispatch_s) FILTER (WHERE dispatch_s >= 0) AS dispatch_p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY dispatch_s) FILTER (WHERE dispatch_s >= 0) AS dispatch_p90,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY dispatch_s) FILTER (WHERE dispatch_s >= 0) AS dispatch_p95,
        COUNT(*) FILTER (WHERE dispatch_s IS NOT NULL AND dispatch_s >= 0)::int AS dispatch_n,
        COUNT(*) FILTER (WHERE dispatch_s >= 0 AND dispatch_s <= ${DISPATCH_TARGET_SECONDS})::int AS dispatch_within_target,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY arrival_s) FILTER (WHERE arrival_s >= 0) AS arrival_p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY arrival_s) FILTER (WHERE arrival_s >= 0) AS arrival_p90,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY arrival_s) FILTER (WHERE arrival_s >= 0) AS arrival_p95,
        COUNT(*) FILTER (WHERE arrival_s IS NOT NULL AND arrival_s >= 0)::int AS arrival_n,
        COUNT(*) FILTER (WHERE arrival_s >= 0 AND arrival_s <= ${ARRIVAL_TARGET_SECONDS})::int AS arrival_within_target,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resolve_s) FILTER (WHERE resolve_s >= 0) AS resolve_p50,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY resolve_s) FILTER (WHERE resolve_s >= 0) AS resolve_p90,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY resolve_s) FILTER (WHERE resolve_s >= 0) AS resolve_p95,
        COUNT(*) FILTER (WHERE resolve_s IS NOT NULL AND resolve_s >= 0)::int AS resolve_n
     FROM (
       SELECT
         EXTRACT(EPOCH FROM (${firstAction} - ir.created_at)) AS first_action_s,
         EXTRACT(EPOCH FROM (${firstDispatch} - ir.created_at)) AS dispatch_s,
         EXTRACT(EPOCH FROM (${arrival} - ir.created_at)) AS arrival_s,
         EXTRACT(EPOCH FROM (COALESCE(ir.resolved_at, ir.closed_at) - ir.created_at)) AS resolve_s
       FROM incident_reports ir
       WHERE ${where}
     ) clocks`,
    params
  );
  return res.rows[0] || {};
}

async function queryGroup(filters, selectExpr, groupExpr, { limit = 50, extraWhere = '' } = {}) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT ${selectExpr} AS key, COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.severity_level, '')) IN ('high', 'critical'))::int AS critical_count
       FROM incident_reports ir
      WHERE ${where} ${extraWhere}
      GROUP BY ${groupExpr}
      ORDER BY count DESC
      LIMIT ${Number(limit) || 50}`,
    params
  );
  return res.rows;
}

async function queryTypeBarangay(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(BTRIM(ir.incident_type), ''), 'unknown') AS incident_type,
            COALESCE(NULLIF(BTRIM(ir.barangay), ''), 'Unknown') AS barangay,
            COUNT(*)::int AS count
       FROM incident_reports ir
      WHERE ${where}
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT 10`,
    params
  );
  return res.rows;
}

async function queryBarangayTypeMix(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(BTRIM(ir.barangay), ''), 'Unknown') AS barangay,
            COALESCE(NULLIF(BTRIM(ir.incident_type), ''), 'unknown') AS incident_type,
            COUNT(*)::int AS count
       FROM incident_reports ir
      WHERE ${where}
      GROUP BY 1, 2`,
    params
  );
  return res.rows;
}

function attachBarangayTypes(barangayRows, typeMixRows) {
  const byBarangay = new Map();
  for (const row of typeMixRows || []) {
    const key = row.barangay;
    if (!byBarangay.has(key)) byBarangay.set(key, []);
    byBarangay.get(key).push({ key: row.incident_type, count: num(row.count) });
  }
  for (const list of byBarangay.values()) {
    list.sort((a, b) => b.count - a.count);
  }
  return (barangayRows || []).map((row) => ({
    ...row,
    types: (byBarangay.get(row.key) || []).slice(0, 3).map((t) => ({ key: t.key, count: t.count })),
  }));
}

async function queryTimeseries(filters, trunc) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT (date_trunc('${trunc}', ir.created_at AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}') AS bucket,
            COUNT(*)::int AS count
       FROM incident_reports ir
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1 ASC`,
    params
  );
  return res.rows.map((row) => ({ bucket: row.bucket, count: num(row.count) }));
}

async function queryHeatmap(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT EXTRACT(DOW FROM ir.created_at AT TIME ZONE '${TZ}')::int AS dow,
            EXTRACT(HOUR FROM ir.created_at AT TIME ZONE '${TZ}')::int AS hour,
            COUNT(*)::int AS count
       FROM incident_reports ir
      WHERE ${where}
      GROUP BY 1, 2
      ORDER BY 1, 2`,
    params
  );
  return res.rows.map((row) => ({ dow: num(row.dow), hour: num(row.hour), count: num(row.count) }));
}

async function queryByDepartment(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(BTRIM(dep.name), ''), CASE WHEN x.key = 'volunteers' THEN 'Volunteers' ELSE NULLIF(BTRIM(x.key), '') END, 'unassigned') AS key,
            COUNT(DISTINCT x.report_id)::int AS count
       FROM (
         SELECT ir.report_id, LOWER(BTRIM(d.department_code)) AS key
           FROM incident_reports ir
           JOIN dispatches d ON d.report_id = ir.report_id
          WHERE ${where}
         UNION
         SELECT ir.report_id, LOWER(BTRIM(dept.code)) AS key
           FROM incident_reports ir
           JOIN incident_escalations ie ON ie.report_id = ir.report_id
           JOIN departments dept ON dept.department_id IN (ie.to_department_id, ie.from_department_id)
          WHERE ${where}
         UNION
         SELECT ir.report_id, 'volunteers'::text AS key
           FROM incident_reports ir
          WHERE ${where}
            AND ir.accepted_by_user_id IS NOT NULL
       ) x
       LEFT JOIN departments dep ON LOWER(BTRIM(dep.code)) = x.key
      GROUP BY COALESCE(NULLIF(BTRIM(dep.name), ''), CASE WHEN x.key = 'volunteers' THEN 'Volunteers' ELSE NULLIF(BTRIM(x.key), '') END, 'unassigned')
      ORDER BY count DESC
      LIMIT 50`,
    params
  );
  return res.rows;
}

async function querySeverityClocks(filters) {
  const { where, params, firstDispatch, arrival, firstAction } = clockSql(filters);
  const res = await pool.query(
    `SELECT COALESCE(NULLIF(BTRIM(x.severity_level), ''), 'unknown') AS key,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY x.first_action_s) FILTER (WHERE x.first_action_s >= 0) AS first_action_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY x.first_action_s) FILTER (WHERE x.first_action_s >= 0) AS first_action_p90,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY x.first_action_s) FILTER (WHERE x.first_action_s >= 0) AS first_action_p95,
            COUNT(*) FILTER (WHERE x.first_action_s IS NOT NULL AND x.first_action_s >= 0)::int AS first_action_n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY x.dispatch_s) FILTER (WHERE x.dispatch_s >= 0) AS dispatch_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY x.dispatch_s) FILTER (WHERE x.dispatch_s >= 0) AS dispatch_p90,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY x.dispatch_s) FILTER (WHERE x.dispatch_s >= 0) AS dispatch_p95,
            COUNT(*) FILTER (WHERE x.dispatch_s IS NOT NULL AND x.dispatch_s >= 0)::int AS dispatch_n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY x.arrival_s) FILTER (WHERE x.arrival_s >= 0) AS arrival_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY x.arrival_s) FILTER (WHERE x.arrival_s >= 0) AS arrival_p90,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY x.arrival_s) FILTER (WHERE x.arrival_s >= 0) AS arrival_p95,
            COUNT(*) FILTER (WHERE x.arrival_s IS NOT NULL AND x.arrival_s >= 0)::int AS arrival_n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY x.resolve_s) FILTER (WHERE x.resolve_s >= 0) AS resolve_p50,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY x.resolve_s) FILTER (WHERE x.resolve_s >= 0) AS resolve_p90,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY x.resolve_s) FILTER (WHERE x.resolve_s >= 0) AS resolve_p95,
            COUNT(*) FILTER (WHERE x.resolve_s IS NOT NULL AND x.resolve_s >= 0)::int AS resolve_n
       FROM (
         SELECT ir.severity_level,
                EXTRACT(EPOCH FROM (${firstAction} - ir.created_at)) AS first_action_s,
                EXTRACT(EPOCH FROM (${firstDispatch} - ir.created_at)) AS dispatch_s,
                EXTRACT(EPOCH FROM (${arrival} - ir.created_at)) AS arrival_s,
                EXTRACT(EPOCH FROM (COALESCE(ir.resolved_at, ir.closed_at) - ir.created_at)) AS resolve_s
           FROM incident_reports ir
          WHERE ${where}
       ) x
      GROUP BY 1
      ORDER BY dispatch_n DESC`,
    params
  );
  return res.rows.map((row) => ({
    key: row.key,
    first_action: clockShape(row.first_action_p50, row.first_action_p90, row.first_action_p95, row.first_action_n),
    dispatch: clockShape(row.dispatch_p50, row.dispatch_p90, row.dispatch_p95, row.dispatch_n),
    arrival: clockShape(row.arrival_p50, row.arrival_p90, row.arrival_p95, row.arrival_n),
    resolve: clockShape(row.resolve_p50, row.resolve_p90, row.resolve_p95, row.resolve_n),
  }));
}

async function queryEscalationsSafe(filters) {
  if (filters.department_id && !filters.volunteer_scope) {
    const res = await pool.query(
      `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ie.to_department_id = $3)::int AS inbound,
          COUNT(*) FILTER (WHERE ie.from_department_id = $3)::int AS outbound
         FROM incident_escalations ie
        WHERE ie.created_at >= $1 AND ie.created_at <= $2
          AND (ie.to_department_id = $3 OR ie.from_department_id = $3)`,
      [filters.from, filters.to, filters.department_id]
    );
    return res.rows[0] || { total: 0, inbound: 0, outbound: 0 };
  }
  if (filters.volunteer_scope) {
    const { where, params } = buildWhere(filters);
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*)::int AS inbound, 0::int AS outbound
         FROM incident_escalations ie
         JOIN incident_reports ir ON ir.report_id = ie.report_id
        WHERE ${where}`,
      params
    );
    const row = res.rows[0] || { total: 0 };
    return { total: num(row.total), inbound: num(row.total), outbound: 0 };
  }
  const res = await pool.query(
    `SELECT COUNT(*)::int AS total, COUNT(*)::int AS inbound, 0::int AS outbound
       FROM incident_escalations ie
      WHERE ie.created_at >= $1 AND ie.created_at <= $2`,
    [filters.from, filters.to]
  );
  const row = res.rows[0] || { total: 0 };
  return { total: num(row.total), inbound: num(row.total), outbound: 0 };
}

function peakFromHeatmap(heatmap) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDow = Array(7).fill(0);
  let maxCell = { dow: 0, hour: 0, count: 0 };
  for (const cell of heatmap || []) {
    const dow = num(cell.dow);
    const hour = num(cell.hour);
    const count = num(cell.count);
    if (dow >= 0 && dow < 7) byDow[dow] += count;
    if (count > maxCell.count) maxCell = { dow, hour, count };
  }
  if (!maxCell.count) {
    return { busiest_weekday: null, peak_hour_band: null, peak_volume: 0 };
  }
  const busiestDow = byDow.indexOf(Math.max(...byDow));
  const hour = maxCell.hour;
  return {
    busiest_weekday: days[busiestDow] || null,
    peak_hour_band: `${hour}:00–${hour + 1}:00`,
    peak_volume: maxCell.count,
  };
}

async function queryConcurrent(filters) {
  const { where, params } = buildWhere(filters);
  const trunc = filters.durationMs <= 90 * 24 * 60 * 60 * 1000 ? 'hour' : 'day';
  // ponytail: O(hours × incidents) nested join; if this is slow, day buckets only.
  const res = await pool.query(
    `WITH buckets AS (
        SELECT generate_series(
          date_trunc('${trunc}', $1::timestamptz AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}',
          $2::timestamptz,
          '1 ${trunc}'::interval
        ) AS ts
      ),
      inc AS (
        SELECT ir.created_at, COALESCE(ir.resolved_at, ir.closed_at) AS ended_at
          FROM incident_reports ir
         WHERE ${where}
      )
      SELECT COALESCE(MAX(c.n), 0)::int AS max_concurrent,
             COALESCE(ROUND(AVG(c.n)::numeric, 1), 0)::float AS avg_concurrent
        FROM (
          SELECT b.ts, COUNT(inc.created_at)::int AS n
            FROM buckets b
            LEFT JOIN inc ON inc.created_at <= b.ts
             AND (inc.ended_at IS NULL OR inc.ended_at > b.ts)
           GROUP BY b.ts
        ) c`,
    params
  );
  return {
    max: num(res.rows[0]?.max_concurrent),
    avg: num(res.rows[0]?.avg_concurrent),
    granularity: trunc,
  };
}

async function queryExceptions(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE x.reassign OR x.mismatch OR x.backup OR x.declined)::int AS any_count,
        COUNT(*) FILTER (WHERE x.reassign)::int AS reassign_count,
        COUNT(*) FILTER (WHERE x.mismatch AND NOT x.reassign)::int AS mismatch_count,
        COUNT(*) FILTER (WHERE x.backup AND NOT x.reassign AND NOT x.mismatch)::int AS backup_count,
        COUNT(*) FILTER (WHERE x.declined AND NOT x.reassign AND NOT x.mismatch AND NOT x.backup)::int AS declined_count
       FROM (
         SELECT
           (
             EXISTS (
               SELECT 1 FROM dispatcher_audit_logs a
                WHERE a.action = 'dispatch_reassign_team'
                  AND (a.details::jsonb)->>'report_id' = ir.report_id::text
             )
             OR (
               SELECT COUNT(DISTINCT LOWER(BTRIM(d.team_name)))
                 FROM dispatches d
                WHERE d.report_id = ir.report_id
                  AND d.team_name IS NOT NULL
                  AND BTRIM(d.team_name) <> ''
             ) > 1
           ) AS reassign,
           ir.auto_assignment_mismatch IS TRUE AS mismatch,
           EXISTS (SELECT 1 FROM backup_requests br WHERE br.report_id = ir.report_id) AS backup,
           EXISTS (
             SELECT 1 FROM incident_escalations ie
              WHERE ie.report_id = ir.report_id AND LOWER(ie.status) = 'declined'
           ) AS declined
           FROM incident_reports ir
          WHERE ${where}
       ) x`,
    params
  );
  return res.rows[0] || {};
}

async function queryEscalationFunnel(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT
        COUNT(DISTINCT ie.report_id)::int AS escalated_n,
        COUNT(DISTINCT ie.report_id) FILTER (WHERE LOWER(ie.status) = 'accepted')::int AS accepted_n,
        COUNT(DISTINCT ie.report_id) FILTER (
          WHERE LOWER(ie.status) = 'accepted'
            AND EXISTS (
              SELECT 1 FROM dispatches d
              JOIN departments dept ON LOWER(BTRIM(d.department_code)) = LOWER(BTRIM(dept.code))
              WHERE d.report_id = ie.report_id
                AND dept.department_id = ie.to_department_id
                AND d.dispatched_at >= ie.created_at
            )
        )::int AS dispatched_n,
        COUNT(DISTINCT ie.report_id) FILTER (
          WHERE LOWER(ie.status) = 'accepted'
            AND EXISTS (
              SELECT 1 FROM dispatches d
              JOIN departments dept ON LOWER(BTRIM(d.department_code)) = LOWER(BTRIM(dept.code))
              WHERE d.report_id = ie.report_id
                AND dept.department_id = ie.to_department_id
                AND d.dispatched_at >= ie.created_at
                AND (
                  d.actual_arrival_at IS NOT NULL
                  OR EXISTS (
                    SELECT 1 FROM responder_status_history h
                     WHERE h.report_id = ie.report_id
                       AND LOWER(COALESCE(h.new_status, '')) = 'on scene'
                  )
                )
            )
        )::int AS arrived_n,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (ie.responded_at - ie.created_at))
        ) FILTER (
          WHERE LOWER(ie.status) IN ('accepted', 'declined')
            AND ie.responded_at IS NOT NULL
            AND ie.responded_at >= ie.created_at
        ) AS processing_p50
       FROM incident_escalations ie
       JOIN incident_reports ir ON ir.report_id = ie.report_id
      WHERE ${where}`,
    params
  );
  return res.rows[0] || {};
}

async function queryUtilization(filters) {
  const { where, params } = buildWhere(filters);
  let unitDept = '';
  let dispatchDept = '';
  if (filters.department_id) {
    params.push(filters.department_id);
    unitDept = ` AND u.department_id = $${params.length}`;
  }
  if (filters.department_code) {
    params.push(filters.department_code);
    dispatchDept = ` AND LOWER(d.department_code) = LOWER($${params.length})`;
  }
  const res = await pool.query(
    `SELECT
        (SELECT COUNT(*)::int
           FROM incident_unit_usage u
           JOIN incident_reports ir ON ir.report_id = u.report_id
          WHERE ${where}${unitDept}) AS units_used,
        (SELECT COUNT(*)::int
           FROM dispatches d
           JOIN incident_reports ir ON ir.report_id = d.report_id
          WHERE ${where}${dispatchDept}) AS dispatch_count`,
    params
  );
  return res.rows[0] || { units_used: 0, dispatch_count: 0 };
}

async function queryOutcomes(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `SELECT CASE
              WHEN ir.is_duplicate IS TRUE THEN 'Duplicate'
              WHEN LOWER(COALESCE(ir.status, '')) = 'cancelled' THEN 'Cancelled'
              WHEN ir.closure_method ILIKE '%unable%' THEN 'Unable to respond'
              WHEN LOWER(COALESCE(ir.status, '')) = 'resolved' THEN 'Resolved'
              WHEN LOWER(COALESCE(ir.status, '')) = 'closed' THEN 'Closed'
              ELSE 'Other'
            END AS outcome_key,
            COUNT(*)::int AS count
       FROM incident_reports ir
      WHERE ${where}
      GROUP BY 1
      ORDER BY count DESC`,
    params
  );
  return res.rows;
}

async function queryDepartmentClocks(filters) {
  const { where, params } = buildWhere(filters);
  const res = await pool.query(
    `WITH scoped AS (
        SELECT ir.report_id, ir.created_at,
               LOWER(BTRIM(d.department_code)) AS code,
               MIN(d.dispatched_at) AS dispatched_at,
               MIN(d.actual_arrival_at) AS actual_arrival_at
          FROM incident_reports ir
          JOIN dispatches d ON d.report_id = ir.report_id
         WHERE ${where}
           AND d.department_code IS NOT NULL
           AND BTRIM(d.department_code) <> ''
         GROUP BY ir.report_id, ir.created_at, LOWER(BTRIM(d.department_code))
      ),
      first_code AS (
        SELECT DISTINCT ON (report_id) report_id, code
          FROM scoped
         ORDER BY report_id, dispatched_at ASC NULLS LAST
      ),
      esc_only AS (
        SELECT ir.report_id, ir.created_at, LOWER(BTRIM(dept.code)) AS code,
               NULL::timestamptz AS dispatched_at, NULL::timestamptz AS actual_arrival_at
          FROM incident_reports ir
          JOIN incident_escalations ie ON ie.report_id = ir.report_id
          JOIN departments dept ON dept.department_id IN (ie.to_department_id, ie.from_department_id)
         WHERE ${where}
           AND NOT EXISTS (
             SELECT 1 FROM scoped s WHERE s.report_id = ir.report_id AND s.code = LOWER(BTRIM(dept.code))
           )
      ),
      vol_scoped AS (
        SELECT ir.report_id, ir.created_at,
               'volunteers'::text AS code,
               ir.accepted_at AS dispatched_at,
               (SELECT MIN(h.updated_at) FROM responder_status_history h
                 WHERE h.report_id = ir.report_id
                   AND LOWER(COALESCE(h.new_status, '')) = 'on scene') AS actual_arrival_at
          FROM incident_reports ir
         WHERE ${where}
           AND ir.accepted_by_user_id IS NOT NULL
      ),
      all_rows AS (
        SELECT s.*, CASE WHEN f.code = s.code THEN 'primary' ELSE 'supporting' END AS role
          FROM scoped s
          JOIN first_code f ON f.report_id = s.report_id
        UNION ALL
        SELECT e.*, 'supporting'::text AS role FROM esc_only e
        UNION ALL
        SELECT v.report_id, v.created_at, v.code, v.dispatched_at, v.actual_arrival_at,
               CASE WHEN EXISTS (SELECT 1 FROM dispatches d WHERE d.report_id = v.report_id) THEN 'supporting' ELSE 'primary' END AS role
          FROM vol_scoped v
      )
      SELECT COALESCE(NULLIF(BTRIM(dep.name), ''), CASE WHEN x.code = 'volunteers' THEN 'Volunteers' ELSE x.code END, 'unassigned') AS key,
             COUNT(*) FILTER (WHERE x.role = 'primary')::int AS primary_n,
             COUNT(*) FILTER (WHERE x.role = 'supporting')::int AS supporting_n,
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (x.dispatched_at - x.created_at))
             ) FILTER (WHERE x.dispatched_at IS NOT NULL AND x.dispatched_at >= x.created_at) AS dispatch_p50,
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (x.actual_arrival_at - x.created_at))
             ) FILTER (WHERE x.actual_arrival_at IS NOT NULL AND x.actual_arrival_at >= x.created_at) AS arrival_p50,
             COUNT(*) FILTER (WHERE x.dispatched_at IS NOT NULL)::int AS n
        FROM all_rows x
        LEFT JOIN departments dep ON LOWER(BTRIM(dep.code)) = x.code
       GROUP BY 1
       ORDER BY n DESC
       LIMIT 50`,
    params
  );
  return res.rows;
}

function alignSeries(current, previous, durationMs) {
  const prevMap = new Map(
    previous.map((row) => [new Date(row.bucket).getTime() + durationMs, num(row.count)])
  );
  return current.map((row) => {
    const t = new Date(row.bucket).getTime();
    return {
      bucket: row.bucket,
      current: num(row.count),
      previous: prevMap.get(t) || 0,
    };
  });
}

function deltaPct(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function getOverview(filters) {
  const trunc = filters.durationMs <= 90 * 24 * 60 * 60 * 1000 ? 'day' : 'week';
  const prevFilters = {
    ...filters,
    from: new Date(new Date(filters.from).getTime() - filters.durationMs).toISOString(),
    to: filters.from,
  };

  const skipDeptBreakdown = filters.department_code || filters.volunteer_scope;

  const [
    volume,
    prevVolume,
    clocks,
    types,
    barangays,
    barangayTypeMix,
    typeBarangay,
    severity,
    status,
    closure,
    departments,
    heatmap,
    timeseries,
    prevSeries,
    severityClocks,
    escalations,
    incidentsCount,
    concurrent,
    exceptions,
    funnel,
    utilization,
    outcomes,
    departmentClocks,
  ] = await Promise.all([
    queryVolume(filters),
    queryVolume(prevFilters),
    queryClocks(filters),
    queryGroup(filters, `COALESCE(NULLIF(BTRIM(ir.incident_type), ''), 'unknown')`, 1),
    queryGroup(filters, `COALESCE(NULLIF(BTRIM(ir.barangay), ''), 'Unknown')`, 1),
    queryBarangayTypeMix(filters),
    queryTypeBarangay(filters),
    queryGroup(filters, `COALESCE(NULLIF(BTRIM(ir.severity_level), ''), 'unknown')`, 1),
    queryGroup(filters, `COALESCE(NULLIF(BTRIM(ir.status), ''), 'unknown')`, 1),
    queryGroup(filters, `COALESCE(NULLIF(BTRIM(ir.closure_method), ''), 'unset')`, 1, { extraWhere: `AND LOWER(COALESCE(ir.status, '')) IN ('resolved', 'closed')` }),
    skipDeptBreakdown ? Promise.resolve([]) : queryByDepartment(filters),
    queryHeatmap(filters),
    queryTimeseries(filters, trunc),
    queryTimeseries(prevFilters, trunc),
    querySeverityClocks(filters),
    queryEscalationsSafe(filters),
    countFiltered(filters),
    queryConcurrent(filters),
    queryExceptions(filters),
    queryEscalationFunnel(filters),
    queryUtilization(filters),
    queryOutcomes(filters),
    skipDeptBreakdown ? Promise.resolve([]) : queryDepartmentClocks(filters),
  ]);

  const barangaysWithTypes = attachBarangayTypes(
    barangays.map((row) => ({ key: row.key, count: num(row.count), critical_count: num(row.critical_count) })),
    barangayTypeMix
  );

  const incidents = num(volume.incidents);
  const prevIncidents = num(prevVolume.incidents);
  const critical = num(volume.critical_count);
  const prevCritical = num(prevVolume.critical_count);
  const unserved = num(volume.unserved_count);
  const prevUnserved = num(prevVolume.unserved_count);
  const overdue = num(volume.overdue_count);
  const prevOverdue = num(prevVolume.overdue_count);
  const topBarangay = barangaysWithTypes[0] || barangays[0] || null;
  const textCount = Math.max(0, incidents - num(volume.sos_count) - num(volume.voice_count));
  const dispatchN = num(clocks.dispatch_n);
  const arrivalN = num(clocks.arrival_n);
  const exceptionAny = num(exceptions.any_count);
  const escalatedN = num(funnel.escalated_n);
  const peak = peakFromHeatmap(heatmap);

  return {
    generated_at: new Date().toISOString(),
    timezone: TZ,
    range: {
      from: filters.from,
      to: filters.to,
      previous_from: prevFilters.from,
      previous_to: prevFilters.to,
      granularity: trunc,
    },
    kpis: {
      incidents,
      previous_incidents: prevIncidents,
      incidents_delta_pct: deltaPct(incidents, prevIncidents),
      critical,
      previous_critical: prevCritical,
      critical_delta_pct: deltaPct(critical, prevCritical),
      open: num(volume.open_count),
      previous_open: num(prevVolume.open_count),
      closed: num(volume.closed_count),
      previous_closed: num(prevVolume.closed_count),
      duplicate_rate: rate(num(volume.duplicate_count), incidents),
      previous_duplicate_rate: rate(num(prevVolume.duplicate_count), prevIncidents),
      unserved,
      unserved_pct: rate(unserved, incidents),
      previous_unserved: prevUnserved,
      overdue,
      overdue_pct: rate(overdue, incidents),
      previous_overdue: prevOverdue,
      dispatch_sla: rate(num(clocks.dispatch_within_target), dispatchN),
      arrival_sla: rate(num(clocks.arrival_within_target), arrivalN),
      unassigned: num(volume.unassigned_count),
      never_dispatched_share: rate(num(volume.never_dispatched_count), incidents),
      volunteer_share: rate(num(volume.volunteer_count), incidents),
      mismatch_rate: rate(num(volume.mismatch_count), incidents),
      backup_rate: rate(num(volume.backup_count), incidents),
      mean_ai_confidence: volume.mean_ai_confidence == null ? null : Math.round(num(volume.mean_ai_confidence) * 1000) / 1000,
      top_barangay: topBarangay ? { name: topBarangay.key, n: num(topBarangay.count) } : null,
      count_check: incidentsCount,
    },
    clocks: {
      first_action: clockShape(clocks.first_action_p50, clocks.first_action_p90, clocks.first_action_p95, clocks.first_action_n),
      dispatch: clockShape(clocks.dispatch_p50, clocks.dispatch_p90, clocks.dispatch_p95, clocks.dispatch_n, {
        pct_within_target: rate(num(clocks.dispatch_within_target), dispatchN),
        target_seconds: DISPATCH_TARGET_SECONDS,
      }),
      arrival: clockShape(clocks.arrival_p50, clocks.arrival_p90, clocks.arrival_p95, clocks.arrival_n, {
        pct_within_target: rate(num(clocks.arrival_within_target), arrivalN),
        target_seconds: ARRIVAL_TARGET_SECONDS,
      }),
      resolve: clockShape(clocks.resolve_p50, clocks.resolve_p90, clocks.resolve_p95, clocks.resolve_n),
    },
    escalations: {
      total: num(escalations.total),
      inbound: num(escalations.inbound),
      outbound: num(escalations.outbound),
    },
    concurrent,
    peak: {
      ...peak,
      max_concurrent: concurrent.max,
      avg_concurrent: concurrent.avg,
    },
    exceptions: {
      any_count: exceptionAny,
      any_pct: rate(exceptionAny, incidents),
      reassignment: num(exceptions.reassign_count),
      auto_assign_mismatch: num(exceptions.mismatch_count),
      backup_requested: num(exceptions.backup_count),
      escalation_declined: num(exceptions.declined_count),
      other: 0,
    },
    escalation_funnel: {
      escalated: escalatedN,
      accepted: num(funnel.accepted_n),
      dispatched: num(funnel.dispatched_n),
      arrived: num(funnel.arrived_n),
      accepted_pct: rate(num(funnel.accepted_n), escalatedN),
      dispatched_pct: rate(num(funnel.dispatched_n), escalatedN),
      arrived_pct: rate(num(funnel.arrived_n), escalatedN),
      processing_p50_seconds: funnel.processing_p50 == null ? null : num(funnel.processing_p50),
    },
    utilization: {
      units_used: num(utilization.units_used),
      dispatch_count: num(utilization.dispatch_count),
    },
    outcomes: outcomes.map((row) => ({
      key: row.outcome_key,
      count: num(row.count),
      pct: rate(num(row.count), incidents),
    })),
    demand: {
      types: types.map((row) => ({ key: row.key, count: num(row.count), pct: rate(num(row.count), incidents) })),
      barangays: barangaysWithTypes.map((row) => ({
        key: row.key,
        count: num(row.count),
        pct: rate(num(row.count), incidents),
        critical_count: num(row.critical_count),
        types: (row.types || []).map((t) => ({ key: t.key, count: num(t.count) })),
      })),
      type_barangay: typeBarangay.map((row) => ({
        incident_type: row.incident_type,
        barangay: row.barangay,
        count: num(row.count),
      })),
      channels: [
        { key: 'sos', count: num(volume.sos_count), pct: rate(num(volume.sos_count), incidents) },
        { key: 'voice', count: num(volume.voice_count), pct: rate(num(volume.voice_count), incidents) },
        { key: 'text', count: textCount, pct: rate(textCount, incidents) },
      ],
    },
    timeseries: alignSeries(timeseries, prevSeries, filters.durationMs),
    breakdowns: {
      severity: severity.map((row) => ({ key: row.key, count: num(row.count) })),
      status: status.map((row) => ({ key: row.key, count: num(row.count) })),
      department: departments.map((row) => ({ key: row.key, count: num(row.count) })),
      closure: closure.map((row) => ({ key: row.key, count: num(row.count) })),
      severity_clocks: severityClocks,
      department_clocks: departmentClocks.map((row) => ({
        key: row.key,
        primary_n: num(row.primary_n),
        supporting_n: num(row.supporting_n),
        dispatch_p50_seconds: row.dispatch_p50 == null ? null : num(row.dispatch_p50),
        arrival_p50_seconds: row.arrival_p50 == null ? null : num(row.arrival_p50),
        n: num(row.n),
      })),
    },
    heatmap,
    footnotes: {
      department_breakdown_may_double_count: !skipDeptBreakdown,
      dispatch_target: 'Internal 8-minute dispatch target, not NFPA.',
      arrival_target: 'Internal 10-minute arrival target, not NFPA.',
      overdue: 'Still open at range end and created more than 30 minutes earlier.',
      clocks_exclude_null: 'Null clocks excluded from percentiles.',
      unserved: 'No dispatch, no escalation, and no volunteer accepted_at.',
    },
  };
}

async function listIncidents(filters, { limit = 20, offset = 0, search = '', sort = 'created_at', direction = 'desc' } = {}) {
  const { where, params } = buildWhere(filters);
  let extra = '';
  if (search && String(search).trim()) {
    const term = String(search).trim();
    const id = parseInt(term, 10);
    if (!Number.isNaN(id) && String(id) === term) {
      params.push(id);
      extra += ` AND ir.report_id = $${params.length}`;
    } else {
      params.push(`%${term}%`);
      extra += ` AND ir.barangay ILIKE $${params.length}`;
    }
  }
  const sortCol = SORT_COLUMNS[sort] || SORT_COLUMNS.created_at;
  const dir = String(direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM incident_reports ir WHERE ${where}${extra}`,
    params
  );
  const listParams = [...params, limit, offset];
  const listRes = await pool.query(
    `SELECT ir.report_id, ir.incident_type, ir.severity_level, ir.status, ir.barangay,
            ir.created_at, ir.resolved_at, ir.closed_at, ir.is_duplicate, ir.is_archived
       FROM incident_reports ir
      WHERE ${where}${extra}
      ORDER BY ${sortCol} ${dir} NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams
  );
  return { items: listRes.rows, total: num(countRes.rows[0]?.total) };
}

async function exportCsv(filters) {
  const { where, params } = buildWhere(filters);
  const count = await countFiltered(filters);
  if (count > EXPORT_ROW_CAP) {
    const err = new Error(`Export exceeds ${EXPORT_ROW_CAP} rows (${count}). Narrow the date range or filters.`);
    err.code = 'EXPORT_TOO_LARGE';
    err.total = count;
    throw err;
  }
  const overview = await getOverview(filters);
  const listRes = await pool.query(
    `SELECT ir.report_id, ir.incident_type, ir.severity_level, ir.status, ir.barangay,
            ir.created_at, ir.resolved_at, ir.closed_at, ir.is_duplicate, ir.is_archived,
            (SELECT STRING_AGG(DISTINCT d.department_code, '|') FROM dispatches d WHERE d.report_id = ir.report_id) AS department_codes
       FROM incident_reports ir
      WHERE ${where}
      ORDER BY ir.created_at DESC
      LIMIT ${EXPORT_ROW_CAP}`,
    params
  );

  const lines = [];
  lines.push('# RescueLink Insights export');
  lines.push(`# generated_at,${csvCell(overview.generated_at)}`);
  lines.push(`# from,${csvCell(filters.from)}`);
  lines.push(`# to,${csvCell(filters.to)}`);
  lines.push(`# timezone,${csvCell(TZ)}`);
  lines.push(`# incidents,${overview.kpis.incidents}`);
  lines.push(`# critical,${overview.kpis.critical}`);
  lines.push(`# open,${overview.kpis.open}`);
  lines.push(`# closed,${overview.kpis.closed}`);
  lines.push(`# duplicate_rate,${overview.kpis.duplicate_rate}`);
  lines.push(`# unserved_pct,${overview.kpis.unserved_pct}`);
  lines.push(`# overdue_pct,${overview.kpis.overdue_pct}`);
  lines.push(`# dispatch_sla,${overview.kpis.dispatch_sla}`);
  lines.push(`# arrival_sla,${overview.kpis.arrival_sla}`);
  lines.push(`# first_action_p50_seconds,${overview.clocks.first_action.p50_seconds ?? ''}`);
  lines.push(`# first_action_n,${overview.clocks.first_action.n}`);
  lines.push(`# dispatch_p50_seconds,${overview.clocks.dispatch.p50_seconds ?? ''}`);
  lines.push(`# dispatch_p90_seconds,${overview.clocks.dispatch.p90_seconds ?? ''}`);
  lines.push(`# dispatch_p95_seconds,${overview.clocks.dispatch.p95_seconds ?? ''}`);
  lines.push(`# dispatch_n,${overview.clocks.dispatch.n}`);
  lines.push(`# arrival_p50_seconds,${overview.clocks.arrival.p50_seconds ?? ''}`);
  lines.push(`# arrival_n,${overview.clocks.arrival.n}`);
  lines.push(`# resolve_p50_seconds,${overview.clocks.resolve.p50_seconds ?? ''}`);
  lines.push(`# resolve_n,${overview.clocks.resolve.n}`);
  lines.push('# types');
  lines.push('type,count,pct');
  for (const row of overview.demand.types) {
    lines.push([csvCell(row.key), row.count, row.pct].join(','));
  }
  lines.push('# barangays');
  lines.push('barangay,count,pct,critical_count,top_types');
  for (const row of overview.demand.barangays) {
    const topTypes = (row.types || []).map((t) => `${t.key}:${t.count}`).join('; ');
    lines.push([csvCell(row.key), row.count, row.pct, row.critical_count, csvCell(topTypes)].join(','));
  }
  lines.push('# type_barangay');
  lines.push('incident_type,barangay,count');
  for (const row of overview.demand.type_barangay) {
    lines.push([csvCell(row.incident_type), csvCell(row.barangay), row.count].join(','));
  }
  lines.push('# incidents');
  const header = ['report_id', 'incident_type', 'severity_level', 'status', 'barangay', 'department_codes', 'created_at', 'resolved_at', 'closed_at', 'is_duplicate', 'is_archived'];
  lines.push(header.join(','));
  for (const row of listRes.rows) {
    lines.push(header.map((key) => csvCell(row[key])).join(','));
  }
  return lines.join('\n');
}

module.exports = {
  TZ,
  DISPATCH_TARGET_SECONDS,
  ARRIVAL_TARGET_SECONDS,
  OVERDUE_SECONDS,
  EXPORT_ROW_CAP,
  parseTimeRange,
  buildWhere,
  csvCell,
  countFiltered,
  getOverview,
  listIncidents,
  exportCsv,
};
