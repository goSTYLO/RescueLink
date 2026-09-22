import { alertUser, bindAntdFeedback } from '@/presentation/feedback/alertUser';

describe('alertUser', () => {
  test('confirm resolves when the modal ok handler runs', async () => {
    let config;
    bindAntdFeedback({
      message: { success() {}, error() {}, warning() {}, info() {} },
      notification: { success() {}, error() {}, warning() {}, info() {} },
      modal: { confirm: (next) => { config = next; } },
    });

    const pending = alertUser({ title: 'Log out?', showCancelButton: true, confirmButtonColor: '#dc2626' });
    expect(config.okButtonProps).toEqual({ danger: true });
    config.onOk();
    await expect(pending).resolves.toEqual(expect.objectContaining({ isConfirmed: true }));
  });

  test('timed success uses message and resolves immediately', async () => {
    const success = jest.fn();
    bindAntdFeedback({
      message: { success, error() {}, warning() {}, info() {} },
      notification: { success() {}, error() {}, warning() {}, info() {} },
      modal: { confirm() {} },
    });

    await expect(alertUser({
      icon: 'success',
      title: 'Archived',
      text: 'Moved',
      timer: 2000,
      showConfirmButton: false,
    })).resolves.toEqual(expect.objectContaining({ isConfirmed: true }));
    expect(success).toHaveBeenCalledWith('Archived — Moved', 2);
  });
});
