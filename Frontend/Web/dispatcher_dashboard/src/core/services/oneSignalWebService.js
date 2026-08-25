import { API_URL, ONESIGNAL_APP_ID } from '@/core/config/app.config';
import { getAuthHeaders, parseJsonOrEmpty } from '@/data/api/http';

let isInitialized = false;

/**
 * Initialize OneSignal Web SDK
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
        notifyButton: {
          enable: false,
        },
      });

      isInitialized = true;

      // Handle notification clicks
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = event?.notification?.additionalData;
        if (data?.report_id && typeof onNotificationClick === 'function') {
          onNotificationClick(data.report_id);
        } else if (data?.report_id) {
          window.location.href = `/incidents/${data.report_id}`;
        }
      });

      // Listen for subscription changes
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
 * Set OneSignal external user ID for targeted push notifications
 * @param {string|number} userId
 */
export async function setOneSignalUser(userId) {
  if (!userId || typeof window === 'undefined') return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.login(String(userId));
      const subscriptionId = OneSignal.User.PushSubscription.id;
      if (subscriptionId) {
        await syncOneSignalSubscriptionToBackend(subscriptionId);
      }
    } catch (err) {
      console.warn('[OneSignal Web] Login error:', err?.message);
    }
  });
}

/**
 * Log out from OneSignal
 */
export async function logoutOneSignal() {
  if (typeof window === 'undefined') return;

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
 * Request notification permissions
 */
export async function requestPushPermission() {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        const permission = await OneSignal.Notifications.requestPermission();
        resolve(permission);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Send subscription ID to RescueLink backend
 */
async function syncOneSignalSubscriptionToBackend(subscriptionId) {
  try {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    await fetch(`${API_URL}/api/auth/onesignal-subscription`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ onesignal_player_id: subscriptionId }),
    });
  } catch (err) {
    console.warn('[OneSignal Web] Failed to sync subscription to backend:', err?.message);
  }
}
