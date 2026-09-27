const { buildAuditLogWorkbook, actionLabel } = require('../src/models/auditLogWorkbook');

describe('auditLogWorkbook', () => {
  it('builds xlsx with navy header row', async () => {
    const buffer = await buildAuditLogWorkbook(
      [{
        created_at: '2026-01-15T10:00:00.000Z',
        user_email: 'dispatcher@example.com',
        action: 'dispatch_create',
        resource_type: 'dispatch',
        resource_id: 42,
        details: { report_id: 7 },
      }],
      {
        filterLine: 'Filters: (none)',
        generatedAt: '2026-01-15T10:05:00.000Z',
        generatedBy: 'tester',
      },
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('labels known actions', () => {
    expect(actionLabel('dispatch_create')).toBe('Dispatch created');
  });
});
