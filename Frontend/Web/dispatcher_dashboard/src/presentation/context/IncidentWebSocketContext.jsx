import { createContext, useContext } from 'react';
import { useIncidentWebSocket } from '@/data/api/useIncidentWebSocket';

const noop = () => {};

export const IncidentWebSocketContext = createContext({
  status: 'disconnected',
  isConnected: false,
  notifications: [],
  clearNotifications: noop,
  lastHighSeverity: null,
  clearLastHighSeverity: noop,
  lastDispatched: null,
  clearLastDispatched: noop,
  lastBackupRequested: null,
  clearLastBackupRequested: noop,
  lastBackupJoined: null,
  clearLastBackupJoined: noop,
  lastEscalated: null,
  clearLastEscalated: noop,
});

export function IncidentWebSocketProvider({ children }) {
  const ws = useIncidentWebSocket();
  const value = {
    ...ws,
    isConnected: ws.status === 'connected',
  };
  return (
    <IncidentWebSocketContext.Provider value={value}>
      {children}
    </IncidentWebSocketContext.Provider>
  );
}

export function useIncidentWebSocketStatus() {
  return useContext(IncidentWebSocketContext);
}
