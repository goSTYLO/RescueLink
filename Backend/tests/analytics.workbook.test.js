const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { buildInsightsWorkbook } = require('../src/models/analyticsWorkbook');

const overview = {
  generated_at: '2026-09-27T00:00:00.000Z',
  timezone: 'Asia/Manila',
  department: { name: 'PNP' },
  kpis: {
    incidents: 4,
    critical: 2,
    open: 1,
    closed: 2,
    unserved: 1,
    overdue: 1,
    duplicate_rate: 25,
    unserved_pct: 25,
    overdue_pct: 25,
    dispatch_sla: 80,
    arrival_sla: 50,
  },
  clocks: {
    first_action: { p50_seconds: 60, n: 3 },
    dispatch: { p50_seconds: 120, p90_seconds: 300, p95_seconds: 420, n: 3 },
    arrival: { p50_seconds: 400, n: 2 },
    resolve: { p50_seconds: 1800, n: 2 },
  },
  demand: {
    types: [{ key: 'Fire', count: 3, pct: 75 }],
    barangays: [{ key: 'Poblacion', count: 2, pct: 50, critical_count: 1 }],
    type_barangay: [{ incident_type: 'Fire', barangay: 'Poblacion', count: 2 }],
    channels: [{ key: 'sos', count: 2, pct: 50 }],
  },
  timeseries: [{ bucket: '2026-09-01', current: 2, previous: 1 }],
  peak: { busiest_weekday: 'Monday', peak_hour_band: '08-09', peak_volume: 3, max_concurrent: 2, avg_concurrent: 1 },
  concurrent: { max: 2, avg: 1 },
  exceptions: { reassignment: 1, auto_assign_mismatch: 0, backup_requested: 0, escalation_declined: 0 },
  escalation_funnel: {
    escalated: 2, accepted: 1, dispatched: 1, arrived: 0,
    accepted_pct: 50, dispatched_pct: 50, arrived_pct: 0,
  },
  utilization: { units_used: 2, dispatch_count: 5 },
  outcomes: [{ key: 'Resolved', count: 2, pct: 50 }],
  breakdowns: {
    department: [{ key: 'PNP', count: 3 }],
    department_clocks: [],
    severity_clocks: [],
  },
};

const incidents = [{
  report_id: 1,
  incident_type: 'Fire',
  severity_level: 'high',
  status: 'closed',
  barangay: 'Poblacion',
  department_codes: 'PNP',
  created_at: '2026-09-01T00:00:00.000Z',
  resolved_at: null,
  closed_at: null,
  is_duplicate: false,
  is_archived: false,
}];

describe('analytics workbook', () => {
  it('writes one sheet per chart with a dataBar on Incident types and an Incidents header', async () => {
    const buffer = await buildInsightsWorkbook({
      overview,
      incidents,
      filters: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z' },
      generatedBy: 'tester',
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const names = wb.worksheets.map((sheet) => sheet.name);
    expect(names).toEqual(expect.arrayContaining([
      'Headline',
      'Incident types',
      'Barangays',
      'By department',
      'Incidents',
    ]));
    const types = wb.getWorksheet('Incident types');
    expect(String(types.getCell(1, 1).value)).toMatch(/Incident types/);
    expect(types.getCell(5, 1).value).toBe('Type');
    expect(types.getCell(6, 1).value).toBe('Fire');
    expect(types.getCell(6, 2).value).toBe(3);

    const incidentsSheet = wb.getWorksheet('Incidents');
    expect(incidentsSheet.getCell(5, 1).value).toBe('report_id');
    expect(incidentsSheet.getCell(6, 1).value).toBe(1);

    const zip = await JSZip.loadAsync(buffer);
    const xml = await Promise.all(
      Object.keys(zip.files)
        .filter((name) => name.endsWith('.xml'))
        .map((name) => zip.file(name).async('string'))
    );
    expect(xml.some((text) => text.includes('dataBar'))).toBe(true);
  });
});
