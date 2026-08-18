import {
  isIncidentEffectivelyResolved,
  isVolunteerResolved,
} from '@/core/utils/incidentDisplay';

describe('isIncidentEffectivelyResolved', () => {
  it('returns true when lifecycle status is resolved', () => {
    expect(isIncidentEffectivelyResolved({ status: 'Resolved', responderStatus: null })).toBe(true);
  });

  it('returns true when volunteer responder_status is Resolved but lifecycle is not', () => {
    expect(isIncidentEffectivelyResolved({
      status: 'In Progress',
      responderStatus: 'Resolved',
    })).toBe(true);
  });

  it('returns false when incident is closed', () => {
    expect(isIncidentEffectivelyResolved({
      status: 'Closed',
      responderStatus: 'Resolved',
    })).toBe(false);
  });

  it('returns false when neither lifecycle nor volunteer is resolved', () => {
    expect(isIncidentEffectivelyResolved({
      status: 'In Progress',
      responderStatus: 'On Scene',
    })).toBe(false);
  });
});

describe('isVolunteerResolved', () => {
  it('is case-insensitive', () => {
    expect(isVolunteerResolved('resolved')).toBe(true);
    expect(isVolunteerResolved('Resolved')).toBe(true);
  });
});
