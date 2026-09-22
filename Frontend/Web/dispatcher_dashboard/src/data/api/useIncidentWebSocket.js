import { useEffect, useRef, useState } from 'react';

import { API_URL } from '@/core/config/app.config';

import { getAuthToken } from '@/data/api/http';



const WS_RECONNECT_BASE_MS = 1000;

const WS_RECONNECT_MAX_MS = 30000;

const WS_RECONNECT_MULTIPLIER = 2;

import { AUTH_READY_EVENT } from '@/core/auth/session';



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

  const [lastBackupRequested, setLastBackupRequested] = useState(null);

  const [lastBackupJoined, setLastBackupJoined] = useState(null);

  const [lastEscalated, setLastEscalated] = useState(null);

  const wsRef = useRef(null);

  const reconnectTimeoutRef = useRef(null);

  const reconnectAttemptRef = useRef(0);

  const connectGenRef = useRef(0);

  const mountedRef = useRef(true);



  useEffect(() => {

    mountedRef.current = true;



    function scheduleReconnect() {

      if (!mountedRef.current) return;

      const token = getAuthToken();

      if (!token) {

        setStatus('disconnected');

        return;

      }



      setStatus('reconnecting');

      const delay = Math.min(

        WS_RECONNECT_BASE_MS * Math.pow(WS_RECONNECT_MULTIPLIER, reconnectAttemptRef.current),

        WS_RECONNECT_MAX_MS,

      );

      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {

        reconnectTimeoutRef.current = null;

        connect();

      }, delay);

    }



    function connect() {

      const token = getAuthToken();

      if (!token) {

        setStatus('disconnected');

        return;

      }



      const existing = wsRef.current;

      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {

        return;

      }



      const gen = connectGenRef.current + 1;

      connectGenRef.current = gen;



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

      setStatus('reconnecting');



      ws.onopen = () => {

        if (!mountedRef.current || gen !== connectGenRef.current) {
          ws.close(1000, 'superseded');
          return;
        }

        setStatus('connected');

        reconnectAttemptRef.current = 0;

      };



      ws.onmessage = (event) => {

        if (!mountedRef.current || gen !== connectGenRef.current) return;

        try {

          const msg = JSON.parse(event.data);

          const { event: eventName, data } = msg || {};

          if (!eventName || !data) return;



          const reportId = data.report_id ?? data.reportId;

          window.dispatchEvent(

            new CustomEvent('incident:updated', {

              detail: { incidentId: reportId, event: eventName, data },

            }),

          );



          if (eventName === 'incident:created' && HIGH_SEVERITY.has(String(data.severity_level || '').toLowerCase())) {

            setLastHighSeverity({ eventName, data });

          }



          if (eventName === 'incident:dispatched') {

            setLastDispatched({ eventName, data });

          }



          if (eventName === 'responder:backup_requested') {

            setLastBackupRequested({ eventName, data });

          }



          if (eventName === 'responder:backup_joined') {

            setLastBackupJoined({ eventName, data });

          }



          if (eventName.startsWith('incident:escalat')) {

            setLastEscalated({ eventName, data });

          }



          const title = formatNotificationTitle(eventName, data);

          const body = formatNotificationBody(eventName, data);

          if (title) {

            setNotifications((prev) => [

              {

                id: `ws-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,

                eventType: eventName,

                type: eventName.includes('created') || eventName.includes('escalated') ? 'alert' : eventName.includes('resolved') || eventName.includes('confirmed') || eventName.includes('accepted') ? 'success' : 'info',

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



      ws.onclose = (ev) => {

        if (gen !== connectGenRef.current) return;

        wsRef.current = null;

        if (!mountedRef.current) return;



        if (process.env.NODE_ENV !== 'production') {
          console.warn('[useIncidentWebSocket] closed', ev.code, ev.reason || '(no reason)');
        }



        if (getAuthToken()) {

          scheduleReconnect();

        } else {

          setStatus('disconnected');

        }

      };



      ws.onerror = () => {

        if (!mountedRef.current || gen !== connectGenRef.current) return;

        setStatus('reconnecting');

      };

    }



    connect();



    const onAuthReady = () => connect();

    window.addEventListener(AUTH_READY_EVENT, onAuthReady);



    return () => {

      mountedRef.current = false;

      connectGenRef.current += 1;

      window.removeEventListener(AUTH_READY_EVENT, onAuthReady);

      if (reconnectTimeoutRef.current) {

        clearTimeout(reconnectTimeoutRef.current);

        reconnectTimeoutRef.current = null;

      }

      const ws = wsRef.current;

      wsRef.current = null;

      if (ws) {
        // Do not close CONNECTING sockets — that triggers "closed before the connection
        // is established" (React Strict Mode remount). Stale gen in onopen closes after 101.
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'unmount');
        }
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

    lastBackupRequested,

    clearLastBackupRequested: () => setLastBackupRequested(null),

    lastBackupJoined,

    clearLastBackupJoined: () => setLastBackupJoined(null),

    lastEscalated,

    clearLastEscalated: () => setLastEscalated(null),

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

    case 'responder:backup_requested': {

      const requester = data.requested_by_name ? ` from ${data.requested_by_name}` : '';

      return `Backup requested on Incident #${data.report_id}${requester}`;

    }

    case 'responder:backup_acknowledged':

      return `Backup acknowledged for Incident #${data.report_id}`;

    case 'responder:backup_joined': {

      const joiner = data.volunteer_name ? ` — ${data.volunteer_name}` : '';

      return `Backup volunteer joined Incident #${data.report_id}${joiner}`;

    }

    case 'responder:backup_declined':

      return `Backup declined on Incident #${data.report_id}`;

    case 'responder:backup_status_changed':

      return `Backup volunteer status on Incident #${data.report_id}: ${data.new_status || data.responder_status || 'updated'}`;

    case 'incident:accepted': {

      const accepter = data.accepted_by_name ? ` by ${data.accepted_by_name}` : '';

      return `Volunteer accepted Incident #${data.report_id}${accepter}`;

    }

    case 'incident:escalated':

      return `Assistance requested on Incident #${data.report_id}`;

    case 'incident:escalation_accepted':

      return `Assistance request accepted for Incident #${data.report_id}`;

    case 'incident:escalation_declined':

      return `Assistance request declined for Incident #${data.report_id}`;

    case 'incident:escalation_cancelled':

      return `Assistance request cancelled for Incident #${data.report_id}`;

    case 'incident:escalation_resolved':

      return `Assistance resolved on Incident #${data.report_id}`;

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

    case 'responder:backup_requested':

      return `Target: ${data.target || 'cdrrmo'}${data.notes ? ` — ${data.notes}` : ''}`;

    case 'responder:backup_joined':

      return `Status: ${data.responder_status || 'Assigned'}`;

    case 'incident:accepted':

      return `Volunteer status: ${data.responder_status || 'Assigned'}`;

    case 'incident:dispatched':

      return 'Responders have been assigned';

    case 'incident:escalated':

      return `Target: ${data.to_department_name || `Dept #${data.to_department_id}`}${data.urgency ? ` (${data.urgency})` : ''}`;

    case 'incident:escalation_accepted':

      return `Accepted by ${data.to_department_name || `Dept #${data.to_department_id}`}`;

    case 'incident:escalation_declined':

      return `Declined by ${data.to_department_name || `Dept #${data.to_department_id}`}`;

    case 'incident:escalation_cancelled':

      return 'Request was cancelled';

    case 'incident:escalation_resolved':

      return 'Assistance completed';

    default:

      return data.barangay ? `Barangay ${data.barangay}` : 'Update received';

  }

}

