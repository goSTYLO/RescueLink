import { changePassword, getMe, loginDispatcher, logout, verifyDispatcherOtp } from '@/data/api/auth.api';

jest.mock('@/core/config/app.config', () => ({
  API_URL: 'http://localhost:3000',
  DEV_MODE: false,
}));

describe('auth.api contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    global.fetch = jest.fn();
  });

  test('loginDispatcher posts credentials and returns payload', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'jwt-token' }),
    });

    const data = await loginDispatcher('dispatcher@example.com', 'password123');

    expect(data).toEqual({ token: 'jwt-token' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/api/auth/dispatcher/login');
    expect(options.method).toBe('POST');
    expect(options.headers['x-request-id']).toContain('web-auth-login-');
    expect(JSON.parse(options.body)).toEqual({
      email: 'dispatcher@example.com',
      password: 'password123',
    });
  });

  test('verifyDispatcherOtp surfaces backend message', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid or expired OTP' }),
    });

    await expect(verifyDispatcherOtp('abc-session', '123456')).rejects.toThrow('Invalid or expired OTP');
  });

  test('getMe sends bearer token from storage', async () => {
    sessionStorage.setItem('token', 'secure-token');
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ user: { id: 9 } }),
    });

    const user = await getMe();

    expect(user).toEqual({ id: 9 });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer secure-token');
  });

  test('changePassword requires auth token', async () => {
    await expect(changePassword('old', 'new')).rejects.toThrow('No authentication token found');
  });

  test('logout is no-op without token', async () => {
    await logout();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('fetchAvatarBlob shares in-flight GET and caches 404', async () => {
    const { fetchAvatarBlob, invalidateAvatarCache } = require('@/data/api/auth.api');
    invalidateAvatarCache();
    sessionStorage.setItem('token', 'secure-token');
    let resolveFetch;
    fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const first = fetchAvatarBlob();
    const second = fetchAvatarBlob();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: false,
      status: 404,
    });
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);

    await fetchAvatarBlob();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
