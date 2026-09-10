/**
 * Profile update: partial PATCH must not clear address; avatar rejects non-images.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/config/jwt');

jest.mock('../src/services/retryAiClassification', () => ({
  startRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/retryFileScan', () => ({
  startFileScanRetryService: () => ({ stop: jest.fn() }),
}));

jest.mock('../src/services/duplicateBackgroundAnalyzer', () => ({
  startDuplicateAnalyzer: () => null,
}));

const mockUser = {
  user_id: 42,
  phone_number: '09123456789',
  email: 'citizen@example.com',
  address: 'Barangay Test, Dagupan',
  phone_verified: true,
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'user',
  department_id: null,
  profile_image: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

jest.mock('../src/models/user', () => ({
  findById: jest.fn(async () => ({ ...mockUser })),
  getRoleById: jest.fn(async () => 'user'),
  updateAddress: jest.fn(async (_id, address) => {
    mockUser.address = address;
    return { ...mockUser };
  }),
  updateNames: jest.fn(async (_id, firstName, lastName) => {
    mockUser.first_name = firstName;
    mockUser.last_name = lastName;
    return { ...mockUser };
  }),
  updateProfileImage: jest.fn(),
}));

const User = require('../src/models/user');
const app = require('../src/app');

afterAll(() => {
  try {
    if (app?.locals?.retryTask?.stop) app.locals.retryTask.stop();
    if (app?.locals?.scanRetryTask?.stop) app.locals.scanRetryTask.stop();
  } catch (_) {}
});

const token = jwt.sign({ user_id: 42, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

describe('PATCH /api/auth/me partial update', () => {
  beforeEach(() => {
    mockUser.address = 'Barangay Test, Dagupan';
    mockUser.first_name = 'Jane';
    mockUser.last_name = 'Doe';
    User.findById.mockImplementation(async () => ({ ...mockUser }));
    User.updateAddress.mockClear();
    User.updateNames.mockClear();
  });

  it('updates names without calling updateAddress', async () => {
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Janet', lastName: 'Smith' });

    expect(res.status).toBe(200);
    expect(User.updateNames).toHaveBeenCalledWith(42, 'Janet', 'Smith');
    expect(User.updateAddress).not.toHaveBeenCalled();
    expect(res.body.user.address).toBe('Barangay Test, Dagupan');
    expect(res.body.user.firstName).toBe('Janet');
    expect(res.body.user.has_profile_image).toBe(false);
  });
});

describe('POST /api/auth/me/avatar validation', () => {
  it('rejects non-image uploads', async () => {
    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('%PDF-1.4 fake'), 'doc.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid avatar/i);
  });
});
