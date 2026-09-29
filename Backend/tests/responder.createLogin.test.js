jest.mock('../src/config/db', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));
jest.mock('../src/utils/auditLog', () => ({ logDispatcherAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/utils/hash', () => ({ hashPassword: jest.fn().mockResolvedValue('hashed') }));
jest.mock('../src/models/user');
jest.mock('../src/models/responder');

const User = require('../src/models/user');
const Responder = require('../src/models/responder');
const responderController = require('../src/controllers/responder');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('responder create mobile login without email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByEmail.mockResolvedValue(null);
    User.findByPhone.mockResolvedValue(null);
    User.create.mockResolvedValue({ user_id: 42 });
    Responder.create.mockResolvedValue({ responder_id: 7, name: 'Test Responder', user_id: 42 });
  });

  it('creates a login user with password + phone only', async () => {
    const req = {
      body: {
        name: 'Test Responder',
        password: 'Password1!',
        phone_number: '09171234567',
        department_id: 3,
      },
      user: { user_id: 1, role: 'admin' },
    };
    const res = mockRes();

    await responderController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: null,
      phone_number: expect.any(String),
      department_id: 3,
      role: 'responder',
    }));
    expect(Responder.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      name: 'Test Responder',
    }));
  });

  it('rejects password without phone_number', async () => {
    const req = {
      body: { name: 'Test Responder', password: 'Password1!' },
      user: { user_id: 1, role: 'admin' },
    };
    const res = mockRes();

    await responderController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringMatching(/password and phone_number/i),
    }));
    expect(User.create).not.toHaveBeenCalled();
  });
});
