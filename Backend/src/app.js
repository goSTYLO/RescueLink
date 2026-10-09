const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');
const authRoutes = require('./routes/auth');
const responderRoutes = require('./routes/responder');
const dispatchRoutes = require('./routes/dispatch');
const notificationRoutes = require('./routes/notification');
const locationRoutes = require('./routes/location');
const incidentRoutes = require('./routes/incident');
const auditLogRoutes = require('./routes/auditLog');
const adminRoutes = require('./routes/admin');
const departmentRoutes = require('./routes/department');
const metricsRoutes = require('./routes/metrics');
const analyticsRoutes = require('./routes/analytics');
const requestTimingMiddleware = require('./middleware/requestTiming');
const { startRetryService } = require('./services/retryAiClassification');
const { startAiWarmup } = require('./services/aiService');
const { startFileScanRetryService } = require('./services/retryFileScan');
const { startDuplicateAnalyzer } = require('./services/duplicateBackgroundAnalyzer');
const responderApplicationRoutes = require('./routes/responderApplications');

const app = express();

// Trust proxy so rate limiter sees real client IP behind reverse proxy
app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, etc.)
app.use(helmet());

// CORS: restrict to FRONTEND_URL in production; allow all in dev when unset
const corsOrigin = process.env.FRONTEND_URL || true;
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  exposedHeaders: ['x-request-id', 'x-total-count', 'x-limit', 'x-offset'],
}));

// Derive a stable account key from auth request body (for per-account rate limit).
// Used so different accounts on the same IP get separate limits (e.g. user vs dispatcher).
function getAuthAccountKey(req) {
  const body = req.body || {};
  if (typeof body.email === 'string') {
    return 'e:' + body.email.trim().toLowerCase();
  }
  if (typeof body.phone === 'string') {
    const digits = body.phone.replace(/\D/g, '');
    return digits ? 'p:' + digits : null;
  }
  if (typeof body.sessionToken === 'string') {
    return 's:' + crypto.createHash('sha256').update(body.sessionToken).digest('hex').slice(0, 16);
  }
  if (typeof body.idToken === 'string') {
    return 'i:' + crypto.createHash('sha256').update(body.idToken).digest('hex').slice(0, 16);
  }
  if (typeof body.token === 'string') {
    return 't:' + crypto.createHash('sha256').update(body.token).digest('hex').slice(0, 16);
  }
  return null;
}

const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const authRateLimitGlobalMax = process.env.AUTH_RATE_LIMIT_GLOBAL_MAX
  ? parseInt(process.env.AUTH_RATE_LIMIT_GLOBAL_MAX, 10)
  : (process.env.NODE_ENV === 'production' ? 50 : 200);
const authRateLimitAccountMax = process.env.AUTH_RATE_LIMIT_ACCOUNT_MAX
  ? parseInt(process.env.AUTH_RATE_LIMIT_ACCOUNT_MAX, 10)
  : (process.env.NODE_ENV === 'production' ? 10 : 30);

// Session/profile routes: no brute-force limit (logout, /me, avatar, push subscription).
function isAuthSessionMaintenance(req) {
  const path = req.path || '';
  if (req.method === 'POST' && path === '/logout') return true;
  if (req.method === 'POST' && path === '/onesignal-subscription') return true;
  if (path === '/me' || path.startsWith('/me/')) return true;
  return false;
}

function skipAuthCredentialLimiter(req) {
  if (isAuthSessionMaintenance(req)) return true;
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  return false;
}

// Global auth rate limit per IP (credential traffic only; session maintenance excluded)
const authLimiterGlobal = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: authRateLimitGlobalMax,
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isAuthSessionMaintenance,
});

// Per IP+account: failed credential attempts only (successful login/OTP does not consume quota)
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_WINDOW_MS,
  max: authRateLimitAccountMax,
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipAuthCredentialLimiter,
  keyGenerator: (req) => {
    const ipPart = ipKeyGenerator(req.ip || 'unknown');
    const accountKey = getAuthAccountKey(req);
    return accountKey ? `${ipPart}:${accountKey}` : ipPart;
  },
});

app.use(express.json());

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.use(requestTimingMiddleware);

// General API rate limit: configurable via API_RATE_LIMIT_MAX (default 2000/15min for dev, 500 for prod)
const apiRateLimitMax = process.env.API_RATE_LIMIT_MAX
  ? parseInt(process.env.API_RATE_LIMIT_MAX, 10)
  : (process.env.NODE_ENV === 'production' ? 500 : 2000);
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: apiRateLimitMax,
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sensitive keys to redact from request logs
const SENSITIVE_KEYS = ['password', 'idToken', 'newPassword', 'currentPassword', 'token', 'otp', 'sessionToken'];

function redactBody(body) {
  if (!body || typeof body !== 'object') return body;
  const copy = { ...body };
  for (const key of SENSITIVE_KEYS) {
    if (key in copy) copy[key] = '[REDACTED]';
  }
  return copy;
}

// Request logging middleware (never log passwords or tokens)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] request_id=${req.requestId} ${req.method} ${req.originalUrl}`);
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(redactBody(req.body), null, 2));
  }
  next();
});

app.use('/api/auth', authLimiterGlobal, authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/responders', responderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/analytics', analyticsRoutes);
// Phase 2 placeholder — Responder Applications (returns 501 until implemented)
app.use('/api/responder-applications', responderApplicationRoutes);

// Basic health route (includes read-only Storage probe when configured)
app.get('/health', async (req, res) => {
  const { probeBucketConnection } = require('./services/storageService');
  let storage;
  try {
    storage = await probeBucketConnection();
  } catch (err) {
    storage = { configured: true, ok: false, error: err.message };
  }
  res.json({ status: 'ok', storage });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start AI classification retry service
console.log(`\n🔒 API rate limit: ${apiRateLimitMax} requests per 15 min (set API_RATE_LIMIT_MAX to override)`);
console.log(`🔒 Auth rate limits: ${authRateLimitGlobalMax} global / ${authRateLimitAccountMax} failed attempts per account per 15 min (AUTH_RATE_LIMIT_* to override)`);
console.log('\n🤖 Initializing AI services...');
const retryTask = startRetryService();
const aiWarmupTask = startAiWarmup();
const scanRetryTask = startFileScanRetryService();
const duplicateAnalyzerTask = startDuplicateAnalyzer();

// Store retry task for graceful shutdown
app.locals.retryTask = retryTask;
app.locals.aiWarmupTask = aiWarmupTask;
app.locals.scanRetryTask = scanRetryTask;
app.locals.duplicateAnalyzerTask = duplicateAnalyzerTask;

module.exports = app;
