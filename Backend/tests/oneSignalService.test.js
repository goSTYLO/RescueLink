const {
  formatPushTitle,
  formatPushBody,
  getIncidentTypeLabel,
  sendPushToUsers,
} = require('../src/services/oneSignalService');

describe('oneSignalService', () => {
  describe('formatPushTitle', () => {
    test('formats known incident event titles correctly', () => {
      expect(formatPushTitle('incident:created')).toBe('🚨 New Incident Reported');
      expect(formatPushTitle('incident:verified')).toBe('🔍 Incident Verified');
      expect(formatPushTitle('incident:dispatched')).toBe('📋 Incident Assigned');
      expect(formatPushTitle('incident:status_updated')).toBe('🔄 Incident Status Updated');
      expect(formatPushTitle('incident:resolution_confirmed')).toBe('✅ Incident Resolved');
      expect(formatPushTitle('incident:reclassified')).toBe('🔄 Incident Reclassified');
      expect(formatPushTitle('incident:note_added')).toBe('📝 New Note Added');
      expect(formatPushTitle('incident:archived')).toBe('📦 Incident Archived');
      expect(formatPushTitle('incident:unarchived')).toBe('📦 Incident Restored');
      expect(formatPushTitle('backup_request')).toBe('🆘 Backup Requested');
    });

    test('formats escalation event titles correctly', () => {
      expect(formatPushTitle('incident:escalated')).toBe('🤝 Assistance Requested');
      expect(formatPushTitle('incident:escalation_accepted')).toBe('✅ Assistance Accepted');
      expect(formatPushTitle('incident:escalation_declined')).toBe('❌ Assistance Declined');
      expect(formatPushTitle('incident:escalation_resolved')).toBe('🏁 Assistance Resolved');
      expect(formatPushTitle('incident:escalation_cancelled')).toBe('🚫 Assistance Cancelled');
    });

    test('returns default fallback title for unknown events', () => {
      expect(formatPushTitle('unknown:event')).toBe('🔔 RescueLink Update');
    });
  });

  describe('getIncidentTypeLabel', () => {
    test('formats single incident type', () => {
      expect(getIncidentTypeLabel({ incident_type: 'fire' })).toBe('Fire');
    });

    test('formats multiple incident types array', () => {
      expect(getIncidentTypeLabel({ incident_types: ['fire', 'medical', 'flood'] })).toBe('Fire, Medical, Flood');
    });

    test('handles missing or empty types safely', () => {
      expect(getIncidentTypeLabel({})).toBe('Incident');
      expect(getIncidentTypeLabel(null)).toBe('Incident');
    });
  });

  describe('formatPushBody', () => {
    test('formats incident:created with multi-type, severity, and barangay', () => {
      const body = formatPushBody('incident:created', {
        report_id: 101,
        incident_types: ['fire', 'medical'],
        severity_level: 'critical',
        barangay: 'Pantal',
      });
      expect(body).toBe('New Fire, Medical (critical) reported in Pantal');
    });

    test('formats incident:verified', () => {
      const body = formatPushBody('incident:verified', {
        report_id: 202,
        incident_type: 'flood',
        barangay: 'Tapuac',
      });
      expect(body).toBe('Incident #202 (Flood) has been verified in Tapuac');
    });

    test('formats incident:dispatched', () => {
      const body = formatPushBody('incident:dispatched', {
        report_id: 303,
        incident_types: ['vehicular accident'],
        severity_level: 'high',
        barangay: 'Lucao',
      });
      expect(body).toBe('Incident #303 (Vehicular accident (high)) assigned to department in Lucao');
    });

    test('formats incident:status_updated', () => {
      const body = formatPushBody('incident:status_updated', {
        report_id: 404,
        status: 'in_progress',
        barangay: 'Bonuan Gueset',
      });
      expect(body).toBe('Incident #404 is now in_progress (Bonuan Gueset)');
    });

    test('formats incident:escalated', () => {
      const body = formatPushBody('incident:escalated', {
        report_id: 505,
        urgency: 'high',
        to_department_name: 'BFP Dagupan',
        barangay: 'Poblacion Oeste',
      });
      expect(body).toBe('Incident #505 [HIGH]: Assistance requested from BFP Dagupan in Poblacion Oeste');
    });

    test('formats incident:escalation_accepted and declined', () => {
      expect(
        formatPushBody('incident:escalation_accepted', {
          report_id: 606,
          to_department_name: 'PNP Dagupan',
        })
      ).toBe('Incident #606: PNP Dagupan has accepted the assistance request');

      expect(
        formatPushBody('incident:escalation_declined', {
          report_id: 606,
          to_department_name: 'PNP Dagupan',
        })
      ).toBe('Incident #606: PNP Dagupan declined the assistance request');
    });

    test('formats backup_request and volunteer joined', () => {
      expect(
        formatPushBody('backup_request', {
          report_id: 707,
          barangay: 'Herrero-Perez',
        })
      ).toBe('Backup requested for Incident #707 in Herrero-Perez');

      expect(
        formatPushBody('responder:backup_joined', {
          report_id: 707,
          volunteer_name: 'Juan Dela Cruz',
        })
      ).toBe('Juan Dela Cruz joined as backup for Incident #707');
    });
  });

  describe('sendPushToUsers safety', () => {
    test('skips cleanly in test environment without throwing', async () => {
      await expect(
        sendPushToUsers([1, 2, 3], {
          title: 'Test Notification',
          body: 'Test content',
          url: 'http://localhost:5173/incidents/1',
        })
      ).resolves.not.toThrow();
    });

    test('skips cleanly when recipient list is empty', async () => {
      await expect(
        sendPushToUsers([], {
          title: 'Test Notification',
          body: 'Test content',
        })
      ).resolves.not.toThrow();
    });
  });
});
