import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketUrl } from '@/core/config/app.config';
import { getAuthToken } from '@/data/api/http';

const RealtimeContext = createContext(null);

// Reconnection backoff: start at 1s, max at 30s
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const RETRY_MULTIPLIER = 2;

// Global connection tracking to prevent duplicate WebSocket connections
let globalWsConnection = null;
let globalConnectionCount = 0;

// Global refetch tracking to prevent request storms across components
const globalRefetchState = {
  lastFetchTime: 0,
  inflightRequests: new Set(),
  MIN_FETCH_INTERVAL: 2000, // Minimum 2 seconds between fetches triggered by realtime
};

/**
 * Check if we should allow a refetch based on global cooldown
 * @returns {boolean} true if refetch should proceed
 */
export function shouldAllowRealtimeRefetch(requestKey = 'default') {
  const now = Date.now();
  const timeSinceLastFetch = now - globalRefetchState.lastFetchTime;

  // Check if minimum interval has passed
  if (timeSinceLastFetch < globalRefetchState.MIN_FETCH_INTERVAL) {
    return false;
  }

  // Check if this specific request type is already inflight
  if (globalRefetchState.inflightRequests.has(requestKey)) {
    return false;
  }

  return true;
}

/**
 * Mark a refetch as starting
 */
export function markRealtimeRefetchStart(requestKey = 'default') {
  globalRefetchState.inflightRequests.add(requestKey);
}

/**
 * Mark a refetch as complete
 */
export function markRealtimeRefetchComplete(requestKey = 'default') {
  globalRefetchState.lastFetchTime = Date.now();
  globalRefetchState.inflightRequests.delete(requestKey);
}

/**
 * Create a debounced refetch handler
 * @param {Function} fetchFn - The fetch function to call
 * @param {number} delay - Debounce delay in ms (default 1500)
 * @returns {Function} Debounced handler
 */
export function createDebouncedRefetch(fetchFn, delay = 1500) {
  let timeoutId = null;
  let isFirstCall = true;

  return () => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // First call executes immediately (but still checks cooldown)
    if (isFirstCall) {
      isFirstCall = false;
      if (shouldAllowRealtimeRefetch()) {
        markRealtimeRefetchStart();
        fetchFn().finally(() => markRealtimeRefetchComplete());
      }
      return;
    }

    // Subsequent calls are debounced
    timeoutId = setTimeout(() => {
      if (shouldAllowRealtimeRefetch()) {
        markRealtimeRefetchStart();
        fetchFn().finally(() => markRealtimeRefetchComplete());
      }
      timeoutId = null;
    }, delay);
  };
}

/**
 * RealtimeProvider - Manages WebSocket connection and broadcasts events
 * Handles automatic reconnection with exponential backoff
 */
