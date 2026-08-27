import { API_URL, ONESIGNAL_APP_ID } from '@/core/config/app.config';
import { getAuthHeaders } from '@/data/api/http';

let isInitialized = false;
const DEVICE_PROMPT_KEY = 'rescuelink_push_prompted';

/**
 * Initialize OneSignal Web SDK.
 * Safe to call in SSR/Node or when OneSignal is not configured — silently skips.
 * @param {Function} [onNotificationClick] Optional callback when user clicks a notification
 */
export async function initOneSignal(onNotificationClick) {
  if (isInitialized || !ONESIGNAL_APP_ID) return;
  if (typeof window === 'undefined') return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
      });

      isInitialized = true;

      // Handle notification clicks — deep-link to incident detail
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = event?.notification?.additionalData;
        if (data?.report_id) {
          if (typeof onNotificationClick === 'function') {
            onNotificationClick(data.report_id);
          } else {
            const tab = data?.tab ? `?tab=${data.tab}` : '';
            window.location.href = `/incidents/${data.report_id}${tab}`;
          }
        }
      });

      // Sync subscription ID to backend whenever it changes or is established
      OneSignal.User.PushSubscription.addEventListener('change', async (changeEvent) => {
        const subscriptionId = changeEvent?.current?.id;
        if (subscriptionId) {
          await syncOneSignalSubscriptionToBackend(subscriptionId);
        }
      });
    } catch (err) {
      console.warn('[OneSignal Web] Initialization error:', err?.message);
    }
  });
}

/**
 * Set OneSignal external user ID, synchronize user tags, and subscribe to push
 * notifications on login (prompting once per device if permission not yet granted).
 *
 * @param {string|number} userId - Internal app user_id
 * @param {{ role?: string, departmentId?: number|string, departmentCode?: string }} [metadata]
 */
export async function setOneSignalUser(userId, metadata = {}) {
  if (!userId || typeof window === 'undefined' || !ONESIGNAL_APP_ID) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      // 1. Bind External User ID
      await OneSignal.login(String(userId));

      // 2. Apply user tags for targeted segment broadcasts
      const tags = {};
      if (metadata.role) {
        tags.role = String(metadata.role).toLowerCase();
      }
      if (metadata.departmentId != null) {
        tags.department_id = String(metadata.departmentId);
      }
      if (metadata.departmentCode) {
        tags.department_code = String(metadata.departmentCode).toLowerCase();
      }
      if (Object.keys(tags).length > 0) {
        await OneSignal.User.addTags(tags);
      }

      // 3. Auto-subscribe on login
      try {
        if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (optInErr) {
        console.warn('[OneSignal Web] optIn attempt note:', optInErr?.message);
        try {
          await OneSignal.Notifications.requestPermission();
        } catch (_) {}
      }

      // 4. Sync current subscription ID to backend
      const subscriptionId = OneSignal.User.PushSubscription?.id;
      if (subscriptionId) {
        await syncOneSignalSubscriptionToBackend(subscriptionId);
      }
    } catch (err) {
      console.warn('[OneSignal Web] Login/tag error:', err?.message);
    }
  });
}

/**
 * Log out from OneSignal — clears External User ID and user tags.
 * Call during the auth logout flow before clearing sessionStorage.
 */
export async function logoutOneSignal() {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.logout();
    } catch (err) {
      console.warn('[OneSignal Web] Logout error:', err?.message);
    }
  });
}

/**
 * Manually request push notification permission.
 * Resolves to true when granted, false otherwise.
 */
export async function requestPushPermission() {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return false;

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.User.PushSubscription.optIn();
        const permission = typeof Notification !== 'undefined' ? Notification.permission === 'granted' : true;
        resolve(permission);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Sync the OneSignal push subscription ID to the RescueLink backend.
 * Associates the browser's push subscription with the authenticated user.
 */
async function syncOneSignalSubscriptionToBackend(subscriptionId) {
  try {
    const token = sessionStorage.getItem('token');
    if (!token || !subscriptionId) return;

    await fetch(`${API_URL}/api/auth/onesignal-subscription`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ onesignal_player_id: subscriptionId }),
    });
  } catch (err) {
    console.warn('[OneSignal Web] Failed to sync subscription to backend:', err?.message);
  }
}
