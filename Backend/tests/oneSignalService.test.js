const {
  formatPushTitle,
  formatPushBody,
  formatCriticalPushTitle,
  getIncidentTypeLabel,
  sendPushToUsers,
  buildNotificationBody,
  interpretOneSignalResponse,
  normalizePushUserIds,
  EMERGENCY_ANDROID_CHANNEL_ID,
  EMERGENCY_SOUND,
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

  describe('formatCriticalPushTitle', () => {
    test('formats dept and team emergency titles', () => {
      expect(formatCriticalPushTitle('dept')).toBe('EMERGENCY — Department notified');
      expect(formatCriticalPushTitle('team')).toBe('EMERGENCY — Your team was assigned');
    });
  });

  describe('buildNotificationBody critical fields', () => {
    test('quiet payload uses high priority and default sound without emergency channel', () => {
      const body = buildNotificationBody('app-1', ['10', '11'], {
        title: 'Quiet',
        body: 'Normal',
        url: 'http://localhost:5173/incidents/10',
      });
      expect(body.priority).toBe(10);
      expect(body.android_visibility).toBe(1);
      expect(body.android_sound).toBe('default');
      expect(body.android_channel_id).toBeUndefined();
      expect(body.ios_interruption_level).toBeUndefined();
      expect(body.web_url).toBe('http://localhost:5173/incidents/10');
      expect(body.url).toBeUndefined();
      expect(body.include_aliases).toEqual({ external_id: ['10', '11'] });
      expect(body.target_channel).toBe('push');
      expect(body.include_external_user_ids).toBeUndefined();
      expect(body.channel_for_external_user_ids).toBeUndefined();
    });

    test('critical payload sets amber-style OneSignal fields', () => {
      const body = buildNotificationBody('app-1', ['42'], {
        title: 'EMERGENCY — Department notified',
        body: 'Incident #1 assigned to department',
        critical: true,
        data: { report_id: 1, critical: true },
      });
      expect(body.priority).toBe(10);
      expect(body.android_visibility).toBe(1);
      expect(body.android_channel_id).toBe(EMERGENCY_ANDROID_CHANNEL_ID);
      expect(body.android_sound).toBe(EMERGENCY_SOUND);
      expect(body.ios_sound).toBe(`${EMERGENCY_SOUND}.wav`);
      expect(body.ios_interruption_level).toBe('time_sensitive');
      expect(body.data.critical).toBe(true);
    });
  });

  describe('interpretOneSignalResponse', () => {
    test('treats 2xx with recipients > 0 as ok', () => {
      const result = interpretOneSignalResponse(200, JSON.stringify({ id: 'abc', recipients: 2 }));
      expect(result.ok).toBe(true);
      expect(result.recipients).toBe(2);
      expect(result.notificationId).toBe('abc');
    });

    test('treats recipients 0 as failure', () => {
      const result = interpretOneSignalResponse(200, JSON.stringify({ id: 'abc', recipients: 0 }));
      expect(result.ok).toBe(false);
      expect(result.recipients).toBe(0);
      expect(result.message).toMatch(/0 recipients/);
    });

    test('treats errors array as failure', () => {
      const result = interpretOneSignalResponse(
        200,
        JSON.stringify({ id: 'abc', recipients: 1, errors: ['InvalidPlayerIds'] })
      );
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/InvalidPlayerIds/);
    });

    test('invalid_aliases hint mentions External ID login', () => {
      const result = interpretOneSignalResponse(
        200,
        JSON.stringify({
          id: 'abc',
          errors: { invalid_aliases: { external_id: ['71', '71', '71'] } },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/invalid_aliases/);
      expect(result.message).toMatch(/OneSignal\.login/);
    });

    test('treats non-2xx as failure', () => {
      const result = interpretOneSignalResponse(400, '{"errors":["Bad Request"]}');
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/HTTP 400/);
    });
  });

  describe('normalizePushUserIds', () => {
    test('dedupes duplicate user ids to a single alias id', () => {
      expect(normalizePushUserIds([71, '71', 71])).toEqual([71]);
      expect(normalizePushUserIds([71, 71, 71]).map(String)).toEqual(['71']);
    });

    test('drops non-positive and non-finite ids', () => {
      expect(normalizePushUserIds([0, -1, NaN, null, 'x', 32])).toEqual([32]);
    });
  });

  describe('buildNotificationBody aliases', () => {
    test('duplicate ids passed through body only once when normalized first', () => {
      const ids = normalizePushUserIds([71, 71, 71]).map(String);
      const body = buildNotificationBody('app-1', ids, {
        title: 'Quiet',
        body: 'Normal',
      });
      expect(body.include_aliases.external_id).toEqual(['71']);
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
          critical: true,
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
