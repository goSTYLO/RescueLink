import { Layout } from '@/presentation/components/layout/Layout';
import { Button, Card, Select, Switch } from 'antd';
import { Users, Bell, Sliders, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { ROLES, normalizeRole } from '@/core/constants';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { requestPushPermission, getPushNotificationState } from '@/core/services/oneSignalWebService';

const SETTINGS_KEY = 'rescuelink_settings';

const defaultSettings = {
  allowOperatorIncidentCreation: false,
  supervisorOverride: true,
  smsNotifications: true,
  emailAlerts: true,
  pushNotifications: true,
  fireCriticalThreshold: '90',
  medicalWarningThreshold: '70',
};

const fireThresholdOptions = [
  { value: '90', label: 'High Confidence (90%+)' },
  { value: '70', label: 'Medium Confidence (70%+)' },
];

const medicalThresholdOptions = [
  { value: '70', label: 'Medium Confidence (70%+)' },
  { value: '50', label: 'Low Confidence (50%+)' },
];

export function SettingsPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(user.role) === ROLES.SUPER_ADMIN;

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const [browserPermission, setBrowserPermission] = useState('default');

  useEffect(() => {
    getPushNotificationState().then(setBrowserPermission);
  }, []);

  const handleRequestBrowserPush = async () => {
    const granted = await requestPushPermission();
    const state = await getPushNotificationState();
    setBrowserPermission(state);
    updateSetting('pushNotifications', granted);
  };

  if (!isAdmin) {
    return <AccessDeniedNotice message="Only administrators can access system settings." redirectPath="/dashboard" />;
  }

  const settingRow = (label, description, control) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '8px 0' }}>
      <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 12, opacity: 0.7 }}>{description}</div>}
      </div>
      {control}
    </div>
  );

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Settings' }]} />
        <Card
          size="small"
          style={{ marginTop: 12, marginBottom: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={18} />
              System Settings
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>Configure RescueLink system preferences</p>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} />
                User Role Management
              </span>
            )}
          >
            {settingRow(
              'Allow Operator Incident Creation',
              'Operators can manually create incidents',
              <Switch
                checked={settings.allowOperatorIncidentCreation}
                onChange={(v) => updateSetting('allowOperatorIncidentCreation', v)}
              />
            )}
            {settingRow(
              'Supervisor Override',
              'Supervisors can override AI suggestions',
              <Switch
                checked={settings.supervisorOverride}
                onChange={(v) => updateSetting('supervisorOverride', v)}
              />
            )}
          </Card>

          {false && (
            <Card size="small" title="Severity Thresholds">
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>Fire - Critical Threshold</div>
                <Select
                  style={{ width: '100%' }}
                  value={settings.fireCriticalThreshold}
                  onChange={(v) => updateSetting('fireCriticalThreshold', v)}
                  options={fireThresholdOptions}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>Medical - Warning Threshold</div>
                <Select
                  style={{ width: '100%' }}
                  value={settings.medicalWarningThreshold}
                  onChange={(v) => updateSetting('medicalWarningThreshold', v)}
                  options={medicalThresholdOptions}
                />
              </div>
            </Card>
          )}

          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} />
                Notification Settings
              </span>
            )}
          >
            {settingRow(
              'SMS Notifications',
              'Send SMS to responders',
              <Switch checked={settings.smsNotifications} onChange={(v) => updateSetting('smsNotifications', v)} />
            )}
            {settingRow(
              'Email Alerts',
              'Send email for critical incidents',
              <Switch checked={settings.emailAlerts} onChange={(v) => updateSetting('emailAlerts', v)} />
            )}
            {settingRow(
              'Browser Push Notifications',
              browserPermission === 'granted'
                ? 'Active — real-time desktop alerts enabled'
                : browserPermission === 'denied'
                  ? 'Blocked — please enable notifications in browser permissions'
                  : 'Not enabled — click to allow notifications',
              browserPermission === 'granted' ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>Active</span>
              ) : (
                <Button type="primary" onClick={handleRequestBrowserPush}>Enable</Button>
              )
            )}
          </Card>

          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} />
                AI Configuration
              </span>
            )}
          >
            <div style={{ fontWeight: 500, marginBottom: 4 }}>AI Confidence Threshold (Read-Only)</div>
            <div style={{ padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6 }}>
              75% - Optimized for Dagupan City
            </div>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8, marginBottom: 0 }}>
              This threshold is optimized based on historical data and cannot be modified.
            </p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
