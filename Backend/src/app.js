const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const responderRoutes = require('./routes/responder');
const dispatchRoutes = require('./routes/dispatch');
const notificationRoutes = require('./routes/notification');
const locationRoutes = require('./routes/location');
const incidentRoutes = require('./routes/incident');
const auditLogRoutes = require('./routes/auditLog');
const { startRetryService } = require('./services/retryAiClassification');

const app = express();

app.use(cors());
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/responders', responderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/audit-logs', auditLogRoutes);

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
