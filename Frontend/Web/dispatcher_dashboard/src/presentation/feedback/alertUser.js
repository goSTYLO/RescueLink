import { createElement } from 'react';
import { App } from 'antd';

let api = null;

export function bindAntdFeedback(next) {
  api = next;
}

export function AntdFeedbackBridge() {
  bindAntdFeedback(App.useApp());
  return null;
}

function kind(icon) {
  if (icon === 'success' || icon === 'error' || icon === 'warning' || icon === 'info') return icon;
  return 'info';
}

function contentNode(options) {
  if (options.html) {
    return createElement('div', { dangerouslySetInnerHTML: { __html: options.html } });
  }
  return options.text || null;
}

function summary(options) {
  return [options.title, options.text].filter(Boolean).join(' — ');
}

const resolved = { isConfirmed: true, isDismissed: false, value: true };

/**
 * Ant Design stand-in for the old SweetAlert calls.
 * Confirmations use modal.confirm. Timed notices use message. Toasts use notification.
 */
export function alertUser(options = {}) {
  if (!api?.modal || !api?.message || !api?.notification) {
    return Promise.resolve(resolved);
  }

  const type = kind(options.icon);
  const duration = options.timer ? options.timer / 1000 : undefined;

  if (options.toast) {
    api.notification[type]({
      message: options.title || 'Notice',
      description: options.text,
      duration: duration ?? 5,
      placement: 'topRight',
    });
    return Promise.resolve(resolved);
  }

  if (options.showCancelButton) {
    const danger = options.confirmButtonColor === '#dc2626';
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      api.modal.confirm({
        title: options.title,
        content: contentNode(options),
        okText: options.confirmButtonText || 'OK',
        cancelText: options.cancelButtonText || 'Cancel',
        okButtonProps: danger ? { danger: true } : undefined,
        onOk: () => finish({ isConfirmed: true, isDismissed: false, value: true }),
        onCancel: () => finish({ isConfirmed: false, isDismissed: true, value: undefined }),
      });
    });
  }

  if (options.showConfirmButton === false) {
    api.message[type](summary(options) || 'Done', duration);
    return Promise.resolve(resolved);
  }

  return new Promise((resolve) => {
    api.modal[type]({
      title: options.title,
      content: contentNode(options),
      okText: options.confirmButtonText || 'OK',
      onOk: () => resolve(resolved),
      onCancel: () => resolve({ isConfirmed: false, isDismissed: true, value: undefined }),
    });
  });
}
