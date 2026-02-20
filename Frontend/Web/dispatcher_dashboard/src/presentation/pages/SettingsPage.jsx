import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Switch } from '@/presentation/components/ui/Switch';
import { Label } from '@/presentation/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Settings as SettingsIcon, Users, Bell, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

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
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';

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

  const [selectStates, setSelectStates] = useState({
    fireThreshold: false,
    medicalThreshold: false,
  });

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-8">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Access Denied</h3>
                <p className="text-sm text-red-700 mt-1">Only administrators can access system settings.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure RescueLink system preferences</p>
        </div>

        <div className="space-y-6">
          {/* User Management */}
          <Card hover={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E0F2FE]">
                  <Users className="w-5 h-5 text-[#134178]" />
                </span>
                User Role Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Operator Incident Creation</Label>
                  <p className="text-sm text-gray-500">Operators can manually create incidents</p>
                </div>
                <Switch
                  checked={settings.allowOperatorIncidentCreation}
                  onCheckedChange={(v) => updateSetting('allowOperatorIncidentCreation', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Supervisor Override</Label>
                  <p className="text-sm text-gray-500">Supervisors can override AI suggestions</p>
                </div>
                <Switch
                  checked={settings.supervisorOverride}
                  onCheckedChange={(v) => updateSetting('supervisorOverride', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Severity Thresholds */}
          <Card hover={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E0F2FE]">
                  <AlertCircle className="w-5 h-5 text-[#134178]" />
                </span>
                Severity Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Fire - Critical Threshold</Label>
                <Select value={settings.fireCriticalThreshold} onValueChange={(v) => updateSetting('fireCriticalThreshold', v)}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.fireThreshold}
                        onClick={() => setSelectStates((s) => ({ ...s, fireThreshold: !s.fireThreshold }))}
                        className="mt-1.5"
                      >
                        <SelectValue value={value} options={fireThresholdOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.fireThreshold}>
                        {fireThresholdOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(v) => {
                              updateSetting('fireCriticalThreshold', v);
                              setSelectStates((s) => ({ ...s, fireThreshold: false }));
                            }}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div>
                <Label>Medical - Warning Threshold</Label>
                <Select value={settings.medicalWarningThreshold} onValueChange={(v) => updateSetting('medicalWarningThreshold', v)}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.medicalThreshold}
                        onClick={() => setSelectStates((s) => ({ ...s, medicalThreshold: !s.medicalThreshold }))}
                        className="mt-1.5"
                      >
                        <SelectValue value={value} options={medicalThresholdOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.medicalThreshold}>
                        {medicalThresholdOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(v) => {
                              updateSetting('medicalWarningThreshold', v);
                              setSelectStates((s) => ({ ...s, medicalThreshold: false }));
                            }}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card hover={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E0F2FE]">
                  <Bell className="w-5 h-5 text-[#134178]" />
                </span>
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-gray-500">Send SMS to responders</p>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(v) => updateSetting('smsNotifications', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-gray-500">Send email for critical incidents</p>
                </div>
                <Switch
                  checked={settings.emailAlerts}
                  onCheckedChange={(v) => updateSetting('emailAlerts', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-500">Mobile app push notifications</p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(v) => updateSetting('pushNotifications', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card hover={false}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E0F2FE]">
                  <SettingsIcon className="w-5 h-5 text-[#134178]" />
                </span>
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>AI Confidence Threshold (Read-Only)</Label>
                <div className="mt-1.5 px-3 py-2 bg-secondary/20 text-foreground rounded-lg border border-border">
                  75% - Optimized for Dagupan City
                </div>
                <p className="text-xs text-gray-500 mt-2">This threshold is optimized based on historical data and cannot be modified.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
