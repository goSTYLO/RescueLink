import { API_URL, ONESIGNAL_APP_ID } from '@/core/config/app.config';
import { getAuthHeaders, getAuthToken } from '@/data/api/http';

let isInitialized = false;
let listenersReady = false;
let pumpRegistered = false;
let pumpRunning = false;
let clickHandler = null;
let lastLoginUserId = null;
let lastSyncedSubscriptionId = null;
let subscriptionSyncInflight = null;
const taskQueue = [];

function isAlreadyInitializedError(err) {
  return /already initialized/i.test(String(err?.message || err || ''));
}

function attachOneSignalListeners(OneSignal) {
  if (listenersReady) return;
  OneSignal.Notifications.addEventListener('click', (event) => {
    const data = event?.notification?.additionalData;
    const reportId = data?.report_id || data?.reportId;
    if (reportId) {
      if (typeof clickHandler === 'function') {
        clickHandler(reportId);
      } else {
        const tab = data?.tab ? `?tab=${data.tab}` : '';
        window.location.href = `/incidents/${reportId}${tab}`;
      }
    }
  });

  OneSignal.User.PushSubscription.addEventListener('change', async (changeEvent) => {
    const subscriptionId = changeEvent?.current?.id;
    if (subscriptionId) {
      await syncOneSignalSubscriptionToBackend(subscriptionId);
    }
  });
  listenersReady = true;
}

async function ensureInitialized(OneSignal) {
  if (isInitialized) return;
  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false },
      serviceWorkerParam: { scope: '/' },
      serviceWorkerPath: '/OneSignalSDKWorker.js',
    });
  } catch (err) {
    if (!isAlreadyInitializedError(err)) throw err;
  }
  isInitialized = true;
  attachOneSignalListeners(OneSignal);
  // ponytail: fixed delay — OneSignal v16 identity (LoginManager) is not ready in the same tick as init().
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function drainTaskQueue(OneSignal) {
  if (pumpRunning) return;
  pumpRunning = true;
  try {
    await ensureInitialized(OneSignal);
    while (taskQueue.length) {
      const task = taskQueue.shift();
      await task(OneSignal);
    }
  } finally {
    pumpRunning = false;
    if (taskQueue.length) {
      void drainTaskQueue(OneSignal);
    }
  }
}

function kickOneSignalPump() {
  if (!ONESIGNAL_APP_ID || typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  if (!pumpRegistered) {
    pumpRegistered = true;
    window.OneSignalDeferred.push(async (OneSignal) => {
      await drainTaskQueue(OneSignal);
    });
    return;
  }
  const sdk = window.OneSignal;
  if (isInitialized && sdk) {
    void drainTaskQueue(sdk);
  }
}

function scheduleOneSignalTask(task) {
  taskQueue.push(task);
  kickOneSignalPump();
}

async function loginWithRetry(OneSignal, externalId) {
  if (typeof OneSignal.login !== 'function') return;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await OneSignal.login(externalId);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt >= 3) break;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function getPushNotificationState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function initOneSignal(onNotificationClick) {
  if (onNotificationClick) clickHandler = onNotificationClick;
  if (!ONESIGNAL_APP_ID || typeof window === 'undefined') return;

  scheduleOneSignalTask(async (OneSignal) => {
    const currentSubId = OneSignal.User?.PushSubscription?.id;
    if (currentSubId) {
      await syncOneSignalSubscriptionToBackend(currentSubId);
    }
  });
}

export function setOneSignalUser(userId, metadata = {}) {
  if (!userId || typeof window === 'undefined' || !ONESIGNAL_APP_ID) return;
  const externalId = String(userId);
  if (lastLoginUserId === externalId) return;
  lastLoginUserId = externalId;

  scheduleOneSignalTask(async (OneSignal) => {
    try {
      await loginWithRetry(OneSignal, externalId);

      const tags = {};
      if (metadata.role) tags.role = String(metadata.role).toLowerCase();
      if (metadata.departmentId != null) tags.department_id = String(metadata.departmentId);
      if (metadata.departmentCode) tags.department_code = String(metadata.departmentCode).toLowerCase();
      if (Object.keys(tags).length > 0) {
        await OneSignal.User.addTags(tags);
      }

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          await OneSignal.User.PushSubscription.optIn();
        } catch (_) {}
      }

      const subscriptionId = OneSignal.User?.PushSubscription?.id;
      if (subscriptionId) {
        await syncOneSignalSubscriptionToBackend(subscriptionId);
      }
    } catch (err) {
      lastLoginUserId = null;
      console.warn('[OneSignal Web] Login/tag error:', err?.message);
    }
  });
}

export function logoutOneSignal() {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return;

  lastLoginUserId = null;
  lastSyncedSubscriptionId = null;
  isInitialized = false;
  listenersReady = false;
  pumpRegistered = false;
  taskQueue.length = 0;

  scheduleOneSignalTask(async (OneSignal) => {
    await OneSignal.logout();
  });
}

export async function requestPushPermission() {
  if (typeof window === 'undefined') return false;

  let isGranted = false;

  try {
    if ('Notification' in window && typeof Notification.requestPermission === 'function') {
      const res = await Notification.requestPermission();
      isGranted = res === 'granted';
    }
  } catch (err) {
    console.warn('[Push] Native requestPermission error:', err);
  }

  if (ONESIGNAL_APP_ID && isGranted) {
    scheduleOneSignalTask(async (OneSignal) => {
      if (OneSignal.User?.PushSubscription?.optIn) {
        await OneSignal.User.PushSubscription.optIn();
      }
      const subId = OneSignal.User?.PushSubscription?.id;
      if (subId) {
        await syncOneSignalSubscriptionToBackend(subId);
      }
    });
  }

  return isGranted;
}

export async function syncOneSignalSubscriptionToBackend(subscriptionId) {
  try {
    const token = getAuthToken();
    if (!token || !subscriptionId) return;
    if (lastSyncedSubscriptionId === subscriptionId) return;
    if (subscriptionSyncInflight) return subscriptionSyncInflight;

    subscriptionSyncInflight = (async () => {
      const response = await fetch(`${API_URL}/api/auth/onesignal-subscription`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ onesignal_player_id: subscriptionId }),
      });
      if (response.ok) lastSyncedSubscriptionId = subscriptionId;
    })().finally(() => {
      subscriptionSyncInflight = null;
    });

    await subscriptionSyncInflight;
  } catch (err) {
    console.warn('[OneSignal Web] Failed to sync subscription to backend:', err?.message);
  }
}

/** @internal */
export function resetOneSignalWebServiceForTests() {
  isInitialized = false;
  listenersReady = false;
  pumpRegistered = false;
  pumpRunning = false;
  clickHandler = null;
  lastLoginUserId = null;
  lastSyncedSubscriptionId = null;
  subscriptionSyncInflight = null;
  taskQueue.length = 0;
}
