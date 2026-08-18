import {
  getIncidentById,
  getIncidents,
  getIncidentWithAi,
  getIncidentDuplicates,
  getPotentialDuplicates,
  linkDuplicate,
  unlinkDuplicate,
  normalizeIncidentStatus,
  reclassifyIncident,
  updateIncidentStatus,
  verifyIncident,
} from '@/data/api/incidents.api';

jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
}));

describe('incidents.api contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
    global.fetch = jest.fn();
  });

  test('normalizeIncidentStatus uses canonical lifecycle values', () => {
    expect(normalizeIncidentStatus('pending')).toBe('pending');
    expect(normalizeIncidentStatus('verified')).toBe('verified');
    expect(normalizeIncidentStatus('in_progress')).toBe('in_progress');
    expect(normalizeIncidentStatus('resolved')).toBe('resolved');
    expect(normalizeIncidentStatus('unknown')).toBe('pending');
  });

  test('getIncidents sends canonical status query and auth headers', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([]),
    });

    await getIncidents({ status: 'VERIFIED', limit: 25, offset: 10 });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents?');
    expect(url).toContain('status=verified');
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=10');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.headers['x-request-id']).toContain('web-incidents-');
  });

  test('getIncidents sends volunteer_accepted filter when requested', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([]),
    });

    await getIncidents({ volunteer_accepted: true });

    const [url] = fetch.mock.calls[0];
    expect(url).toContain('volunteer_accepted=true');
  });

  test('getIncidents returns pagination metadata when requested', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'x-total-count' ? '57' : null) },
      text: async () => JSON.stringify([{ report_id: 1 }]),
    });

    const result = await getIncidents({ limit: 8, offset: 16, withMeta: true });

    expect(result).toEqual({
      items: [{ report_id: 1 }],
      totalCount: 57,
      limit: 8,
      offset: 16,
    });
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('meta=1');
    expect(url).toContain('limit=8');
    expect(url).toContain('offset=16');
  });

  test('verifyIncident uses POST and standardized error message fallback', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: 'Blockchain service unavailable' }),
    });

    await expect(verifyIncident(101)).rejects.toThrow('Blockchain service unavailable');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/101/verify');
    expect(options.method).toBe('POST');
  });

  test('getIncidentById returns parsed data', async () => {
    const incident = { report_id: 77, status: 'pending' };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(incident),
    });

    const data = await getIncidentById(77);
    expect(data).toEqual(incident);
  });

  test('getIncidentWithAi hits dedicated endpoint', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ incident: { report_id: 77 }, ai_classification: null }),
    });

    const data = await getIncidentWithAi(77);
    expect(data.incident.report_id).toBe(77);
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/77/with-ai');
  });

  test('reclassifyIncident sends payload with x-request-id header', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    await reclassifyIncident(88, {
      incident_type: 'medical',
      severity_level: 'high',
      reason: 'Manual override after dispatcher review',
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/88/reclassify');
    expect(options.method).toBe('POST');
    expect(options.headers['x-request-id']).toContain('web-reclassify-');
    expect(JSON.parse(options.body)).toEqual({
      incident_type: 'medical',
      severity_level: 'high',
      reason: 'Manual override after dispatcher review',
    });
  });

  test('updateIncidentStatus sends PATCH payload', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, incident: { report_id: 1, status: 'resolved' } }),
    });

    await updateIncidentStatus(1, 'resolved');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/1/status');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ status: 'resolved' });
  });

  test('updateIncidentStatus sends closed status with closure metadata', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, incident: { report_id: 2, status: 'closed' } }),
    });

    await updateIncidentStatus(2, 'closed', {
      closure_notes: 'Units cleared scene.',
      closure_method: 'Successful Response',
    });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      status: 'closed',
      closure_notes: 'Units cleared scene.',
      closure_method: 'Successful Response',
    });
  });

  test('getIncidentDuplicates calls correct endpoint', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ is_duplicate: false, cluster: [] }),
    });

    await getIncidentDuplicates(123);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/123/duplicates');
    expect(options.method).toBe('GET');
  });

  test('getPotentialDuplicates calls correct endpoint', async () => {
    const { getPotentialDuplicates } = require('@/data/api/incidents.api');
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ potential_duplicates: [] }),
    });

    await getPotentialDuplicates(456);
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/456/potential-duplicates');
  });

  test('linkDuplicate sends POST with parent_report_id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    await linkDuplicate(123, 100, 'Same location');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/123/link-duplicate');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ parent_report_id: 100, reason: 'Same location' });
  });

  test('unlinkDuplicate sends POST with reason', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    await unlinkDuplicate(123, 'False positive');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/incidents/123/unlink-duplicate');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ reason: 'False positive' });
  });
});
