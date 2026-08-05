const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const TokenBlacklist = require('../models/tokenBlacklist');

module.exports = async function (req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = payload;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
