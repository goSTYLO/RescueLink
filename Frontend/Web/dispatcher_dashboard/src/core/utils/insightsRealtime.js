export const INSIGHTS_POLLING_INTERVAL_MS = 60000;
export const INSIGHTS_POLLING_WHEN_WS_CONNECTED_MS = 120000;
export const INSIGHTS_WS_DEBOUNCE_MS = 2000;

/**
 * Coalesce rapid incident:updated events; skip when the tab is hidden.
 * @param {() => void} onFire
 * @param {number} debounceMs
 * @param {{ visibilityState?: string }} visibility - inject for tests
 */
export function createIncidentUpdatedScheduler(onFire, debounceMs = INSIGHTS_WS_DEBOUNCE_MS, visibility = typeof document !== 'undefined' ? document : { visibilityState: 'visible' }) {
  let timer = null;
  return {
    handle() {
      if (visibility.visibilityState === 'hidden') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onFire();
      }, debounceMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
