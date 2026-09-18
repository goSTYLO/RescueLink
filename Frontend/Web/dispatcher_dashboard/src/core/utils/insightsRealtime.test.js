const {
  createIncidentUpdatedScheduler,
  INSIGHTS_WS_DEBOUNCE_MS,
} = require('./insightsRealtime');

describe('createIncidentUpdatedScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces multiple handle calls into one onFire', () => {
    const onFire = jest.fn();
    const scheduler = createIncidentUpdatedScheduler(onFire, INSIGHTS_WS_DEBOUNCE_MS, { visibilityState: 'visible' });

    scheduler.handle();
    scheduler.handle();
    scheduler.handle();
    expect(onFire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(INSIGHTS_WS_DEBOUNCE_MS - 1);
    expect(onFire).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);

    scheduler.cancel();
  });

  it('does not schedule when tab is hidden', () => {
    const onFire = jest.fn();
    const scheduler = createIncidentUpdatedScheduler(onFire, INSIGHTS_WS_DEBOUNCE_MS, { visibilityState: 'hidden' });

    scheduler.handle();
    jest.advanceTimersByTime(INSIGHTS_WS_DEBOUNCE_MS * 2);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('cancel clears pending debounce', () => {
    const onFire = jest.fn();
    const scheduler = createIncidentUpdatedScheduler(onFire, 500, { visibilityState: 'visible' });

    scheduler.handle();
    scheduler.cancel();
    jest.advanceTimersByTime(500);
    expect(onFire).not.toHaveBeenCalled();
  });
});
