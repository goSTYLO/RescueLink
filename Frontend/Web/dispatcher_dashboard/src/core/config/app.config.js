const runtimeConfig = globalThis?.__RESCUELINK_CONFIG__ || {};
const env = typeof process !== 'undefined' ? process.env || {} : {};
const defaultApiUrl = 'http://localhost:3000';
const rawApiUrl = runtimeConfig.API_URL || env.VITE_API_URL || defaultApiUrl;
export const API_URL = String(rawApiUrl).replace(/\/+$/, '') || defaultApiUrl;

// Development mode - set to true to bypass authentication for design/testing
export const DEV_MODE = String(runtimeConfig.DEV_MODE || env.VITE_DEV_MODE || 'false') === 'true';

// Mapbox public access token for maps (set in .env)
const viteToken = typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN;
export const MAPBOX_ACCESS_TOKEN = runtimeConfig.MAPBOX_ACCESS_TOKEN || viteToken || env.VITE_MAPBOX_ACCESS_TOKEN || '';

// WebSocket configuration
const WS_PATH = runtimeConfig.WS_PATH || env.VITE_WS_PATH || '/ws';

/**
 * Get WebSocket URL from API_URL
 * Converts http:// to ws:// and https:// to wss://
 * @returns {string} WebSocket URL
 */
export function getWebSocketUrl() {
  const apiUrl = API_URL;
  const token = localStorage.getItem('token');

  // Replace http:// with ws:// and https:// with wss://
  const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsBase = apiUrl.replace(/^https?/, wsProtocol);

  // Append WebSocket path and token
  const wsUrl = `${wsBase}${WS_PATH}?token=${encodeURIComponent(token || '')}`;
  return wsUrl;
}
