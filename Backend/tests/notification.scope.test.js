const { ROLES } = require('../src/config/roles');

jest.mock('../src/models/notification', () => ({
  findAll: jest.fn(),
  countUnreadByUserId: jest.fn(),
  markAllAsReadByUserId: jest.fn(),
  markAsRead: jest.fn(),
}));

const Notification = require('../src/models/notification');
const notificationController = require('../src/controllers/notification');


function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
}

describe('notificationController scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAll defaults to current user when user_id query is omitted', async () => {
    Notification.findAll.mockResolvedValue([{ notification_id: 1, user_id: 2 }]);
    Notification.countUnreadByUserId.mockResolvedValue(1);

    const req = {
      user: { user_id: 2, role: ROLES.ADMIN },
      query: { limit: '50', offset: '0' },
    };
    const res = mockRes();

    await notificationController.getAll(req, res);

    expect(Notification.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2 })
    );
    expect(res.json).toHaveBeenCalledWith([{ notification_id: 1, user_id: 2 }]);
  });

  test('markAllAsRead returns marked count for current user', async () => {
    Notification.markAllAsReadByUserId.mockResolvedValue(3);

    const req = { user: { user_id: 5, role: ROLES.DISPATCHER } };
    const res = mockRes();

    await notificationController.markAllAsRead(req, res);

    expect(Notification.markAllAsReadByUserId).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith({ marked: 3 });
  });

  test('markAsRead updates a single notification for current user', async () => {
    Notification.markAsRead.mockResolvedValue({ notification_id: 9, is_read: true });

    const req = { user: { user_id: 5, role: ROLES.DISPATCHER }, params: { id: '9' } };
    const res = mockRes();

    await notificationController.markAsRead(req, res);

    expect(Notification.markAsRead).toHaveBeenCalledWith(9, 5);
    expect(res.json).toHaveBeenCalledWith({ notification_id: 9, is_read: true });
  });
});
