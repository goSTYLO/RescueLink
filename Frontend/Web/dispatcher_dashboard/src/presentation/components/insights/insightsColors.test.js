import {
  incidentTypeColor,
  severityColor,
  channelColor,
  exceptionColor,
  slaRowBarColor,
  percentileHex,
  choroplethFill,
  departmentColor,
  kpiAccentClass,
} from '@/presentation/components/insights/insightsColors';

describe('insightsColors', () => {
  it('maps incident types like badge classes', () => {
    expect(incidentTypeColor('fire')).toBe('#ea580c');
    expect(incidentTypeColor('medical_emergency')).toBe('#db2777');
    expect(incidentTypeColor('unknown_xyz')).toBe('#64748b');
  });

  it('maps severity to distinct hues', () => {
    expect(severityColor('critical')).toBe('#dc2626');
    expect(severityColor('low')).toBe('#16a34a');
  });

  it('assigns stable channel and exception colors', () => {
    expect(channelColor('mobile_app')).toBe('#134178');
    expect(exceptionColor('reassignment')).toBe('#d97706');
    expect(exceptionColor('auto_assign_mismatch')).toBe('#dc2626');
  });

  it('maps SLA row bar colors by metric id', () => {
    expect(slaRowBarColor('dispatch_sla')).toBe('#2563eb');
    expect(slaRowBarColor('arrival_sla')).toBe('#0d9488');
    expect(slaRowBarColor('duplicate_rate')).toBe('#7c3aed');
  });

  it('maps percentile kinds', () => {
    expect(percentileHex('p50')).toBe('#2563eb');
    expect(percentileHex('p90')).toBe('#0d9488');
    expect(percentileHex('p95')).toBe('#7c3aed');
  });

  it('ramps choropleth opacity with count', () => {
    expect(choroplethFill(0, 10)).toContain('0.06');
    expect(choroplethFill(10, 10)).toContain('rgba(19, 65, 120');
  });

  it('adds KPI accent border classes', () => {
    expect(kpiAccentClass('critical')).toContain('border-l-red');
    expect(kpiAccentClass('total_assigned')).toContain('border-l-blue');
    expect(kpiAccentClass('resolved')).toContain('border-l-emerald');
  });

  it('uses distinct green for Volunteers department bar', () => {
    expect(departmentColor('Volunteers')).toBe('#059669');
  });
});
