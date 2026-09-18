/**
 * OneSignal push notification service.
 * Uses the OneSignal REST API v1 to send notifications to users identified
 * by their app user_id mapped as External User IDs.
 *
 * Push is best-effort: errors are logged but never thrown, so a push failure
 * never breaks the incident lifecycle API response.
 */
const https = require('https');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const WEB_DASHBOARD_URL = process.env.WEB_DASHBOARD_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

// OneSignal supports up to 2,000 external user IDs per request
const CHUNK_SIZE = 2000;
const MAX_RETRIES = 3;

/** Must match MainActivity NotificationChannel id (app-created → existing_android_channel_id). */
const EMERGENCY_ANDROID_CHANNEL_ID = '724e011a-e821-4e40-a810-9c175737a997';
/** Sound file base name (Android raw / iOS bundle); see ONESIGNAL_AMBER_ALERT_SETUP.md. */
const EMERGENCY_SOUND = 'emergency_alert';

/**
 * Build the OneSignal REST notification body (exported for unit tests).
 * @param {string} appId
 * @param {string[]} stringIds - external user ids
 * @param {object} payload
 */
function buildNotificationBody(appId, stringIds, payload) {
  const body = {
    app_id: appId,
    include_aliases: { external_id: stringIds },
    target_channel: 'push',
    headings: { en: payload.title },
    contents: { en: payload.body },
    // High priority for both quiet and critical so OEM/emulator tray is not silent.
    priority: 10,
    android_visibility: 1,
    // OneSignal rejects `url` when `web_url` / `app_url` is set.
    // Web click-through uses web_url; mobile deep-link uses `data.report_id`.
    ...(payload.url ? { web_url: payload.url } : {}),
    ...(payload.data ? { data: payload.data } : {}),
  };

  if (payload.critical) {
    // App-created channel in MainActivity — must use existing_android_channel_id.
    // android_channel_id targets the OneSignal dashboard category (often OS_<uuid>),
    // which MainActivity never repairs → silent/no-vibe when killed/asleep.
    body.existing_android_channel_id = EMERGENCY_ANDROID_CHANNEL_ID;
    body.android_sound = EMERGENCY_SOUND;
    body.ios_sound = `${EMERGENCY_SOUND}.wav`;
    // True DND bypass needs Apple Critical Alerts entitlement; upgrade to 'critical' then.
    body.ios_interruption_level = 'time_sensitive';
  } else {
    body.existing_android_channel_id = 'rescuelink_updates';
    body.android_sound = 'default';
  }

  return body;
}

/**
 * Dedupe / sanitize internal user ids before OneSignal include_aliases.
 * @param {unknown} userIds
 * @returns {number[]}
 */
function normalizePushUserIds(userIds) {
  return [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)
  )];
}

/**
 * Interpret OneSignal create-notification HTTP body (exported for unit tests).
 * HTTP 2xx with recipients:0 or errors[] is a delivery miss — log loudly.
 * @param {number} statusCode
 * @param {string} rawBody
 * @returns {{ ok: boolean, message: string, notificationId?: string, recipients?: number }}
 */
function interpretOneSignalResponse(statusCode, rawBody) {
  let parsed = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch (_) {
    parsed = null;
  }

  if (statusCode < 200 || statusCode >= 300) {
    return {
      ok: false,
      message: `OneSignal HTTP ${statusCode}: ${rawBody || '(empty body)'}`,
    };
  }

  const notificationId = parsed?.id != null ? String(parsed.id) : undefined;
  const recipients = typeof parsed?.recipients === 'number' ? parsed.recipients : undefined;
  const errors = parsed?.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors != null && typeof errors === 'object'
      ? Object.keys(errors).length > 0
      : Boolean(errors);

  if (hasErrors) {
    const invalidAliases = errors && typeof errors === 'object' && !Array.isArray(errors)
      ? errors.invalid_aliases
      : null;
    const hint = invalidAliases
      ? ' — External ID not linked / no subscription; open app and OneSignal.login as that user_id'
      : '';
    return {
      ok: false,
      message: `OneSignal errors (id=${notificationId ?? 'n/a'}, recipients=${recipients ?? 'n/a'}): ${JSON.stringify(errors)}${hint}`,
      notificationId,
      recipients,
    };
  }

  if (recipients === 0) {
    return {
      ok: false,
      message: `OneSignal delivered to 0 recipients (id=${notificationId ?? 'n/a'}) — check External ID / subscription`,
      notificationId,
      recipients: 0,
    };
  }

  return {
    ok: true,
    message: `OneSignal ok id=${notificationId ?? 'n/a'} recipients=${recipients ?? 'n/a'}`,
    notificationId,
    recipients,
  };
}

