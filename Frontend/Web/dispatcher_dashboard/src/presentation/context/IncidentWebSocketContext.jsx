import { createContext, useContext } from 'react';

export const IncidentWebSocketContext = createContext({
  status: 'disconnected',
  isConnected: false,
});

export function useIncidentWebSocketStatus() {
  return useContext(IncidentWebSocketContext);
}
