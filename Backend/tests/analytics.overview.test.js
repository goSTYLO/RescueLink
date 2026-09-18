jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Analytics = require('../src/models/analytics');
const { departmentMembershipSql } = require('../src/utils/incidentDepartmentScope');

describe('analytics overview', () => {
  const range = {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T23:59:59.000Z',
    durationMs: 30 * 24 * 60 * 60 * 1000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockImplementation(async (sql) => {
      const s = String(sql);
      if (s.includes('COUNT(*)::int AS total FROM incident_reports')) {
        return { rows: [{ total: 4 }] };
      }
      if (s.includes('AS incidents')) {
        return {
          rows: [{
            incidents: 4,
            open_count: 1,
            closed_count: 2,
            duplicate_count: 1,
            critical_count: 2,
            unserved_count: 1,
            overdue_count: 1,
            unassigned_count: 0,
            never_dispatched_count: 0,
            volunteer_count: 1,
            mismatch_count: 0,
            backup_count: 0,
            mean_ai_confidence: 0.82,
            sos_count: 1,
            voice_count: 1,
          }],
        };
      }
      if (s.includes('AS max_concurrent')) {
        return { rows: [{ max_concurrent: 3, avg_concurrent: 1.5 }] };
      }
      if (s.includes('AS reassign_count')) {
        return { rows: [{ any_count: 1, reassign_count: 1, mismatch_count: 0, backup_count: 0, declined_count: 0 }] };
      }
      if (s.includes('AS escalated_n')) {
        return { rows: [{ escalated_n: 2, accepted_n: 1, dispatched_n: 1, arrived_n: 0, processing_p50: 120 }] };
      }
      if (s.includes('AS units_used')) {
        return { rows: [{ units_used: 2, dispatch_count: 5 }] };
      }
      if (s.includes('AS outcome_key')) {
        return { rows: [{ outcome_key: 'Resolved', count: 2 }] };
      }
      if (s.includes('AS primary_n')) {
        return { rows: [{ key: 'PNP', primary_n: 2, supporting_n: 1, dispatch_p50: 90, arrival_p50: 400, n: 2 }] };
      }
      if (s.includes('first_action_p50')) {
        return {
          rows: [{
            first_action_p50: 60,
            first_action_p90: 180,
            first_action_p95: 240,
            first_action_n: 3,
            dispatch_p50: 120,
            dispatch_p90: 300,
            dispatch_p95: 420,
            dispatch_n: 3,
            dispatch_within_target: 2,
            arrival_p50: 400,
            arrival_p90: 900,
            arrival_p95: 1100,
            arrival_n: 2,
            arrival_within_target: 1,
            resolve_p50: 1800,
            resolve_p90: 3600,
            resolve_p95: 4000,
            resolve_n: 2,
          }],
        };
      }
      if (s.includes('incident_escalations')) {
        return { rows: [{ total: 1, inbound: 1, outbound: 0 }] };
      }
      if (s.includes('EXTRACT(DOW')) {
        return { rows: [{ dow: 1, hour: 9, count: 2 }] };
      }
      return { rows: [] };
    });
  });

  it('sanitizes CSV formula injection', () => {
    expect(Analytics.csvCell('=cmd')).toBe("'=cmd");
    expect(Analytics.csvCell('+1+1')).toBe("'+1+1");
    expect(Analytics.csvCell('-2+3')).toBe("'-2+3");
    expect(Analytics.csvCell('@sum')).toBe("'@sum");
    expect(Analytics.csvCell('medical, fire')).toBe('"medical, fire"');
  });

  it('rejects inverted or oversized date ranges', () => {
    expect(() => Analytics.parseTimeRange('2026-08-10', '2026-08-01')).toThrow(/before/);
    expect(() => Analytics.parseTimeRange('2024-01-01', '2026-08-01')).toThrow(/366/);
  });

  it('uses historical department scope (any escalation, not only open)', () => {
    const { where } = Analytics.buildWhere({ ...range, department_code: 'pnp' });
    expect(where).toContain('dispatches');
    expect(where).toContain('incident_escalations');
    expect(where).not.toMatch(/ie\.status IN \('pending', 'accepted'\)/);
    const ops = departmentMembershipSql('ir.report_id', 1, { historical: false });
    expect(ops).toMatch(/ie\.status IN \('pending', 'accepted'\)/);
  });

  it('keeps overview incident total equal to COUNT(*) for the same filters', async () => {
    const overview = await Analytics.getOverview(range);
    const counted = await Analytics.countFiltered(range);
    expect(overview.kpis.incidents).toBe(4);
    expect(overview.kpis.count_check).toBe(4);
    expect(counted).toBe(overview.kpis.incidents);
    expect(overview.clocks.dispatch.n).toBe(3);
    expect(overview.clocks.arrival.n).toBe(2);
    expect(overview.clocks.first_action.n).toBe(3);
    expect(overview.clocks.dispatch.p95_seconds).toBe(420);
  });

  it('matches unknown type/barangay to blank values, not the literal string', () => {
    const typed = Analytics.buildWhere({ ...range, incident_type: 'unknown' });
    expect(typed.where).toMatch(/NULLIF\(BTRIM\(ir.incident_type\), ''\) IS NULL/);
    const placed = Analytics.buildWhere({ ...range, barangay: 'Unknown' });
    expect(placed.where).toMatch(/NULLIF\(BTRIM\(ir.barangay\), ''\) IS NULL/);
  });

  it('counts open/closed from resolve timestamps at range end, not live status', async () => {
    await Analytics.getOverview(range);
    const volumeSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('AS incidents'))?.[0] || '';
    expect(volumeSql).toMatch(/resolved_at/);
    expect(volumeSql).toMatch(/closed_at/);
    expect(volumeSql).not.toMatch(/IN \('pending', 'verified', 'in_progress'\)/);
  });

  it('counts unserved as no dispatch, no escalation, and no volunteer accepted_at', async () => {
    const overview = await Analytics.getOverview(range);
    expect(overview.kpis.unserved).toBe(1);
    const volumeSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('AS unserved_count'))?.[0] || '';
    expect(volumeSql).toMatch(/accepted_at IS NULL/);
    expect(volumeSql).toMatch(/NOT EXISTS \(SELECT 1 FROM dispatches/);
    expect(volumeSql).toMatch(/incident_escalations/);
  });

  it('locks SLA and overdue constants at 8 min dispatch, 10 min arrival, 30 min overdue', async () => {
    expect(Analytics.DISPATCH_TARGET_SECONDS).toBe(8 * 60);
    expect(Analytics.ARRIVAL_TARGET_SECONDS).toBe(10 * 60);
    expect(Analytics.OVERDUE_SECONDS).toBe(30 * 60);
    await Analytics.getOverview(range);
    const clockSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('dispatch_within_target'))?.[0] || '';
    expect(clockSql).toContain(String(8 * 60));
    expect(clockSql).toContain(String(10 * 60));
    const volumeSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('AS overdue_count'))?.[0] || '';
    expect(volumeSql).toContain(String(30 * 60));
  });

  it('measures arrival from created_at and excludes null clocks from percentiles', async () => {
    await Analytics.getOverview(range);
    const clockSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('AS arrival_s'))?.[0] || '';
    expect(clockSql).toMatch(/AS arrival_s/);
    expect(clockSql).toMatch(/- ir\.created_at\)\) AS arrival_s/);
    expect(clockSql).toMatch(/FILTER \(WHERE first_action_s >= 0\)/);
  });

  it('casts dispatcher audit details to jsonb for report_id lookup', async () => {
    await Analytics.getOverview(range);
    const exceptionsSql = pool.query.mock.calls.find(([sql]) => String(sql).includes('AS reassign_count'))?.[0] || '';
    expect(exceptionsSql).toMatch(/details::jsonb\)->>'report_id'/);
  });

  it('volunteer scope filters primary acceptor incidents', () => {
    const { where } = Analytics.buildWhere({ ...range, volunteer_scope: true });
    expect(where).toMatch(/accepted_by_user_id IS NOT NULL/);
    expect(where).not.toMatch(/incident_escalations/);
  });

  it('city-wide department breakdown includes volunteers union', async () => {
    await Analytics.getOverview(range);
    const deptSql = pool.query.mock.calls.find(([sql]) => String(sql).includes("'volunteers'::text"))?.[0] || '';
    expect(deptSql).toMatch(/accepted_by_user_id IS NOT NULL/);
  });

  it('barangay demand query groups type mix per barangay', async () => {
    await Analytics.getOverview(range);
    const mixSql = pool.query.mock.calls.find(([sql]) => {
      const s = String(sql);
      return s.includes('AS barangay') && s.includes('AS incident_type') && s.includes('GROUP BY 1, 2');
    })?.[0] || '';
    expect(mixSql).toBeTruthy();
  });

  it('skips department breakdown when volunteer scope is set', async () => {
    await Analytics.getOverview({ ...range, volunteer_scope: true });
    const deptSql = pool.query.mock.calls.find(([sql]) => String(sql).includes("'volunteers'::text AS key"))?.[0];
    expect(deptSql).toBeUndefined();
  });

  it('scopes escalation totals to volunteer incidents when volunteer_scope is set', async () => {
    await Analytics.getOverview({ ...range, volunteer_scope: true });
    const escSql = pool.query.mock.calls.find(([sql]) => {
      const s = String(sql);
      return s.includes('FROM incident_escalations ie') && s.includes('JOIN incident_reports ir');
    })?.[0] || '';
    expect(escSql).toMatch(/accepted_by_user_id IS NOT NULL/);
  });
});
