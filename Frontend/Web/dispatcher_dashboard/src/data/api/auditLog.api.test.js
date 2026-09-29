/**
 * Regression: export must not read the body as JSON before blob()
 * (throws "body stream already read").
 */
jest.mock('@/data/api/http', () => ({
  createRequestId: () => 'test-req',
  getAuthHeaders: () => ({ Authorization: 'Bearer x' }),
  parseErrorMessage: (_data, fallback) => fallback,
  parseJsonOrEmpty: jest.fn(async () => ({ error: 'fail' })),
}));

jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:9999',
}));

const { parseJsonOrEmpty } = require('@/data/api/http');

describe('downloadAuditLogXlsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads blob on success without parsing JSON first', async () => {
    const blob = new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    let bodyReads = 0;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'attachment; filename="audit-log-test.xlsx"' },
      async blob() {
        bodyReads += 1;
        return blob;
      },
      async json() {
        bodyReads += 1;
        throw new Error('body stream already read');
      },
      async text() {
        bodyReads += 1;
        throw new Error('body stream already read');
      },
    });

    const createObjectURL = jest.fn(() => 'blob:mock');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const { downloadAuditLogXlsx } = require('@/data/api/auditLog.api');
    await downloadAuditLogXlsx({});

    expect(parseJsonOrEmpty).not.toHaveBeenCalled();
    expect(bodyReads).toBe(1);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });

  test('parses JSON only when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => null },
      async blob() {
        throw new Error('should not blob on error');
      },
    });

    const { downloadAuditLogXlsx } = require('@/data/api/auditLog.api');
    await expect(downloadAuditLogXlsx({})).rejects.toThrow(/Failed to export audit log/);
    expect(parseJsonOrEmpty).toHaveBeenCalled();
  });
});
