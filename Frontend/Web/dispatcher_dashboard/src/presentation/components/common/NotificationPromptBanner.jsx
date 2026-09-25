import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { requestPushPermission, getPushNotificationState } from '@/core/services/oneSignalWebService';
import { useTheme } from '@/presentation/context/ThemeContext';

export const PROMPT_DISMISSED_KEY = 'rescuelink_push_prompt_dismissed';

export function NotificationPromptBanner({ onStatusChange }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    async function checkPermission() {
      // If user has already dismissed or interacted with prompt, do not show on refresh
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(PROMPT_DISMISSED_KEY) === 'true') {
        setVisible(false);
        return;
      }

      const state = await getPushNotificationState();
      // Show prompt ONLY if permission is specifically 'default' (not granted, not denied, not unsupported)
      if (state === 'default') {
        setVisible(true);
      } else {
        // If already granted or denied, remember so we never check again
        localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
        setVisible(false);
      }
    }

    checkPermission();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const granted = await requestPushPermission();
      // Mark as dismissed in localStorage so it never pops up again on refresh
      localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');

      if (granted) {
        setStatusMessage({ type: 'success', text: 'Push notifications enabled!' });
        if (typeof onStatusChange === 'function') onStatusChange('granted');
        setTimeout(() => {
          setVisible(false);
        }, 1200);
      } else {
        const state = await getPushNotificationState();
        if (state === 'denied') {
          setStatusMessage({
            type: 'error',
            text: 'Notifications blocked by browser. Please enable them in your browser site settings.',
          });
          if (typeof onStatusChange === 'function') onStatusChange('denied');
          setTimeout(() => {
            setVisible(false);
          }, 3000);
        } else {
          setVisible(false);
        }
      }
    } catch (err) {
      console.warn('Failed to enable push notifications:', err);
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Push Notifications Prompt"
      className={`border-b px-4 py-3 sm:px-6 transition-all duration-300 ${
        isLight
          ? 'bg-blue-50/95 border-blue-200 text-blue-950'
          : 'bg-blue-950/60 border-blue-800/80 text-blue-100 backdrop-blur-sm'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isLight ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-500 text-white shadow-md'
            }`}
          >
            <Bell className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              Enable Real-time Push Notifications
              {statusMessage?.type === 'success' && (
                <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {statusMessage.text}
                </span>
              )}
              {statusMessage?.type === 'error' && (
                <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400 gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {statusMessage.text}
                </span>
              )}
            </div>
            {!statusMessage && (
              <p className={`text-xs mt-0.5 ${isLight ? 'text-blue-800/80' : 'text-blue-200/80'}`}>
                Stay informed with instant desktop alerts for critical emergencies, new incidents, and team escalations.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading || statusMessage?.type === 'success'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
              isLight
                ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 disabled:opacity-50'
                : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95 disabled:opacity-50'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            {loading ? 'Enabling...' : statusMessage?.type === 'success' ? 'Enabled' : 'Enable Notifications'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? 'hover:bg-blue-200/70 text-blue-700'
                : 'hover:bg-blue-900/60 text-blue-300'
            }`}
            title="Dismiss for now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationPromptBanner;