export function RealtimeProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const isIntentionallyClosedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const connectionIdRef = useRef(0);

  const connect = useCallback(() => {
    // Check if there's already a global connection we can reuse
    if (globalWsConnection && globalWsConnection.readyState === WebSocket.OPEN) {
      console.log('[Realtime] Reusing existing global WebSocket connection');
      wsRef.current = globalWsConnection;
      connectionIdRef.current = ++globalConnectionCount;
      setIsConnected(true);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      console.log('[Realtime] No auth token available, skipping connection');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('[Realtime] Connection already in progress or established');
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      console.log('[Realtime] Connecting to WebSocket...');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      globalWsConnection = ws;
      connectionIdRef.current = ++globalConnectionCount;

      ws.onopen = () => {
        console.log('[Realtime] WebSocket connected');
        setIsConnected(true);
        retryDelayRef.current = INITIAL_RETRY_DELAY;
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[Realtime] Received:', message.type);

          // Handle connection established message
          if (message.type === 'connection:established') {
            console.log('[Realtime] Connection confirmed by server');
            return;
          }

          // Store the last event for consumers
          setLastEvent({
            type: message.type,
            payload: message.payload,
            receivedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[Realtime] Failed to parse message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[Realtime] WebSocket closed: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);

        // Only clear global if this is the current global connection
        if (globalWsConnection === wsRef.current) {
          globalWsConnection = null;
        }
        wsRef.current = null;

        // Don't reconnect if intentionally closed
        if (isIntentionallyClosedRef.current) {
          return;
        }

        // Schedule reconnection with backoff
        const delay = Math.min(retryDelayRef.current * RETRY_MULTIPLIER, MAX_RETRY_DELAY);
        retryDelayRef.current = delay;
        reconnectAttemptsRef.current += 1;

        console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('[Realtime] WebSocket error:', error);
      };
    } catch (err) {
      console.error('[Realtime] Failed to create WebSocket:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    isIntentionallyClosedRef.current = true;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Only close if this is the last/only connection using the WebSocket
    if (wsRef.current && globalConnectionCount <= 1) {
      wsRef.current.close(1000, 'Intentional disconnect');
      globalWsConnection = null;
    }

    wsRef.current = null;
    connectionIdRef.current = 0;

    setIsConnected(false);
    console.log('[Realtime] Disconnected intentionally');
  }, []);

  // Connect on mount if token exists
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      isIntentionallyClosedRef.current = false;
      connect();
    }

    // Listen for storage changes (token updates)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (e.newValue && !isConnected) {
          // Token added, connect
          isIntentionallyClosedRef.current = false;
          connect();
        } else if (!e.newValue && isConnected) {
          // Token removed, disconnect
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      disconnect();
    };
  }, [connect, disconnect, isConnected]);

  const value = {
    isConnected,
    lastEvent,
    connect,
    disconnect,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Hook to access realtime connection status and events
 * @returns {{ isConnected: boolean, lastEvent: {type: string, payload: Object, receivedAt: string}|null, connect: () => void, disconnect: () => void }}
 */
export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

/**
 * Hook to listen for specific realtime events
 * @param {string|string[]} eventTypes - Event type(s) to listen for
 * @param {Function} callback - Callback function when event is received
 */
export function useRealtimeEvent(eventTypes, callback) {
  const { lastEvent } = useRealtime();
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!lastEvent) return;

    if (types.includes(lastEvent.type)) {
      callbackRef.current(lastEvent.payload, lastEvent);
    }
  }, [lastEvent, types]);
}

/**
 * Hook to listen for realtime events with debouncing to prevent request storms
 * This should be used for refetching data, not for immediate UI updates
 * @param {string|string[]} eventTypes - Event type(s) to listen for
 * @param {Function} callback - Callback function when event is received (debounced)
 * @param {number} debounceMs - Debounce delay in milliseconds (default 2000)
 * @param {string} requestKey - Unique key for this refetch type to prevent duplicates
 */
export function useRealtimeEventDebounced(eventTypes, callback, debounceMs = 2000, requestKey = 'default') {
  const { lastEvent } = useRealtime();
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  const callbackRef = useRef(callback);
  const timeoutRef = useRef(null);
  const isFirstEventRef = useRef(true);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!lastEvent) return;
    if (!types.includes(lastEvent.type)) return;

    // Check if we should process this event
    if (!shouldAllowRealtimeRefetch(requestKey)) {
      console.log(`[RealtimeDebounced] Skipping event, cooldown active for ${requestKey}`);
      return;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // First event after mount: immediate execution (with cooldown check)
    if (isFirstEventRef.current) {
      isFirstEventRef.current = false;
      markRealtimeRefetchStart(requestKey);
      Promise.resolve(callbackRef.current(lastEvent.payload, lastEvent)).finally(() => {
        markRealtimeRefetchComplete(requestKey);
      });
      return;
    }

    // Subsequent events: debounced
    timeoutRef.current = setTimeout(() => {
      if (shouldAllowRealtimeRefetch(requestKey)) {
        markRealtimeRefetchStart(requestKey);
        Promise.resolve(callbackRef.current(lastEvent.payload, lastEvent)).finally(() => {
          markRealtimeRefetchComplete(requestKey);
        });
      }
      timeoutRef.current = null;
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [lastEvent, types, debounceMs, requestKey]);
}

export default RealtimeContext;
