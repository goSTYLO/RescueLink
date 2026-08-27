import { Layout } from '@/presentation/components/layout/Layout';
import { Switch } from '@/presentation/components/ui/Switch';
import { Label } from '@/presentation/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Users, Bell, AlertCircle, Sliders, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
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

  const [selectStates, setSelectStates] = useState({
    fireThreshold: false,
    medicalThreshold: false,
  });

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

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = () =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const rowClass = () =>
    `flex items-center justify-between p-4 rounded-xl border ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;

  if (!isAdmin) {
    return <AccessDeniedNotice message="Only administrators can access system settings." redirectPath="/dashboard" />;
  }

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Settings' }]} />
        <div className={`${heroCardClass} mb-8`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Sliders className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
              <p className="text-muted mt-1">Configure RescueLink system preferences</p>
            </div>
          </div>
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

          {/* Severity Thresholds - hidden for now */}
          {false && (
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
          )}

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
                  <Label className="text-foreground">Browser Push Notifications</Label>
                  <p className="text-sm text-muted mt-0.5">
                    {browserPermission === 'granted'
                      ? 'Active — real-time desktop alerts enabled'
                      : browserPermission === 'denied'
                        ? 'Blocked — please enable notifications in browser permissions'
                        : 'Not enabled — click to allow notifications'}
                  </p>
                </div>
                {browserPermission === 'granted' ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBrowserPush}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Enable
                  </button>
                )}
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
