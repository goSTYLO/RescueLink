jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
  ONESIGNAL_APP_ID: 'test-app-id-123',
}));

import {
  initOneSignal,
  setOneSignalUser,
  logoutOneSignal,
  requestPushPermission,
  getPushNotificationState,
  syncOneSignalSubscriptionToBackend,
  resetOneSignalWebServiceForTests,
} from './oneSignalWebService';

describe('oneSignalWebService', () => {
  let originalOneSignalDeferred;
  let originalNotification;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetOneSignalWebServiceForTests();
    originalOneSignalDeferred = window.OneSignalDeferred;
    originalNotification = window.Notification;
    window.OneSignalDeferred = [];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    window.OneSignalDeferred = originalOneSignalDeferred;
    window.Notification = originalNotification;
    jest.clearAllMocks();
  });

  test('getPushNotificationState returns unsupported when Notification API is missing', async () => {
    delete window.Notification;
    const state = await getPushNotificationState();
    expect(state).toBe('unsupported');
  });

  test('getPushNotificationState returns permission when available', async () => {
    window.Notification = { permission: 'granted' };
    const state = await getPushNotificationState();
    expect(state).toBe('granted');
  });

  test('initOneSignal queues initialization in OneSignalDeferred', async () => {
    const clickCallback = jest.fn();
    await initOneSignal(clickCallback);

    expect(window.OneSignalDeferred.length).toBeGreaterThan(0);

    const mockOneSignal = {
      init: jest.fn().mockResolvedValue(undefined),
      Notifications: {
        addEventListener: jest.fn(),
      },
      User: {
        PushSubscription: {
          addEventListener: jest.fn(),
          id: 'mock-sub-123',
        },
      },
    };

    sessionStorage.setItem('token', 'fake-jwt-token');

    // Run queued function
    const queuedFn = window.OneSignalDeferred[0];
    await queuedFn(mockOneSignal);

    expect(mockOneSignal.init).toHaveBeenCalled();
    expect(mockOneSignal.Notifications.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(mockOneSignal.User.PushSubscription.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  test('setOneSignalUser binds external ID and applies user tags', async () => {
    sessionStorage.setItem('token', 'fake-jwt-token');
    await setOneSignalUser(42, {
      role: 'Dispatcher',
      departmentId: 5,
      departmentCode: 'BFP',
    });

    const mockOneSignal = {
      login: jest.fn().mockResolvedValue(undefined),
      User: {
        addTags: jest.fn().mockResolvedValue(undefined),
        PushSubscription: {
          optIn: jest.fn().mockResolvedValue(undefined),
          id: 'sub-42',
        },
      },
    };

    const queuedFn = window.OneSignalDeferred[window.OneSignalDeferred.length - 1];
    await queuedFn(mockOneSignal);

    expect(mockOneSignal.login).toHaveBeenCalledWith('42');
    expect(mockOneSignal.User.addTags).toHaveBeenCalledWith({
      role: 'dispatcher',
      department_id: '5',
      department_code: 'bfp',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/onesignal-subscription'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ onesignal_player_id: 'sub-42' }),
      })
    );
  });

  test('logoutOneSignal calls OneSignal.logout()', async () => {
    await logoutOneSignal();

    const mockOneSignal = {
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const queuedFn = window.OneSignalDeferred[window.OneSignalDeferred.length - 1];
    await queuedFn(mockOneSignal);

    expect(mockOneSignal.logout).toHaveBeenCalled();
  });

  test('requestPushPermission requests permission directly and opts in when granted', async () => {
    window.Notification = {
      permission: 'granted',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    };
    sessionStorage.setItem('token', 'fake-jwt-token');

    const mockOneSignal = {
      User: {
        PushSubscription: {
          optIn: jest.fn().mockResolvedValue(undefined),
          id: 'sub-granted-123',
        },
      },
    };

    const result = await requestPushPermission();
    expect(result).toBe(true);
    expect(window.Notification.requestPermission).toHaveBeenCalled();

    expect(window.OneSignalDeferred.length).toBeGreaterThan(0);
    const queuedFn = window.OneSignalDeferred[window.OneSignalDeferred.length - 1];
    await queuedFn(mockOneSignal);

    expect(mockOneSignal.User.PushSubscription.optIn).toHaveBeenCalled();
  });

  test('initOneSignal queues only once (Strict Mode remount)', async () => {
    await initOneSignal();
    await initOneSignal();
    expect(window.OneSignalDeferred).toHaveLength(1);
  });

  test('setOneSignalUser queues init before login and ignores duplicate user id', async () => {
    await setOneSignalUser(42, { role: 'dispatcher' });
    await setOneSignalUser(42, { role: 'dispatcher' });
    expect(window.OneSignalDeferred).toHaveLength(2);
    const mockOneSignal = {
      init: jest.fn().mockResolvedValue(undefined),
      login: jest.fn().mockResolvedValue(undefined),
      Notifications: { addEventListener: jest.fn() },
      User: {
        addTags: jest.fn().mockResolvedValue(undefined),
        PushSubscription: { addEventListener: jest.fn(), optIn: jest.fn(), id: null },
      },
    };
    await window.OneSignalDeferred[0](mockOneSignal);
    await window.OneSignalDeferred[1](mockOneSignal);
    expect(mockOneSignal.init).toHaveBeenCalledTimes(1);
    expect(mockOneSignal.login).toHaveBeenCalledWith('42');
  });

  test('init treats already-initialized as success', async () => {
    await initOneSignal();
    const mockOneSignal = {
      init: jest.fn().mockRejectedValue(new Error('SDK already initialized')),
      Notifications: { addEventListener: jest.fn() },
      User: { PushSubscription: { addEventListener: jest.fn(), id: null } },
    };
    await window.OneSignalDeferred[0](mockOneSignal);
    expect(mockOneSignal.Notifications.addEventListener).toHaveBeenCalled();
  });
});
