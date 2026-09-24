const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialization options:
// 1) If FIREBASE_SERVICE_ACCOUNT_PATH is set, load the JSON file from that path.
// 2) Else if FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY is set, parse the JSON string (Render).
// 3) Else if GOOGLE_APPLICATION_CREDENTIALS is set, firebase-admin will use it automatically.

let initialized = false;

function init() {
  if (initialized) return admin;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const key =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  try {
    if (serviceAccountPath) {
      // Resolve path: if absolute, use as-is; if relative, resolve from Backend root
      let resolvedPath;
      if (path.isAbsolute(serviceAccountPath)) {
        resolvedPath = serviceAccountPath;
      } else {
        // Resolve relative to Backend root (go up from src/config to Backend, then apply the path)
        // Handles paths like 'src/serviceAccountKey.json' or '../src/serviceAccountKey.json'
        const backendRoot = path.resolve(__dirname, '../..');
        // Normalize the path - remove leading '../' if present and resolve from backend root
        const normalizedPath = serviceAccountPath.startsWith('../') 
          ? serviceAccountPath.substring(3) // Remove '../' prefix
          : serviceAccountPath;
        resolvedPath = path.resolve(backendRoot, normalizedPath);
      }
      const serviceAccount = require(resolvedPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      initialized = true;
      return admin;
    }

    if (key) {
      const obj = JSON.parse(key);
      admin.initializeApp({ credential: admin.credential.cert(obj) });
      initialized = true;
      return admin;
    }

    // Fallback: let firebase-admin pick up GOOGLE_APPLICATION_CREDENTIALS or default creds.
    admin.initializeApp();
    initialized = true;
    return admin;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
    throw err;
  }
}

module.exports = init();