/**
 * Make a single HTTPS POST to OneSignal.
 * @param {object} body - The notification payload object
 * @returns {Promise<void>}
 */
function postToOneSignal(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const apiKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();
    const authHeader = apiKey.startsWith('Key ') || apiKey.startsWith('Basic ')
      ? apiKey
      : apiKey.startsWith('os_v2_')
        ? `Key ${apiKey}`
        : `Basic ${apiKey}`;

    const options = {
      hostname: 'onesignal.com',
      port: 443,
      path: '/api/v1/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const result = interpretOneSignalResponse(res.statusCode, data);
        if (result.ok) {
          console.log(`[oneSignalService] ${result.message}`);
          resolve();
        } else {
          reject(Object.assign(new Error(result.message), { statusCode: res.statusCode }));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Retry wrapper with exponential backoff. Retries only on 429 / 5xx.
 */
async function postWithRetry(body, attempt = 0) {
  try {
    await postToOneSignal(body);
  } catch (err) {
    const retryable = err.statusCode === 429 || (err.statusCode >= 500 && err.statusCode < 600);
    if (retryable && attempt < MAX_RETRIES - 1) {
      const delayMs = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
      await new Promise((r) => setTimeout(r, delayMs));
      return postWithRetry(body, attempt + 1);
    }
    throw err;
  }
}

/**
 * Check whether push is enabled for a given user and event type.
 * Default is enabled (opt-out model — no row = enabled).
 * @param {object} pool - pg Pool instance
 * @param {number} userId
 * @param {string} eventType
 * @returns {Promise<boolean>}
 */
async function isPushEnabled(pool, userId, eventType) {
  try {
    const res = await pool.query(
      'SELECT push_enabled FROM notification_preferences WHERE user_id = $1 AND event_type = $2',
      [userId, eventType]
    );
    // No row = default enabled
    if (res.rows.length === 0) return true;
    return res.rows[0].push_enabled !== false;
  } catch {
    return true; // fail open — never silently block a push due to a DB error
  }
}

/**
 * Send push notifications to a list of internal user IDs.
 *
 * @param {number[]} userIds       - Array of internal app user_ids
 * @param {object}   payload
 * @param {string}   payload.title
 * @param {string}   payload.body
 * @param {string}   [payload.url]            - Web deep-link URL
 * @param {object}   [payload.data]           - Custom data for mobile deep-link
 * @param {string}   [payload.eventType]      - Used to filter by user preferences
 * @param {boolean}  [payload.critical]       - Amber-style high-priority / emergency channel
 * @param {object}   [pool]                   - pg Pool for preference checks (optional)
 */
async function sendPushToUsers(userIds, payload, pool = null) {
  const appId = (process.env.ONESIGNAL_APP_ID || '').trim();
  const apiKey = (process.env.ONESIGNAL_REST_API_KEY || '').trim();

  if (process.env.NODE_ENV === 'test') {
    return;
  }
  if (!appId || !apiKey) {
    console.warn(
      `[oneSignalService] skipped: OneSignal not configured (appId=${Boolean(appId)} apiKey=${Boolean(apiKey)})`
    );
    return;
  }
  const uniqueIds = normalizePushUserIds(userIds);
  if (uniqueIds.length === 0) return;

  try {
    // Filter by notification preferences if pool is provided
    let eligibleIds = uniqueIds;
    if (pool && payload.eventType) {
      const filtered = [];
      for (const uid of uniqueIds) {
        const enabled = await isPushEnabled(pool, uid, payload.eventType);
        if (enabled) filtered.push(uid);
      }
      eligibleIds = filtered;
    }
    if (eligibleIds.length === 0) {
      console.warn(
        `[oneSignalService] skipped: no eligible after prefs filter eventType=${payload.eventType || 'n/a'} requested=[${uniqueIds.join(',')}]`
      );
      return;
    }

    // Chunk into groups of CHUNK_SIZE
    for (let i = 0; i < eligibleIds.length; i += CHUNK_SIZE) {
      const chunk = eligibleIds.slice(i, i + CHUNK_SIZE);
      const stringIds = chunk.map(String);
      const body = buildNotificationBody(appId, stringIds, payload);

      try {
        await postWithRetry(body);
      } catch (err) {
        console.error(`[oneSignalService] Failed to send push to chunk starting at ${i}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[oneSignalService] Unexpected error:', err.message);
  }
}

/**
 * Amber-style titles for department notify vs team assign.
 * @param {'dept'|'team'} kind
 */
function formatCriticalPushTitle(kind) {
  if (kind === 'team') return 'Your team is up';
  return 'Respond now';
}

/** Turn enum-like status into a short readable label (in_progress → In progress). */
function humanizeStatus(status) {
  if (!status) return 'updated';
  const s = String(status).replace(/_/g, ' ').trim();
  if (!s) return 'updated';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Format incident type label supporting single or multiple types.
 */
function getIncidentTypeLabel(data) {
  if (!data) return 'Incident';
  if (Array.isArray(data.incident_types) && data.incident_types.length > 0) {
    return data.incident_types
      .map((t) => (typeof t === 'string' ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : String(t)))
      .join(', ');
  }
  if (typeof data.incident_type === 'string' && data.incident_type.trim()) {
    return data.incident_type.charAt(0).toUpperCase() + data.incident_type.slice(1).toLowerCase();
  }
  return 'Incident';
}

/**
 * Build a push title for a given incident event.
 */
function formatPushTitle(event) {
  const map = {
    'incident:created': 'New incident',
    'incident:verified': 'Verified',
    'incident:dispatched': 'Responders assigned',
    'incident:status_updated': 'Status update',
    'incident:resolution_confirmed': 'Resolved',
    'incident:reclassified': 'Type changed',
    'incident:note_added': 'New note',
    'incident:archived': 'Archived',
    'incident:unarchived': 'Restored',
    'backup_request': 'Backup needed',
    'responder:backup_requested': 'Backup needed',
    'responder:backup_joined': 'Backup joined',
    'responder:status_changed': 'Status update',
    'incident:accepted': 'Accepted',
    'incident:escalated': 'Help requested',
    'incident:escalation_accepted': 'Help accepted',
    'incident:escalation_declined': 'Help declined',
    'incident:escalation_resolved': 'Help done',
    'incident:escalation_cancelled': 'Help cancelled',
  };
  return map[event] || 'RescueLink update';
}

/**
 * Build a push body for a given incident event and data payload.
 * @param {string} event
 * @param {object} data
 * @param {{ audience?: 'team'|'dept'|'quiet' }} [options]
 *   For incident:dispatched, audience 'team' is personal (critical only).
 *   Default/quiet never says "Your team".
 */
function formatPushBody(event, data, options = {}) {
  const reportId = data?.report_id ?? data?.reportId;
  const idBit = reportId != null ? `#${reportId}` : 'Incident';
  const incidentType = getIncidentTypeLabel(data);
  const barangay = data?.barangay ? ` in ${data.barangay}` : '';
  const severity = data?.severity_level ? ` (${data.severity_level})` : '';
  const typeBit = `${incidentType}${severity}`;
  const toDeptName = data?.to_department_name || 'another department';
  const urgencyPrefix =
    data?.urgency && String(data.urgency).toLowerCase() === 'high' ? 'Urgent: ' : '';
  const audience = options.audience;

  switch (event) {
    case 'incident:created':
      return `${typeBit}${barangay}`;
    case 'incident:verified':
      return `${idBit} verified${barangay}`;
    case 'incident:dispatched':
      if (audience === 'team') {
        return `${idBit} ${typeBit}${barangay} — go now`;
      }
      if (audience === 'dept') {
        return `${idBit} ${typeBit}${barangay} — your department`;
      }
      return `${idBit} ${typeBit}${barangay} — assigned`;
    case 'incident:status_updated':
      return `${idBit} is now ${humanizeStatus(data?.status)}`;
    case 'incident:resolution_confirmed':
      return `${idBit} resolved`;
    case 'incident:reclassified':
      return `${idBit} is now ${incidentType}`;
    case 'incident:note_added':
      return `New note on ${idBit}`;
    case 'incident:archived':
      return `${idBit} archived`;
    case 'incident:unarchived':
      return `${idBit} restored`;
    case 'backup_request':
    case 'responder:backup_requested':
      return `Backup for ${idBit}${barangay}`;
    case 'responder:backup_joined':
      return `${data?.volunteer_name || 'A volunteer'} joined ${idBit}`;
    case 'incident:escalated':
      return `${urgencyPrefix}${toDeptName} asked to help on ${idBit}`;
    case 'incident:escalation_accepted':
      return `${toDeptName} accepted ${idBit}`;
    case 'incident:escalation_declined':
      return `${toDeptName} declined ${idBit}`;
    case 'incident:escalation_resolved':
      return `${toDeptName} finished ${idBit}`;
    case 'incident:escalation_cancelled':
      return `Help request for ${idBit} cancelled`;
    default:
      return reportId != null ? `${idBit} updated` : 'An update is available.';
  }
}

module.exports = {
  sendPushToUsers,
  formatPushTitle,
  formatPushBody,
  formatCriticalPushTitle,
  humanizeStatus,
  getIncidentTypeLabel,
  buildNotificationBody,
  interpretOneSignalResponse,
  normalizePushUserIds,
  EMERGENCY_ANDROID_CHANNEL_ID,
  EMERGENCY_SOUND,
};
