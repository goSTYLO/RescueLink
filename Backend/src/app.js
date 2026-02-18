const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const responderRoutes = require('./routes/responder');
const dispatchRoutes = require('./routes/dispatch');
const notificationRoutes = require('./routes/notification');
const locationRoutes = require('./routes/location');
const incidentRoutes = require('./routes/incident');
const auditLogRoutes = require('./routes/auditLog');
const adminRoutes = require('./routes/admin');
const { startRetryService } = require('./services/retryAiClassification');

const app = express();

// Trust proxy so rate limiter sees real client IP behind reverse proxy
app.set('trust proxy', 1);

// Security headers (XSS, clickjacking, etc.)
app.use(helmet());

// CORS: restrict to FRONTEND_URL in production; allow all in dev when unset
const corsOrigin = process.env.FRONTEND_URL || true;
app.use(cors({ origin: corsOrigin, credentials: true }));

// Auth rate limit: 10 requests per 15 minutes per IP (login, register, OTP, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());

// General API rate limit: 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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
  console.log(`\n[${timestamp}] ${req.method} ${req.originalUrl}`);
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(redactBody(req.body), null, 2));
  }
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/responders', responderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/admin', adminRoutes);

// Basic health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start AI classification retry service
console.log('\n🤖 Initializing AI services...');
const retryTask = startRetryService();

// Store retry task for graceful shutdown
app.locals.retryTask = retryTask;

module.exports = app;
