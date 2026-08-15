const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const TokenBlacklist = require('../models/tokenBlacklist');
const User = require('../models/user');

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

    // Use DB role so promotions/revokes apply without forcing re-login (JWT may be stale).
    const userId = payload.user_id ?? payload.userId;
    if (userId != null) {
      try {
        const currentRole = await User.getRoleById(userId);
        if (currentRole) {
          payload.role = currentRole;
        }
      } catch (_) {
        // Fall back to JWT role if lookup fails
      }
    }

    req.user = payload;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
