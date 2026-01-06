const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();

// Initialization options:
// 1) If FIREBASE_SERVICE_ACCOUNT_PATH is set, load the JSON file from that path.
// 2) Else if FIREBASE_SERVICE_ACCOUNT_KEY is set, parse the JSON string.
// 3) Else if GOOGLE_APPLICATION_CREDENTIALS is set, firebase-admin will use it automatically.

let initialized = false;

function init() {
  if (initialized) return admin;

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  try {
    if (path) {
      const serviceAccount = require(path);
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
