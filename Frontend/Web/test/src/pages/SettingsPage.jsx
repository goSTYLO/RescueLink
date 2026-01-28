import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Switch } from '../components/ui/Switch';
import { Label } from '../components/ui/Label';
import { Settings as SettingsIcon, Users, Bell, AlertCircle } from 'lucide-react';

export function SettingsPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';

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
          <h1 className="text-3xl font-semibold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure RescueLink system preferences</p>
        </div>

        <div className="space-y-6">
          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Role Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Operator Incident Creation</Label>
                  <p className="text-sm text-gray-500">Operators can manually create incidents</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Supervisor Override</Label>
                  <p className="text-sm text-gray-500">Supervisors can override AI suggestions</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Severity Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Severity Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Fire - Critical Threshold</Label>
                <select className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option>High Confidence (90%+)</option>
                  <option>Medium Confidence (70%+)</option>
                </select>
              </div>
              <div>
                <Label>Medical - Warning Threshold</Label>
                <select className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option>Medium Confidence (70%+)</option>
                  <option>Low Confidence (50%+)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-gray-500">Send SMS to responders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-gray-500">Send email for critical incidents</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-500">Mobile app push notifications</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>AI Confidence Threshold (Read-Only)</Label>
                <div className="mt-1.5 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200">
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
