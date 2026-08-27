import { API_URL, ONESIGNAL_APP_ID } from '@/core/config/app.config';
import { getAuthHeaders } from '@/data/api/http';

let isInitialized = false;

/**
 * Get current push notification state for the browser/user.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function getPushNotificationState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

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
        const reportId = data?.report_id || data?.reportId;
        if (reportId) {
          if (typeof onNotificationClick === 'function') {
            onNotificationClick(reportId);
          } else {
            const tab = data?.tab ? `?tab=${data.tab}` : '';
            window.location.href = `/incidents/${reportId}${tab}`;
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

      // If subscription ID already exists, sync it
      const currentSubId = OneSignal.User.PushSubscription?.id;
      if (currentSubId) {
        await syncOneSignalSubscriptionToBackend(currentSubId);
      }
    } catch (err) {
      console.warn('[OneSignal Web] Initialization error:', err?.message);
    }
  });
}

/**
 * Set OneSignal external user ID, synchronize user tags, and subscribe to push
 * notifications on login or session restore.
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

      // 3. Auto opt-in if permission is already granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          await OneSignal.User.PushSubscription.optIn();
        } catch (_) {}
      }

      // 4. Sync current subscription ID if available
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
 * Manually request push notification permission via user gesture (button click).
 * Prompts the browser, opts in to OneSignal push subscription, and syncs subscription ID to backend.
 * Resolves to true when granted, false otherwise.
 */
export async function requestPushPermission() {
  if (typeof window === 'undefined') return false;

  let isGranted = false;

  // 1. Request permission directly in current user-activation stack
  try {
    if ('Notification' in window && typeof Notification.requestPermission === 'function') {
      const res = await Notification.requestPermission();
      isGranted = res === 'granted';
    }
  } catch (err) {
    console.warn('[Push] Native requestPermission error:', err);
  }

  // 2. If granted or OneSignal available, handle opt-in & sync
  if (ONESIGNAL_APP_ID && window.OneSignalDeferred) {
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        if (isGranted) {
          if (OneSignal.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
          }
          const subId = OneSignal.User?.PushSubscription?.id;
          if (subId) {
            await syncOneSignalSubscriptionToBackend(subId);
          }
        }
      } catch (err) {
        console.warn('[OneSignal Web] optIn error:', err?.message);
      }
    });
  }

  return isGranted;
}

/**
 * Sync the OneSignal push subscription ID to the RescueLink backend.
 * Associates the browser's push subscription with the authenticated user.
 */
export async function syncOneSignalSubscriptionToBackend(subscriptionId) {
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
