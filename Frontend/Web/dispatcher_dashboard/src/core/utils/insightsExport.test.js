const {
  buildInsightsExportFilename,
  formatInsightsExportStamp,
  slugFromChartId,
} = require('./insightsExport');

describe('insightsExport filenames', () => {
  const fixed = new Date('2026-09-27T05:15:30.000Z');

  it('maps chart ids to slugs', () => {
    expect(slugFromChartId('channels')).toBe('reporting-channels');
    expect(slugFromChartId('barangays_map')).toBe('geographic-demand');
    expect(slugFromChartId()).toBe('full-report');
  });

  it('formats Manila datetime stamp', () => {
    expect(formatInsightsExportStamp(fixed)).toBe('20260927-131530');
  });

  it('builds insights-{slug}-{stamp}.{ext}', () => {
    expect(buildInsightsExportFilename('reporting-channels', 'pdf', fixed)).toBe(
      'insights-reporting-channels-20260927-131530.pdf',
    );
  });
});
