import { Layout } from '@/presentation/components/layout/Layout';
import { Switch } from '@/presentation/components/ui/Switch';
import { Label } from '@/presentation/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Users, Bell, AlertCircle, Sliders, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

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

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = () =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const rowClass = () =>
    `flex items-center justify-between p-4 rounded-xl border ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-8">
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80 border-primary/40' : 'glass neumorphic-dark bg-card/60 border-primary/40'}`}>
            <div className="p-6 flex items-start gap-4">
              <span className={iconBoxClass()}>
                <AlertCircle className="w-5 h-5" strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-semibold text-primary">Access Denied</h3>
                <p className="text-sm text-muted mt-1">Only administrators can access system settings.</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">System Settings</h1>
          <p className="text-muted mt-1">Configure RescueLink system preferences</p>
        </div>

        <div className="space-y-6">
          {/* User Role Management */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass()}>
                <Users className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">User Role Management</span>
            </div>
            <div className="p-4 space-y-3">
              <div className={rowClass()}>
                <div>
                  <Label className="text-foreground">Allow Operator Incident Creation</Label>
                  <p className="text-sm text-muted mt-0.5">Operators can manually create incidents</p>
                </div>
                <Switch
                  checked={settings.allowOperatorIncidentCreation}
                  onCheckedChange={(v) => updateSetting('allowOperatorIncidentCreation', v)}
                />
              </div>
              <div className={rowClass()}>
                <div>
                  <Label className="text-foreground">Supervisor Override</Label>
                  <p className="text-sm text-muted mt-0.5">Supervisors can override AI suggestions</p>
                </div>
                <Switch
                  checked={settings.supervisorOverride}
                  onCheckedChange={(v) => updateSetting('supervisorOverride', v)}
                />
              </div>
            </div>
          </div>

          {/* Severity Thresholds */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass()}>
                <Sliders className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">Severity Thresholds</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="overflow-visible">
                <Label className="block mb-2">Fire - Critical Threshold</Label>
                <Select
                  value={settings.fireCriticalThreshold}
                  onValueChange={(v) => updateSetting('fireCriticalThreshold', v)}
                  open={selectStates.fireThreshold}
                  onOpenChange={(open) => setSelectStates((s) => ({ ...s, fireThreshold: open }))}
                >
                  {({ value, dropdownRect }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.fireThreshold}
                        onClick={() => setSelectStates((s) => ({ ...s, fireThreshold: !s.fireThreshold }))}
                        className={`w-full rounded-xl py-2.5 border-2 mt-0 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                      >
                        <SelectValue value={value} options={fireThresholdOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.fireThreshold} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
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
              <div className="overflow-visible">
                <Label className="block mb-2">Medical - Warning Threshold</Label>
                <Select
                  value={settings.medicalWarningThreshold}
                  onValueChange={(v) => updateSetting('medicalWarningThreshold', v)}
                  open={selectStates.medicalThreshold}
                  onOpenChange={(open) => setSelectStates((s) => ({ ...s, medicalThreshold: open }))}
                >
                  {({ value, dropdownRect }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.medicalThreshold}
                        onClick={() => setSelectStates((s) => ({ ...s, medicalThreshold: !s.medicalThreshold }))}
                        className={`w-full rounded-xl py-2.5 border-2 mt-0 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                      >
                        <SelectValue value={value} options={medicalThresholdOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.medicalThreshold} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
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
            </div>
          </div>

          {/* Notification Settings */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass()}>
                <Bell className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">Notification Settings</span>
            </div>
            <div className="p-4 space-y-3">
              <div className={rowClass()}>
                <div>
                  <Label className="text-foreground">SMS Notifications</Label>
                  <p className="text-sm text-muted mt-0.5">Send SMS to responders</p>
                </div>
                <Switch checked={settings.smsNotifications} onCheckedChange={(v) => updateSetting('smsNotifications', v)} />
              </div>
              <div className={rowClass()}>
                <div>
                  <Label className="text-foreground">Email Alerts</Label>
                  <p className="text-sm text-muted mt-0.5">Send email for critical incidents</p>
                </div>
                <Switch checked={settings.emailAlerts} onCheckedChange={(v) => updateSetting('emailAlerts', v)} />
              </div>
              <div className={rowClass()}>
                <div>
                  <Label className="text-foreground">Push Notifications</Label>
                  <p className="text-sm text-muted mt-0.5">Mobile app push notifications</p>
                </div>
                <Switch checked={settings.pushNotifications} onCheckedChange={(v) => updateSetting('pushNotifications', v)} />
              </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass()}>
                <Sparkles className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">AI Configuration</span>
            </div>
            <div className="p-4">
              <Label className="block mb-2">AI Confidence Threshold (Read-Only)</Label>
              <div className={`px-4 py-3 rounded-xl border ${isLight ? 'bg-gray-50/80 border-gray-200 text-foreground' : 'bg-white/5 border-white/10 text-foreground'}`}>
                75% - Optimized for Dagupan City
              </div>
              <p className="text-xs text-muted mt-2">This threshold is optimized based on historical data and cannot be modified.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
