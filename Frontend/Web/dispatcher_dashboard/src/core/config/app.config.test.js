import { normalizeApiBaseUrl } from '@/core/config/normalizeApiBaseUrl';

describe('normalizeApiBaseUrl', () => {
  test('strips trailing slash', () => {
    expect(normalizeApiBaseUrl('https://resquelink-backend.onrender.com/')).toBe(
      'https://resquelink-backend.onrender.com'
    );
  });

  test('recovers from markdown link paste', () => {
    const broken =
      'https://your-backend-service.onrender.com](https://your-backend-service.onrender.com';
    expect(normalizeApiBaseUrl(broken)).toBe('https://your-backend-service.onrender.com');
  });
});
