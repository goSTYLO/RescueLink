function isAwaitingActionStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'verified' || s === 'new';
}

function isInProgressStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'in progress' || s === 'in-progress' || s === 'in_progress';
}

function isResolvedStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'resolved';
}

/** Counts for dashboard incident overview header KPIs. */
export function countIncidentOverviewKpis(incidents, { totalOverride } = {}) {
  const list = Array.isArray(incidents) ? incidents : [];
  return {
    totalAssigned: totalOverride ?? list.length,
    awaitingAction: list.filter((i) => isAwaitingActionStatus(i?.status)).length,
    inProgress: list.filter((i) => isInProgressStatus(i?.status)).length,
    resolved: list.filter((i) => isResolvedStatus(i?.status)).length,
  };
}
