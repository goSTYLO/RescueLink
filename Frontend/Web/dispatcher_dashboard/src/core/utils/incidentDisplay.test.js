import {
  isIncidentEffectivelyResolved,
  isVolunteerResolved,
  isIncidentClosed,
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

describe('isIncidentClosed', () => {
  it('returns true for Closed status label', () => {
    expect(isIncidentClosed({ status: 'Closed' })).toBe(true);
  });

  it('returns true for lowercase closed status', () => {
    expect(isIncidentClosed({ status: 'closed' })).toBe(true);
  });

  it('returns true when closedAt is set even if status is missing', () => {
    expect(isIncidentClosed({ closedAt: '2026-01-20T00:20:00Z' })).toBe(true);
  });

  it('returns false for open incidents', () => {
    expect(isIncidentClosed({ status: 'In Progress' })).toBe(false);
    expect(isIncidentClosed(null)).toBe(false);
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

  it('returns false for closed incidents even with open backup request', () => {
    expect(hasOpenBackupUi({
      status: 'Closed',
      hasOpenBackupRequest: true,
      openBackupStatus: 'pending',
    })).toBe(false);
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

  it('returns no capabilities for closed incidents', () => {
    const caps = getBackupDialogCapabilities({
      ...openIncident,
      status: 'Closed',
    }, ROLES.DISPATCHER);
    expect(caps.canAcknowledge).toBe(false);
    expect(caps.canNotifyDepartment).toBe(false);
    expect(caps.canAssignTeam).toBe(false);
  });
});
