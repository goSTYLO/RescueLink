const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 1) FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY (Render)
// 2) FIREBASE_SERVICE_ACCOUNT_PATH if the file exists (local dev)
// 3) GOOGLE_APPLICATION_CREDENTIALS (firebase-admin default)
// If none apply, Firebase stays disabled; phone auth routes fail until configured.

let initialized = false;

function createDisabledAdmin() {
  return {
    auth: () => ({
      verifyIdToken: async () => {
        const err = new Error('Firebase Admin is not configured on this server');
        err.code = 'FIREBASE_NOT_CONFIGURED';
        throw err;
      },
    }),
  };
}

function init() {
  if (initialized) return admin;

  const jsonKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  try {
    if (jsonKey) {
      const obj = JSON.parse(jsonKey);
      admin.initializeApp({ credential: admin.credential.cert(obj) });
      initialized = true;
      return admin;
    }

    if (serviceAccountPath) {
      let resolvedPath;
      if (path.isAbsolute(serviceAccountPath)) {
        resolvedPath = serviceAccountPath;
      } else {
        const backendRoot = path.resolve(__dirname, '../..');
        const normalizedPath = serviceAccountPath.startsWith('../')
          ? serviceAccountPath.substring(3)
          : serviceAccountPath;
        resolvedPath = path.resolve(backendRoot, normalizedPath);
      }
      if (!fs.existsSync(resolvedPath)) {
        console.warn(
          `Firebase: service account file not found at ${resolvedPath}; set FIREBASE_SERVICE_ACCOUNT_JSON on Render or unset FIREBASE_SERVICE_ACCOUNT_PATH`
        );
      } else {
        const serviceAccount = require(resolvedPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        initialized = true;
        return admin;
      }
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      initialized = true;
      return admin;
    }

    console.warn(
      'Firebase Admin SDK not configured — phone/Firebase auth endpoints will not work until FIREBASE_SERVICE_ACCOUNT_JSON is set'
    );
    return createDisabledAdmin();
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message);
    return createDisabledAdmin();
  }
}

module.exports = init();
