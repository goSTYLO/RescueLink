const runtimeConfig = globalThis?.__RESCUELINK_CONFIG__ || {};
const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const processEnv = typeof process !== 'undefined' && process.env ? process.env : {};
const env = { ...processEnv, ...metaEnv };

const defaultApiUrl = 'http://localhost:3000';
const rawApiUrl = runtimeConfig.API_URL || env.VITE_API_URL || defaultApiUrl;
export const API_URL = String(rawApiUrl).replace(/\/+$/, '') || defaultApiUrl;

// Development mode - set to true to bypass authentication for design/testing
export const DEV_MODE = String(runtimeConfig.DEV_MODE || env.VITE_DEV_MODE || 'false') === 'true';

export const ONESIGNAL_APP_ID = runtimeConfig.ONESIGNAL_APP_ID || env.VITE_ONESIGNAL_APP_ID || '';

