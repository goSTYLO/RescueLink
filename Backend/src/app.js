const express = require('express');
const authRoutes = require('./routes/auth');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

// Basic health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
