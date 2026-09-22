import { API_URL } from '@/core/config/app.config';
import { getAuthHeaders, parseJsonOrEmpty } from '@/data/api/http';

let notificationsInflight = null;
let unreadCountInflight = null;

/**
 * Fetch persisted notifications for the current user
 * @param {Object} params
 * @param {number} [params.limit=50]
 * @param {number} [params.offset=0]
 * @returns {Promise<Array>} Array of notification objects
 */
export async function getNotifications({ limit = 50, offset = 0 } = {}) {
  if (notificationsInflight) return notificationsInflight;
  notificationsInflight = (async () => {
  const url = `${API_URL}/api/notifications?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await parseJsonOrEmpty(res);
    throw new Error(data?.error || res.statusText || 'Failed to fetch notifications');
  }
  const body = await res.json();
  return Array.isArray(body) ? body : [];
  })().finally(() => {
    notificationsInflight = null;
  });
  return notificationsInflight;
}

/**
 * Mark a single notification as read for the current user
 * @param {number|string} notificationId
 * @returns {Promise<Object>} Updated notification
 */
export async function markNotificationAsRead(notificationId) {
  const url = `${API_URL}/api/notifications/${notificationId}/read`;
  const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await parseJsonOrEmpty(res);
    throw new Error(data?.error || res.statusText || 'Failed to mark notification as read');
  }
  return res.json();
}

/**
 * Mark all notifications as read for the current user
 * @returns {Promise<number>} Number of notifications marked
 */
export async function markAllAsRead() {
  const url = `${API_URL}/api/notifications/mark-all-read`;
  const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await parseJsonOrEmpty(res);
    throw new Error(data?.error || res.statusText || 'Failed to mark as read');
  }
  const data = await res.json();
  return typeof data?.marked === 'number' ? data.marked : 0;
}

/**
 * Fetch unread notification count for badge display
 * @returns {Promise<number>}
 */
export async function getUnreadCount() {
  if (unreadCountInflight) return unreadCountInflight;
  unreadCountInflight = (async () => {
  const url = `${API_URL}/api/notifications/unread-count`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = await parseJsonOrEmpty(res);
    throw new Error(data?.error || res.statusText || 'Failed to fetch unread count');
  }
  const data = await res.json();
  return typeof data?.count === 'number' ? data.count : 0;
  })().finally(() => {
    unreadCountInflight = null;
  });
  return unreadCountInflight;
}
