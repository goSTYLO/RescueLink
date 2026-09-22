const {
  parseSeedCli,
  buildDispatchTimeline,
  channelMixRatios,
  seedCreatedAt,
} = require('../scripts/lib/seedAnalyticsFixtures');

describe('seedAnalyticsFixtures', () => {
  test('parseSeedCli defaults and caps', () => {
    const d = parseSeedCli([]);
    expect(d.incidentCount).toBe(300);
    expect(d.spanDays).toBe(90);
    const capped = parseSeedCli(['--count=9999', '--days=500']);
    expect(capped.incidentCount).toBe(2000);
    expect(capped.spanDays).toBe(366);
  });

  test('channel mix ratios sum to 1', () => {
    const { sos, voice, text } = channelMixRatios();
    expect(Math.round((sos + voice + text) * 1000) / 1000).toBe(1);
    expect(sos).toBeCloseTo(0.1, 5);
    expect(voice).toBeCloseTo(0.55, 5);
    expect(text).toBeCloseTo(0.35, 5);
  });

  test('dispatch timeline is monotonic from created', () => {
    const created = Date.parse('2026-01-01T08:00:00.000Z');
    for (let i = 0; i < 20; i += 1) {
      const t = buildDispatchTimeline(created, { index: i });
      expect(t.dispatchMs).toBeGreaterThanOrEqual(created);
      expect(t.arrivalMs).toBeGreaterThanOrEqual(t.dispatchMs);
      expect(t.resolvedMs).toBeGreaterThanOrEqual(t.arrivalMs);
      expect(t.closedMs).toBeGreaterThanOrEqual(t.resolvedMs);
    }
  });

  test('seedCreatedAt spans requested days', () => {
    const first = seedCreatedAt(0, 100, 90, Date.UTC(2026, 5, 1)).getTime();
    const last = seedCreatedAt(99, 100, 90, Date.UTC(2026, 5, 1)).getTime();
    const diffDays = (last - first) / 86400000;
    expect(diffDays).toBeGreaterThan(85);
    expect(diffDays).toBeLessThanOrEqual(90);
  });
});
