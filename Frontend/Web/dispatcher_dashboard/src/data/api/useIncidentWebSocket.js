import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/core/config/app.config';
import { getAuthToken } from '@/data/api/http';

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;
const WS_RECONNECT_MULTIPLIER = 2;

function getWsUrl() {
  const base = API_URL || 'http://localhost:3000';
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}/ws`;
}

const HIGH_SEVERITY = new Set(['high', 'critical']);

/**
 * Hook to connect to incident WebSocket, dispatch incident:updated events on messages,
 * and track connection status. Call once at app root (e.g. Layout).
 * @returns {{ status: 'connected'|'reconnecting'|'disconnected', notifications: Array, clearNotifications: Function }}
 */
export function useIncidentWebSocket() {
  const [status, setStatus] = useState('disconnected');
  const [notifications, setNotifications] = useState([]);
  const [lastHighSeverity, setLastHighSeverity] = useState(null);
  const [lastDispatched, setLastDispatched] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    function connect() {
      const token = getAuthToken();
      if (!token) {
        setStatus('disconnected');
        return;
      }

      const url = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.warn('[useIncidentWebSocket] WebSocket creation failed:', err);
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted) {
          ws.close();
          return;
        }
        setStatus('connected');
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(event.data);
          const { event: eventName, data } = msg || {};
          if (!eventName || !data) return;

          const reportId = data.report_id ?? data.reportId;
          window.dispatchEvent(
            new CustomEvent('incident:updated', {
              detail: { incidentId: reportId, event: eventName, data },
            })
          );

          if (eventName === 'incident:created' && HIGH_SEVERITY.has(String(data.severity_level || '').toLowerCase())) {
            setLastHighSeverity({ eventName, data });
          }

          if (eventName === 'incident:dispatched') {
            setLastDispatched({ eventName, data });
          }

          const title = formatNotificationTitle(eventName, data);
          const body = formatNotificationBody(eventName, data);
          if (title) {
            setNotifications((prev) => [
              {
                id: `ws-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                eventType: eventName,
                type: eventName.includes('created') ? 'alert' : eventName.includes('resolved') || eventName.includes('confirmed') ? 'success' : 'info',
                title,
                body,
                time: 'Just now',
                unread: true,
                reportId,
              },
              ...prev.slice(0, 49),
            ]);
          }
        } catch (err) {
          console.warn('[useIncidentWebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        wsRef.current = null;
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (!mounted) return;
        setStatus('reconnecting');
      };
    }

    function scheduleReconnect() {
      if (!mounted) return;
      const token = getAuthToken();
      if (!token) return;

      setStatus('reconnecting');
      const delay = Math.min(
        WS_RECONNECT_BASE_MS * Math.pow(WS_RECONNECT_MULTIPLIER, reconnectAttemptRef.current),
        WS_RECONNECT_MAX_MS
      );
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        // Avoid "closed before connection established" when React Strict Mode
        // unmounts during CONNECTING state - only close if already open/closing
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
          ws.close();
        }
        // If CONNECTING: let it finish; onopen will close it when mounted is false
      }
    };
  }, []);

  return {
    status,
    notifications,
    clearNotifications: () => setNotifications([]),
    lastHighSeverity,
    clearLastHighSeverity: () => setLastHighSeverity(null),
    lastDispatched,
    clearLastDispatched: () => setLastDispatched(null),
  };
}

import { formatIncidentTypesLabel } from '@/core/utils/incidentDisplay';

function formatNotificationTitle(eventName, data) {
  const type = formatIncidentTypesLabel(data);
  const barangay = data.barangay ? ` in ${data.barangay}` : '';
  switch (eventName) {
    case 'incident:created':
      return `New ${type} reported${barangay}`;
    case 'incident:status_updated':
      return `Incident #${data.report_id} status: ${data.status || 'updated'}`;
    case 'responder:status_changed':
      return `Volunteer: ${data.new_status || data.responder_status || 'updated'} on Incident #${data.report_id}`;
    case 'incident:verified':
      return `Incident #${data.report_id} verified`;
    case 'incident:dispatched':
      return `Incident #${data.report_id} dispatched`;
    case 'incident:resolution_confirmed':
      return `Incident #${data.report_id} resolved`;
    case 'incident:note_added':
      return `New note on incident #${data.report_id}`;
    default:
      return `Incident #${data.report_id} updated`;
  }
}

function formatNotificationBody(eventName, data) {
  const severity = data.severity_level ? ` (${data.severity_level})` : '';
  switch (eventName) {
    case 'incident:created':
      return `${formatIncidentTypesLabel(data)}${severity}${data.barangay ? ` in ${data.barangay}` : ''}`;
    case 'incident:status_updated':
      return `Status changed to ${data.status || 'updated'}`;
    case 'responder:status_changed':
      return `Volunteer responder status: ${data.new_status || data.responder_status || 'updated'}`;
    case 'incident:dispatched':
      return 'Responders have been assigned';
    default:
      return data.barangay ? `Barangay ${data.barangay}` : 'Update received';
  }
}
