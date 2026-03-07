import {
  mapIncidentTypeFilterToApi,
  normalizeIncidentTaskType,
  doesTeamSupportIncidentType,
} from '@/core/utils/incidentClassification';

describe('incident classification mapping helpers', () => {
  it('maps dashboard filter Other to API incident_type=other', () => {
    expect(mapIncidentTypeFilterToApi('Other')).toBe('other');
  });

  it('normalizes other classification explicitly', () => {
    expect(normalizeIncidentTaskType('other')).toBe('other');
    expect(normalizeIncidentTaskType('Others')).toBe('other');
  });

  it('treats other classification as wildcard task compatibility', () => {
    expect(doesTeamSupportIncidentType(['fire'], 'other')).toBe(true);
    expect(doesTeamSupportIncidentType(['medical'], 'others')).toBe(true);
  });

  it('preserves strict task compatibility for non-other classifications', () => {
    expect(doesTeamSupportIncidentType(['medical'], 'fire')).toBe(false);
    expect(doesTeamSupportIncidentType([], 'fire')).toBe(true);
    expect(doesTeamSupportIncidentType(['medical'], 'medical')).toBe(true);
  });
});
