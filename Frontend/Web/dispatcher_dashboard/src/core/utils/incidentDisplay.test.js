import {
  isIncidentEffectivelyResolved,
  isVolunteerResolved,
  hasOpenBackupUi,
  getBackupDialogCapabilities,
} from '@/core/utils/incidentDisplay';
import { ROLES } from '@/core/constants';

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

describe('hasOpenBackupUi', () => {
  it('stays visible for acknowledged backup', () => {
    expect(hasOpenBackupUi({
      hasOpenBackupRequest: true,
      openBackupStatus: 'acknowledged',
    })).toBe(true);
  });

  it('falls back to latest_backup_status when open flag missing', () => {
    expect(hasOpenBackupUi({
      hasOpenBackupRequest: false,
      latestBackupStatus: 'acknowledged',
    })).toBe(true);
  });

  it('stays visible when primary team exists but backup is still open', () => {
    expect(hasOpenBackupUi({
      openBackupStatus: 'acknowledged',
      assignedTeamName: 'Alpha Team',
    })).toBe(true);
  });
});

describe('getBackupDialogCapabilities', () => {
  const openIncident = {
    hasOpenBackupRequest: true,
    openBackupStatus: 'pending',
    assignedTeamName: null,
  };

  it('allows dispatcher to acknowledge pending backup', () => {
    const caps = getBackupDialogCapabilities(openIncident, ROLES.DISPATCHER);
    expect(caps.canAcknowledge).toBe(true);
    expect(caps.canNotifyDepartment).toBe(true);
    expect(caps.canAssignTeam).toBe(false);
  });

  it('allows department admin to assign team but not acknowledge', () => {
    const caps = getBackupDialogCapabilities({
      ...openIncident,
      openBackupStatus: 'acknowledged',
    }, ROLES.DEPARTMENT_ADMIN);
    expect(caps.canAcknowledge).toBe(false);
    expect(caps.canAssignTeam).toBe(true);
  });
});
