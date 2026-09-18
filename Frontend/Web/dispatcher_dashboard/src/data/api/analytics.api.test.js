jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
}));

const { getAnalyticsOverview, getBarangaysGeojson } = require('./analytics.api');

describe('analytics.api inflight', () => {
  beforeEach(() => {
    sessionStorage.setItem('token', 't');
    global.fetch = jest.fn();
  });

  test('getAnalyticsOverview shares concurrent identical requests', async () => {
    let resolveFetch;
    fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const a = getAnalyticsOverview({ from: 'x', to: 'y' });
    const b = getAnalyticsOverview({ from: 'x', to: 'y' });
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      text: async () => JSON.stringify({ kpis: {} }),
      headers: { get: () => null },
    });
    const [first, second] = await Promise.all([a, b]);
    expect(first).toEqual(second);
  });

  test('getBarangaysGeojson caches after first success', async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }),
      headers: { get: () => null },
    });

    await getBarangaysGeojson();
    await getBarangaysGeojson();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
