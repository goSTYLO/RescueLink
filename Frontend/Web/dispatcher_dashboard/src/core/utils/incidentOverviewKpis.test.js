import { countIncidentOverviewKpis } from '@/core/utils/incidentOverviewKpis';

describe('countIncidentOverviewKpis', () => {
  it('tallies overview KPIs by status', () => {
    const counts = countIncidentOverviewKpis([
      { status: 'Pending' },
      { status: 'Verified' },
      { status: 'In Progress' },
      { status: 'Resolved' },
    ]);
    expect(counts).toEqual({ totalAssigned: 4, awaitingAction: 1, inProgress: 1, resolved: 1 });
    expect(countIncidentOverviewKpis([], { totalOverride: 99 }).totalAssigned).toBe(99);
  });
});
