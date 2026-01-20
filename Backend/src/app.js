const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const responderRoutes = require('./routes/responder');
const dispatchRoutes = require('./routes/dispatch');
const notificationRoutes = require('./routes/notification');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/responders', responderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
