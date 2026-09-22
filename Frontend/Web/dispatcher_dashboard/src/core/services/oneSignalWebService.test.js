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

  function mockOneSignal(overrides = {}) {
    return {
      init: jest.fn().mockResolvedValue(undefined),
      login: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
      Notifications: { addEventListener: jest.fn() },
      User: {
        addTags: jest.fn().mockResolvedValue(undefined),
        PushSubscription: {
          addEventListener: jest.fn(),
          optIn: jest.fn().mockResolvedValue(undefined),
          id: 'mock-sub-123',
        },
      },
      ...overrides,
    };
  }

  async function flushOneSignalQueue(mock) {
    expect(window.OneSignalDeferred.length).toBeGreaterThan(0);
    await window.OneSignalDeferred[0](mock);
  }

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

  test('initOneSignal registers pump and initializes SDK', async () => {
    const clickCallback = jest.fn();
    initOneSignal(clickCallback);

    const mock = mockOneSignal();
    sessionStorage.setItem('token', 'fake-jwt-token');
    await flushOneSignalQueue(mock);

    expect(mock.init).toHaveBeenCalled();
    expect(mock.Notifications.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(mock.User.PushSubscription.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  test('setOneSignalUser binds external ID and applies user tags', async () => {
    sessionStorage.setItem('token', 'fake-jwt-token');
    setOneSignalUser(42, {
      role: 'Dispatcher',
      departmentId: 5,
      departmentCode: 'BFP',
    });

    const mock = mockOneSignal({ User: { ...mockOneSignal().User, PushSubscription: { ...mockOneSignal().User.PushSubscription, id: 'sub-42' } } });
    await flushOneSignalQueue(mock);

    expect(mock.login).toHaveBeenCalledWith('42');
    expect(mock.User.addTags).toHaveBeenCalledWith({
      role: 'dispatcher',
      department_id: '5',
      department_code: 'bfp',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/onesignal-subscription'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ onesignal_player_id: 'sub-42' }),
      }),
    );
  });

  test('logoutOneSignal calls OneSignal.logout()', async () => {
    logoutOneSignal();
    const mock = mockOneSignal();
    await flushOneSignalQueue(mock);
    expect(mock.logout).toHaveBeenCalled();
  });

  test('requestPushPermission requests permission directly and opts in when granted', async () => {
    window.Notification = {
      permission: 'granted',
      requestPermission: jest.fn().mockResolvedValue('granted'),
    };
    sessionStorage.setItem('token', 'fake-jwt-token');

    const mock = mockOneSignal();
    const resultPromise = requestPushPermission();
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    await Promise.resolve();
    await flushOneSignalQueue(mock);
    await expect(resultPromise).resolves.toBe(true);
    expect(mock.User.PushSubscription.optIn).toHaveBeenCalled();
  });

  test('initOneSignal registers only one deferred pump (Strict Mode remount)', async () => {
    initOneSignal();
    initOneSignal();
    expect(window.OneSignalDeferred).toHaveLength(1);
  });

  test('setOneSignalUser ignores duplicate user id', async () => {
    setOneSignalUser(42, { role: 'dispatcher' });
    setOneSignalUser(42, { role: 'dispatcher' });
    expect(window.OneSignalDeferred).toHaveLength(1);
    const mock = mockOneSignal();
    await flushOneSignalQueue(mock);
    expect(mock.login).toHaveBeenCalledTimes(1);
  });

  test('init treats already-initialized as success', async () => {
    initOneSignal();
    const mock = mockOneSignal({
      init: jest.fn().mockRejectedValue(new Error('SDK already initialized')),
    });
    await flushOneSignalQueue(mock);
    expect(mock.Notifications.addEventListener).toHaveBeenCalled();
  });
});
